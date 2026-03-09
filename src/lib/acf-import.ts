import type { Entity, Field, FieldType, StoreState } from './types';

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

/** Map an ACF field type string to our FieldType. Returns null for unsupported types. */
function mapACFField(
  acfField: ACFItem,
  slugToEntityId: Map<string, string>,
  taxSlugToEntityId: Map<string, string>,
): Field | null {
  const type = acfField.type as string;
  const id = extractId(acfField.key as string);
  const name = (acfField.label as string) || (acfField.name as string) || type;

  let fieldType: FieldType;

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
      const atomField: FieldType = { kind: 'atom', subtype: type };
      // Preserve choices for select/checkbox/radio
      if ((type === 'select' || type === 'checkbox' || type === 'radio') && acfField.choices) {
        const choices = acfField.choices as Record<string, string>;
        (atomField as { kind: 'atom'; subtype: string; choices?: string[] }).choices =
          Object.values(choices);
      }
      fieldType = atomField;
      break;
    }

    // Repeater
    case 'repeater': {
      const subFields = (acfField.sub_fields as ACFItem[]) || [];
      const mapped = subFields
        .map((sf) => mapACFField(sf, slugToEntityId, taxSlugToEntityId))
        .filter((f): f is Field => f !== null);
      fieldType = { kind: 'repeat', fields: mapped };
      break;
    }

    // Relationship (cardinality N)
    case 'relationship': {
      const postTypes = (acfField.post_type as string[]) || [];
      const targetSlug = postTypes[0] || '';
      const targetId = slugToEntityId.get(targetSlug) || '';
      fieldType = { kind: 'ref', target: targetId, cardinality: 'n' };
      break;
    }

    // Post Object (cardinality 1)
    case 'post_object': {
      const postTypes = (acfField.post_type as string[]) || [];
      const targetSlug = postTypes[0] || '';
      const targetId = slugToEntityId.get(targetSlug) || '';
      fieldType = { kind: 'ref', target: targetId, cardinality: '1' };
      break;
    }

    // Taxonomy
    case 'taxonomy': {
      const taxSlugs = (acfField.taxonomy as string[]) || [acfField.taxonomy as string];
      const targetSlug = taxSlugs[0] || '';
      const targetId = taxSlugToEntityId.get(targetSlug) || '';
      fieldType = { kind: 'ref', target: targetId, cardinality: 'taxonomy' };
      break;
    }

    // Unsupported types → skip
    default:
      return null;
  }

  return { id, name, type: fieldType };
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
  // Each field group's location tells us which post_type slug it belongs to
  for (const fg of fieldGroups) {
    const location = fg.location as Array<Array<{ param: string; value: string }>>;
    const slug = location?.[0]?.[0]?.value || '';
    const groupId = extractId(fg.key as string);

    // Determine entity name: prefer post_type title, else field group title, else slug
    let entityName = fg.title as string;
    const ptInfo = postTypeMap.get(slug);
    if (ptInfo) {
      entityName = ptInfo.title;
    }

    // Check if we already created an entity for this slug (multiple field groups per entity)
    if (!slugToEntityId.has(slug)) {
      const postTypeKey = ptInfo ? extractId(ptInfo.key) : undefined;
      const entity: Entity = { id: groupId, name: entityName, fields: [], slug, postTypeKey };
      entities.push(entity);
      slugToEntityId.set(slug, groupId);
    }
  }

  // 3a2. Create entities for post_type definitions that have no field group pointing to them
  for (const [slug, info] of postTypeMap) {
    if (!slugToEntityId.has(slug)) {
      const ptId = extractId(info.key);
      const entity: Entity = { id: ptId, name: info.title, fields: [], slug };
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
      fields: [
        // "name" text field
        { id: `${taxId}_name`, name: 'text', type: { kind: 'atom', subtype: 'text' } },
        // "parent" self-ref
        { id: `${taxId}_parent`, name: 'parent', type: { kind: 'ref', target: taxId, cardinality: 'taxonomy' } },
      ],
    };
    entities.push(entity);
    taxSlugToEntityId.set(slug, taxId);
  }

  // 4. Map fields for each field group (now we have all entity IDs)
  for (const fg of fieldGroups) {
    const location = fg.location as Array<Array<{ param: string; value: string }>>;
    const slug = location?.[0]?.[0]?.value || '';
    const entityId = slugToEntityId.get(slug);
    if (!entityId) continue;

    const entity = entities.find((e) => e.id === entityId);
    if (!entity) continue;

    const acfFields = (fg.fields as ACFItem[]) || [];
    for (const af of acfFields) {
      const field = mapACFField(af, slugToEntityId, taxSlugToEntityId);
      if (field) entity.fields.push(field);
    }
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

      // Only add if no existing taxonomy ref to this entity
      const alreadyHas = ownerEntity.fields.some(
        (f) => f.type.kind === 'ref' && f.type.cardinality === 'taxonomy' && f.type.target === taxEntityId,
      );
      if (!alreadyHas) {
        ownerEntity.fields.push({
          id: `${ownerEntityId}_tax_${taxSlug}`,
          name: taxSlug,
          type: { kind: 'ref', target: taxEntityId, cardinality: 'taxonomy' },
        });
      }
    }
  }

  // 5. Auto-layout: arrange entities in a grid
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
