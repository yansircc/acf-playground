import type { Entity, Field, FieldType, Position, DerivedEdge, EntityData, StoreState } from './types';

function uid(): string {
  return crypto.randomUUID();
}

function defaultFieldName(type: FieldType): string {
  switch (type.kind) {
    case 'atom': return type.subtype;
    case 'repeat': return 'repeater';
    case 'ref':
      switch (type.cardinality) {
        case '1': return 'post_object';
        case 'n': return 'relationship';
        case 'taxonomy': return 'taxonomy';
      }
  }
}

class ACFStore {
  entities: Entity[] = $state([]);
  data: Record<string, EntityData> = $state({});
  positions: Record<string, Position> = $state({});
  selected: string | null = $state(null);

  // === Derived ===

  edges: DerivedEdge[] = $derived(
    this.entities.flatMap((e) => {
      const topLevel = e.fields
        .filter((f): f is Field & { type: { kind: 'ref'; target: string } } =>
          f.type.kind === 'ref'
        )
        .filter((f) => this.entities.some((t) => t.id === f.type.target))
        .map((f) => ({
          id: `${e.id}-${f.id}`,
          source: e.id,
          sourceHandle: f.id,
          target: f.type.target,
        }));
      // Also derive edges from ref sub-fields inside repeaters
      const repeaterRefs = e.fields
        .filter((f) => f.type.kind === 'repeat')
        .flatMap((f) =>
          (f.type as { kind: 'repeat'; fields: Field[] }).fields
            .filter((sf): sf is Field & { type: { kind: 'ref'; target: string } } =>
              sf.type.kind === 'ref'
            )
            .filter((sf) => this.entities.some((t) => t.id === sf.type.target))
            .map((sf) => ({
              id: `${e.id}-${f.id}-${sf.id}`,
              source: e.id,
              sourceHandle: sf.id,
              target: sf.type.target,
            }))
        );
      return [...topLevel, ...repeaterRefs];
    })
  );

  currentEntity: Entity | undefined = $derived(
    this.entities.find((e) => e.id === this.selected)
  );

  currentData: EntityData = $derived(
    this.selected ? (this.data[this.selected] ?? [{}]) : [{}]
  );

  // === Mutations ===

  addEntity(name: string, position?: Position): Entity {
    const id = uid();
    const entity: Entity = { id, name, fields: [] };
    this.entities.push(entity);
    this.data[id] = [{}];
    this.positions[id] = position ?? { x: 100 + this.entities.length * 50, y: 100 + this.entities.length * 30 };
    this.selected = id;
    return entity;
  }

  renameEntity(entityId: string, name: string): void {
    const entity = this.entities.find((e) => e.id === entityId);
    if (entity) entity.name = name;
  }

  removeEntity(entityId: string): void {
    const idx = this.entities.findIndex((e) => e.id === entityId);
    if (idx === -1) return;
    this.entities.splice(idx, 1);
    delete this.data[entityId];
    delete this.positions[entityId];
    if (this.selected === entityId) {
      this.selected = this.entities.length > 0 ? this.entities[0].id : null;
    }
    // Clean up ref fields pointing to deleted entity
    for (const e of this.entities) {
      e.fields = e.fields.filter(
        (f) => !(f.type.kind === 'ref' && f.type.target === entityId)
      );
      // Also clean ref sub-fields inside repeaters
      for (const f of e.fields) {
        if (f.type.kind === 'repeat') {
          f.type.fields = f.type.fields.filter(
            (sf) => !(sf.type.kind === 'ref' && sf.type.target === entityId)
          );
        }
      }
    }
  }

  addField(entityId: string, type: FieldType): Field | undefined {
    const entity = this.entities.find((e) => e.id === entityId);
    if (!entity) return;
    const field: Field = { id: uid(), name: defaultFieldName(type), type };
    entity.fields.push(field);
    // Initialize data slot for this field in all data rows
    for (const row of (this.data[entityId] ?? [])) {
      row[field.id] = type.kind === 'repeat' ? [{}] : '';
    }
    return field;
  }

  addSubField(entityId: string, repeaterFieldId: string, fieldType: FieldType): Field | undefined {
    const entity = this.entities.find((e) => e.id === entityId);
    if (!entity) return;
    const repeater = entity.fields.find((f) => f.id === repeaterFieldId);
    if (!repeater || repeater.type.kind !== 'repeat') return;
    // Reject nested repeater and ref(n) in repeater cells
    if (fieldType.kind === 'repeat') return;
    if (fieldType.kind === 'ref' && fieldType.cardinality === 'n') return;
    const sub: Field = { id: uid(), name: defaultFieldName(fieldType), type: fieldType };
    repeater.type.fields.push(sub);
    // Initialize data slot in existing repeater rows
    for (const row of (this.data[entityId] ?? [])) {
      const repeatRows = row[repeaterFieldId];
      if (Array.isArray(repeatRows)) {
        for (const rr of repeatRows) {
          if (!(sub.id in rr)) rr[sub.id] = '';
        }
      }
    }
    return sub;
  }

  removeSubField(entityId: string, repeaterFieldId: string, subFieldId: string): void {
    const entity = this.entities.find((e) => e.id === entityId);
    if (!entity) return;
    const repeater = entity.fields.find((f) => f.id === repeaterFieldId);
    if (!repeater || repeater.type.kind !== 'repeat') return;
    repeater.type.fields = repeater.type.fields.filter((f) => f.id !== subFieldId);
    // Clean data
    for (const row of (this.data[entityId] ?? [])) {
      const repeatRows = row[repeaterFieldId];
      if (Array.isArray(repeatRows)) {
        for (const rr of repeatRows) {
          delete rr[subFieldId];
        }
      }
    }
  }

  removeField(entityId: string, fieldId: string): void {
    const entity = this.entities.find((e) => e.id === entityId);
    if (!entity) return;
    entity.fields = entity.fields.filter((f) => f.id !== fieldId);
    // Clean up data
    for (const row of (this.data[entityId] ?? [])) {
      delete row[fieldId];
    }
  }

  moveField(entityId: string, fromIndex: number, toIndex: number): void {
    const entity = this.entities.find((e) => e.id === entityId);
    if (!entity) return;
    const len = entity.fields.length;
    if (fromIndex < 0 || fromIndex >= len) return;
    if (toIndex < 0 || toIndex >= len) return;
    if (fromIndex === toIndex) return;
    const [field] = entity.fields.splice(fromIndex, 1);
    entity.fields.splice(toIndex, 0, field);
  }

  updateField(entityId: string, fieldId: string, updates: Partial<Pick<Field, 'name'>>): void {
    const entity = this.entities.find((e) => e.id === entityId);
    if (!entity) return;
    // Search top-level fields first
    let field = entity.fields.find((f) => f.id === fieldId);
    // Then search repeater sub-fields
    if (!field) {
      for (const f of entity.fields) {
        if (f.type.kind === 'repeat') {
          const sub = f.type.fields.find((sf) => sf.id === fieldId);
          if (sub) { field = sub; break; }
        }
      }
    }
    if (!field) return;
    if (updates.name !== undefined) field.name = updates.name;
  }

  updateRefTarget(entityId: string, fieldId: string, target: string): void {
    const entity = this.entities.find((e) => e.id === entityId);
    if (!entity) return;
    const field = entity.fields.find((f) => f.id === fieldId);
    if (!field || field.type.kind !== 'ref') return;
    // Replace the type object to ensure $derived edges recalculates
    field.type = { ...field.type, target };
  }

  updateFieldData(entityId: string, fieldId: string, value: unknown, rowIndex = 0): void {
    if (!this.data[entityId]) this.data[entityId] = [{}];
    while (this.data[entityId].length <= rowIndex) {
      this.data[entityId].push({});
    }
    this.data[entityId][rowIndex][fieldId] = value;
  }

  updateRepeaterData(entityId: string, fieldId: string, subFieldId: string, value: unknown, rowIndex = 0, repeatIndex = 0): void {
    if (!this.data[entityId]) this.data[entityId] = [{}];
    while (this.data[entityId].length <= rowIndex) {
      this.data[entityId].push({});
    }
    const row = this.data[entityId][rowIndex];
    if (!Array.isArray(row[fieldId])) row[fieldId] = [{}];
    const repeatRows = row[fieldId] as Record<string, unknown>[];
    while (repeatRows.length <= repeatIndex) {
      repeatRows.push({});
    }
    repeatRows[repeatIndex][subFieldId] = value;
  }

  addRepeaterRow(entityId: string, fieldId: string, rowIndex = 0): void {
    if (!this.data[entityId]?.[rowIndex]) return;
    const row = this.data[entityId][rowIndex];
    if (!Array.isArray(row[fieldId])) row[fieldId] = [];
    (row[fieldId] as Record<string, unknown>[]).push({});
  }

  removeRepeaterRow(entityId: string, fieldId: string, repeatIndex: number, rowIndex = 0): void {
    if (!this.data[entityId]?.[rowIndex]) return;
    const row = this.data[entityId][rowIndex];
    if (!Array.isArray(row[fieldId])) return;
    (row[fieldId] as Record<string, unknown>[]).splice(repeatIndex, 1);
  }

  updatePosition(entityId: string, position: Position): void {
    this.positions[entityId] = position;
  }

  setSelected(entityId: string | null): void {
    this.selected = entityId;
  }

  // === Taxonomy macro ===

  addDataRow(entityId: string): void {
    if (!this.data[entityId]) this.data[entityId] = [];
    this.data[entityId].push({});
  }

  removeDataRow(entityId: string, rowIndex: number): void {
    if (!this.data[entityId]) return;
    this.data[entityId].splice(rowIndex, 1);
    if (this.data[entityId].length === 0) {
      this.data[entityId] = [{}];
    }
  }

  // === Taxonomy macro (original) ===

  addTaxonomyField(sourceEntityId: string, taxonomyName: string, position?: Position): Entity | undefined {
    const sourceEntity = this.entities.find((e) => e.id === sourceEntityId);
    if (!sourceEntity) return;

    // Create taxonomy entity with name + parent (self-ref)
    const taxEntity = this.addEntity(taxonomyName, position);
    this.addField(taxEntity.id, { kind: 'atom', subtype: 'text' }); // name field
    // parent self-ref
    const parentField = this.addField(taxEntity.id, { kind: 'ref', target: taxEntity.id, cardinality: 'taxonomy' });
    if (parentField) parentField.name = 'parent';

    // Add taxonomy ref field on source entity
    const refField = this.addField(sourceEntityId, { kind: 'ref', target: taxEntity.id, cardinality: 'taxonomy' });
    if (refField) refField.name = taxonomyName.toLowerCase().replace(/\s+/g, '_');

    this.selected = sourceEntityId;
    return taxEntity;
  }

  // === Ref data helpers ===

  getRecordLabel(entityId: string, rowIndex: number): string {
    const entity = this.entities.find((e) => e.id === entityId);
    if (!entity) return `#${rowIndex + 1}`;
    const textField = entity.fields.find(
      (f) => f.type.kind === 'atom' && (f.type.subtype === 'text' || f.type.subtype === 'textarea')
    );
    if (!textField) return `${entity.name} #${rowIndex + 1}`;
    const rows = this.data[entityId] ?? [];
    if (rowIndex < 0 || rowIndex >= rows.length) return `${entity.name} #${rowIndex + 1}`;
    const val = rows[rowIndex]?.[textField.id];
    return (val as string) || `${entity.name} #${rowIndex + 1}`;
  }

  getRefOptions(targetEntityId: string): { index: number; label: string }[] {
    const rows = this.data[targetEntityId] ?? [];
    return rows.map((_, i) => ({ index: i, label: this.getRecordLabel(targetEntityId, i) }));
  }

  // === Derived helpers ===

  isSelfRefEntity(entityId: string): boolean {
    const entity = this.entities.find((e) => e.id === entityId);
    if (!entity) return false;
    return entity.fields.some(
      (f) => f.type.kind === 'ref' && f.type.target === entityId
    );
  }

  reset(): void {
    this.entities = [];
    this.data = {};
    this.positions = {};
    this.selected = null;
  }

  serialize(): StoreState {
    return $state.snapshot({
      entities: this.entities,
      data: this.data,
      positions: this.positions,
      selected: this.selected,
    }) as StoreState;
  }

  hydrate(state: StoreState): void {
    this.entities = state.entities;
    this.data = state.data;
    this.positions = state.positions;
    this.selected = state.selected;
  }
}

export const store = new ACFStore();
