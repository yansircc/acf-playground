import type { Entity, Field, FieldType, Position, DerivedEdge, EntityData } from './types';

function uid(): string {
  return crypto.randomUUID();
}

function defaultFieldName(type: FieldType): string {
  switch (type.kind) {
    case 'atom': return type.subtype;
    case 'repeat': return 'repeater';
    case 'ref': return type.cardinality === '1' ? 'post_object' : 'relationship';
  }
}

class ACFStore {
  entities: Entity[] = $state([]);
  data: Record<string, EntityData> = $state({});
  positions: Record<string, Position> = $state({});
  selected: string | null = $state(null);

  // === Derived ===

  edges: DerivedEdge[] = $derived(
    this.entities.flatMap((e) =>
      e.fields
        .filter((f): f is Field & { type: { kind: 'ref'; target: string } } =>
          f.type.kind === 'ref'
        )
        .filter((f) => this.entities.some((t) => t.id === f.type.target))
        .map((f) => ({
          id: `${e.id}-${f.id}`,
          source: e.id,
          sourceHandle: f.id,
          target: f.type.target,
        }))
    )
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

  addSubField(entityId: string, repeaterFieldId: string, subtype: import('./types').AtomSubtype): Field | undefined {
    const entity = this.entities.find((e) => e.id === entityId);
    if (!entity) return;
    const repeater = entity.fields.find((f) => f.id === repeaterFieldId);
    if (!repeater || repeater.type.kind !== 'repeat') return;
    const sub: Field = { id: uid(), name: subtype, type: { kind: 'atom', subtype } };
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

  updateField(entityId: string, fieldId: string, updates: Partial<Pick<Field, 'name'>>): void {
    const entity = this.entities.find((e) => e.id === entityId);
    if (!entity) return;
    const field = entity.fields.find((f) => f.id === fieldId);
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

  reset(): void {
    this.entities = [];
    this.data = {};
    this.positions = {};
    this.selected = null;
  }
}

export const store = new ACFStore();
