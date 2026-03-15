import type { Entity, Field, FieldType, FieldGroup, StoreState } from './types';
import { getSchemaForField } from './acf-field-schema';

// === ACF JSON → Store conversion ===

type ACFItem = Record<string, unknown>;

/** Detect if a parsed JSON value is ACF export format */
export function isACFFormat(data: unknown): data is ACFItem[] {
  if (!Array.isArray(data) || data.length === 0) return false;
  const first = data[0];
  if (!first || typeof first !== 'object') return false;
  const key = (first as Record<string, unknown>).key;
  if (typeof key !== 'string') return false;
  return key.startsWith('group_') || key.startsWith('post_type_') || key.startsWith('taxonomy_');
}

/** Extract the hex portion after the known prefix */
function extractId(key: string): string {
  for (const prefix of ['post_type_', 'taxonomy_', 'group_', 'field_']) {
    if (key.startsWith(prefix)) return key.slice(prefix.length);
  }
  const idx = key.indexOf('_');
  return idx >= 0 ? key.slice(idx + 1) : key;
}

/** Normalize hide_on_screen: '' → [], string → [string], array → array */
function normalizeHideOnScreen(value: unknown): string[] {
  if (!value || value === '') return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value as string[];
  return [];
}

/** Map an ACF field type string to our FieldType + config. Returns null for unsupported types. */
function mapACFField(
  acfField: ACFItem,
  slugToEntityId: Map<string, string>,
  taxSlugToEntityId: Map<string, string>,
  acfKeyToFieldId: Map<string, string>,
): Field | null {
  const type = acfField.type as string;
  const id = extractId(acfField.key as string);
  const name = (acfField.label as string) || (acfField.name as string) || type;

  // Record mapping for conditional logic resolution
  acfKeyToFieldId.set(acfField.key as string, id);

  let fieldType: FieldType;
  const config: Record<string, unknown> = {};

  // Extract universal config
  if (acfField.required) config.required = acfField.required;
  if (acfField.instructions) config.instructions = acfField.instructions;
  if (acfField.wrapper) config.wrapper = acfField.wrapper;

  switch (type) {
    // Atom types
    case 'text':
    case 'textarea':
    case 'number':
    case 'range':
    case 'email':
    case 'url':
    case 'password':
    case 'image':
    case 'file':
    case 'wysiwyg':
    case 'oembed':
    case 'gallery':
    case 'select':
    case 'checkbox':
    case 'radio':
    case 'true_false':
    case 'google_map':
    case 'date_picker':
    case 'date_time_picker':
    case 'time_picker':
    case 'color_picker':
    case 'page_link':
    case 'user': {
      fieldType = { kind: 'atom', subtype: type };
      // choices → string[]
      if ((type === 'select' || type === 'checkbox' || type === 'radio') && acfField.choices) {
        const choices = acfField.choices as Record<string, string>;
        config.choices = Object.values(choices);
      }
      // Type-specific properties from schema
      const schema = getSchemaForField({ type: fieldType });
      for (const prop of schema) {
        if (prop.key === 'choices') continue; // already handled
        if (prop.key === 'required' || prop.key === 'instructions') continue; // already handled
        if (prop.nested) continue; // wrapper.* handled above
        if (acfField[prop.key] !== undefined) config[prop.key] = acfField[prop.key];
      }
      break;
    }

    // Repeater
    case 'repeater': {
      const subFields = (acfField.sub_fields as ACFItem[]) || [];
      const mapped = subFields
        .map((sf) => mapACFField(sf, slugToEntityId, taxSlugToEntityId, acfKeyToFieldId))
        .filter((f): f is Field => f !== null);
      fieldType = { kind: 'repeat', fields: mapped };
      // Repeater-specific properties
      const schema = getSchemaForField({ type: fieldType });
      for (const prop of schema) {
        if (prop.key === 'required' || prop.key === 'instructions') continue;
        if (prop.nested) continue;
        if (acfField[prop.key] !== undefined) config[prop.key] = acfField[prop.key];
      }
      break;
    }

    // Relationship (cardinality N)
    case 'relationship': {
      const postTypes = (acfField.post_type as string[]) || [];
      const targetSlug = postTypes[0] || '';
      const targetId = slugToEntityId.get(targetSlug) || '';
      fieldType = { kind: 'ref', target: targetId, cardinality: 'n' };
      const schema = getSchemaForField({ type: fieldType });
      for (const prop of schema) {
        if (prop.key === 'required' || prop.key === 'instructions') continue;
        if (prop.nested) continue;
        if (acfField[prop.key] !== undefined) config[prop.key] = acfField[prop.key];
      }
      break;
    }

    // Post Object (cardinality 1)
    case 'post_object': {
      const postTypes = (acfField.post_type as string[]) || [];
      const targetSlug = postTypes[0] || '';
      const targetId = slugToEntityId.get(targetSlug) || '';
      fieldType = { kind: 'ref', target: targetId, cardinality: '1' };
      const schema = getSchemaForField({ type: fieldType });
      for (const prop of schema) {
        if (prop.key === 'required' || prop.key === 'instructions') continue;
        if (prop.nested) continue;
        if (acfField[prop.key] !== undefined) config[prop.key] = acfField[prop.key];
      }
      break;
    }

    // Taxonomy
    case 'taxonomy': {
      const taxSlugs = (acfField.taxonomy as string[]) || [acfField.taxonomy as string];
      const targetSlug = taxSlugs[0] || '';
      const targetId = taxSlugToEntityId.get(targetSlug) || '';
      fieldType = { kind: 'ref', target: targetId, cardinality: 'taxonomy' };
      const schema = getSchemaForField({ type: fieldType });
      for (const prop of schema) {
        if (prop.key === 'required' || prop.key === 'instructions') continue;
        if (prop.nested) continue;
        if (acfField[prop.key] !== undefined) config[prop.key] = acfField[prop.key];
      }
      break;
    }

    // Unsupported types → skip
    default:
      return null;
  }

  // Conditional logic — preserve raw ACF format for now (two-pass resolution later)
  if (acfField.conditional_logic && acfField.conditional_logic !== 0) {
    config.conditional_logic = acfField.conditional_logic;
  }

  return { id, name, type: fieldType, config: Object.keys(config).length > 0 ? config : undefined };
}

/** Convert ACF JSON export array to StoreState */
export function importACF(items: ACFItem[]): StoreState {
  // 1. Classify items by key prefix
  const fieldGroups: ACFItem[] = [];
  const postTypes: ACFItem[] = [];
  const taxonomies: ACFItem[] = [];

  for (const item of items) {
    const key = item.key as string;
    if (key.startsWith('group_')) fieldGroups.push(item);
    else if (key.startsWith('post_type_')) postTypes.push(item);
    else if (key.startsWith('taxonomy_')) taxonomies.push(item);
  }

  // 2. Build slug → info mappings
  const postTypeMap = new Map<string, { title: string; key: string }>();
  for (const pt of postTypes) {
    const slug = pt.post_type as string;
    const title = pt.title as string;
    postTypeMap.set(slug, { title, key: pt.key as string });
  }

  const taxonomyMap = new Map<string, { title: string; key: string; objectTypes: string[] }>();
  for (const tax of taxonomies) {
    const slug = tax.taxonomy as string;
    const title = tax.title as string;
    const objectTypes = (tax.object_type as string[]) || [];
    taxonomyMap.set(slug, { title, key: tax.key as string, objectTypes });
  }

  // 3. Create entities
  const entities: Entity[] = [];
  const slugToEntityId = new Map<string, string>();
  const taxSlugToEntityId = new Map<string, string>();

  // 3a. Create normal entities from field groups
  // Track which entities are already created by slug
  for (const fg of fieldGroups) {
    const location = fg.location as Array<Array<{ param: string; value: string }>>;
    const slug = location?.[0]?.[0]?.value || '';

    const ptInfo = postTypeMap.get(slug);
    const entityName = ptInfo ? ptInfo.title : slug || (fg.title as string);

    if (!slugToEntityId.has(slug)) {
      const entityId = extractId(fg.key as string);
      const postTypeKey = ptInfo ? extractId(ptInfo.key) : undefined;
      const entity: Entity = { id: entityId, name: entityName, groups: [], slug, postTypeKey };
      entities.push(entity);
      slugToEntityId.set(slug, entityId);
    }
  }

  // 3a2. Create entities for post_type definitions that have no field group
  for (const [slug, info] of postTypeMap) {
    if (!slugToEntityId.has(slug)) {
      const ptId = extractId(info.key);
      const entity: Entity = {
        id: ptId, name: info.title,
        groups: [{ id: ptId, title: info.title, fields: [] }],
        slug,
        postTypeKey: extractId(info.key),
      };
      entities.push(entity);
      slugToEntityId.set(slug, ptId);
    }
  }

  // 3b. Create taxonomy entities
  for (const [slug, info] of taxonomyMap) {
    const taxId = extractId(info.key);
    const entity: Entity = {
      id: taxId,
      name: info.title,
      slug,
      groups: [{
        id: taxId,
        title: info.title,
        fields: [
          { id: `${taxId}_name`, name: 'text', type: { kind: 'atom', subtype: 'text' } },
          { id: `${taxId}_parent`, name: 'parent', type: { kind: 'ref', target: taxId, cardinality: 'taxonomy' } },
        ],
      }],
    };
    entities.push(entity);
    taxSlugToEntityId.set(slug, taxId);
  }

  // 4. Map fields for each field group → preserve as separate FieldGroup
  const acfKeyToFieldId = new Map<string, string>();

  for (const fg of fieldGroups) {
    const location = fg.location as Array<Array<{ param: string; value: string }>>;
    const slug = location?.[0]?.[0]?.value || '';
    const entityId = slugToEntityId.get(slug);
    if (!entityId) continue;

    const entity = entities.find((e) => e.id === entityId);
    if (!entity) continue;

    const group: FieldGroup = {
      id: extractId(fg.key as string),
      title: fg.title as string,
      fields: [],
      config: {
        position: fg.position as string,
        style: fg.style as string,
        label_placement: fg.label_placement as string,
        instruction_placement: fg.instruction_placement as string,
        description: (fg.description as string) || '',
        show_in_rest: (fg.show_in_rest as number) || 0,
        hide_on_screen: normalizeHideOnScreen(fg.hide_on_screen),
      },
      key: fg.key as string,
    };

    const acfFields = (fg.fields as ACFItem[]) || [];
    for (const af of acfFields) {
      const field = mapACFField(af, slugToEntityId, taxSlugToEntityId, acfKeyToFieldId);
      if (field) group.fields.push(field);
    }

    entity.groups.push(group);
  }

  // 4b. Add taxonomy ref fields on normal entities
  for (const [taxSlug, info] of taxonomyMap) {
    const taxEntityId = taxSlugToEntityId.get(taxSlug);
    if (!taxEntityId) continue;

    for (const ownerSlug of info.objectTypes) {
      const ownerEntityId = slugToEntityId.get(ownerSlug);
      if (!ownerEntityId) continue;
      const ownerEntity = entities.find((e) => e.id === ownerEntityId);
      if (!ownerEntity) continue;

      // Check all groups for existing taxonomy ref
      const alreadyHas = ownerEntity.groups.some(g =>
        g.fields.some(
          (f) => f.type.kind === 'ref' && f.type.cardinality === 'taxonomy' && f.type.target === taxEntityId,
        )
      );
      if (!alreadyHas) {
        // Add to first group
        const targetGroup = ownerEntity.groups[0];
        if (targetGroup) {
          targetGroup.fields.push({
            id: `${ownerEntityId}_tax_${taxSlug}`,
            name: taxSlug,
            type: { kind: 'ref', target: taxEntityId, cardinality: 'taxonomy' },
          });
        }
      }
    }
  }

  // 5. Two-pass: resolve conditional_logic field_xxx → internal field.id
  for (const entity of entities) {
    for (const group of entity.groups) {
      const groupFieldIds = new Set<string>();
      for (const f of group.fields) {
        groupFieldIds.add(f.id);
      }

      for (const field of group.fields) {
        resolveConditionalLogicRefs(field, acfKeyToFieldId, groupFieldIds);
        if (field.type.kind === 'repeat') {
          for (const sf of field.type.fields) {
            resolveConditionalLogicRefs(sf, acfKeyToFieldId, groupFieldIds);
          }
        }
      }
    }
  }

  // 6. Auto-layout: arrange entities in a grid
  const positions: Record<string, { x: number; y: number }> = {};
  const cols = Math.ceil(Math.sqrt(entities.length));
  entities.forEach((e, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions[e.id] = { x: 100 + col * 350, y: 100 + row * 300 };
  });

  return {
    entities,
    data: {},
    positions,
    selected: null,
  };
}

function resolveConditionalLogicRefs(
  field: Field,
  keyMap: Map<string, string>,
  groupFieldIds: Set<string>,
) {
  const cl = field.config?.conditional_logic;
  if (!cl || cl === 0) return;
  for (const orGroup of cl as Record<string, unknown>[][]) {
    for (const rule of orGroup) {
      const internalId = keyMap.get(rule.field as string);
      if (internalId && groupFieldIds.has(internalId)) {
        rule.field = internalId;
        rule._resolved = true;
      } else {
        rule._resolved = false;
      }
    }
  }
}
