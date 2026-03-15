import type { Entity, Field } from './types';
import { allFields } from './types';
import { getSchemaForField, getDefaultGroupConfig } from './acf-field-schema';
import { WP_BUILTIN_TYPES, isTaxonomyEntity } from './wp-helpers';

// === ACF field (complete format matching WordPress ACF import) ===

type ACFField = Record<string, unknown>;

type ACFFieldGroup = {
  key: string;
  title: string;
  fields: ACFField[];
  location: Array<Array<{ param: string; operator: string; value: string }>>;
  menu_order: number;
  position: string;
  style: string;
  label_placement: string;
  instruction_placement: string;
  hide_on_screen: string | string[];
  active: boolean;
  description: string;
  show_in_rest: number;
};

type ACFTaxonomy = Record<string, unknown>;
type ACFPostType = Record<string, unknown>;

export type ExportOverrides = {
  entitySlugs: Record<string, string>;  // entityId → slug
  fieldNames: Record<string, string>;   // fieldId → snake_case name
};

// Use the entity/field ID directly (ACF uses 13-char hex keys)
function idToKey(id: string): string {
  return id.replace(/-/g, '');
}

function toSnake(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '_').replace(/^_|_$/g, '');
}

// Get the slug for an entity: use preserved slug if available, else derive from name
function entitySlug(entity: Entity, overrides?: ExportOverrides): string {
  if (overrides?.entitySlugs[entity.id]) return overrides.entitySlugs[entity.id];
  return entity.slug || toSnake(entity.name);
}

// Convert string[] choices to ACF { value: label } object
function choicesObj(choices?: string[]): Record<string, string> {
  if (!choices || choices.length === 0) return {};
  const obj: Record<string, string> = {};
  for (const c of choices) {
    obj[toSnake(c)] = c;
  }
  return obj;
}

// Serialize conditional_logic: strip internal _resolved metadata, convert field IDs
function serializeConditionalLogic(cl: unknown): unknown {
  if (!cl || cl === 0) return 0;
  if (!Array.isArray(cl)) return 0;
  const result = (cl as Record<string, unknown>[][]).map(orGroup =>
    orGroup.map(rule => {
      const { _resolved, ...rest } = rule;
      // Convert internal field ID to ACF key format if resolved
      if (_resolved === true && rest.field && typeof rest.field === 'string' && !String(rest.field).startsWith('field_')) {
        rest.field = `field_${idToKey(rest.field as string)}`;
      }
      return rest;
    })
  );
  return result;
}

// Serialize hide_on_screen: [] → '', string[] → array
function serializeHideOnScreen(value: unknown): string | string[] {
  if (!value || !Array.isArray(value) || value.length === 0) return '';
  return value;
}

// === Field conversion (config-driven) ===

function fieldToACF(field: Field, entities: Entity[], overrides?: ExportOverrides, parentRepeaterKey?: string): ACFField {
  const ft = field.type;
  const key = `field_${idToKey(field.id)}`;
  const name = overrides?.fieldNames[field.id] || toSnake(field.name);

  const base: ACFField = {
    key,
    label: field.name,
    name,
    'aria-label': '',
    type: '',
    instructions: field.config?.instructions ?? '',
    required: field.config?.required ?? 0,
    conditional_logic: serializeConditionalLogic(field.config?.conditional_logic),
    wrapper: field.config?.wrapper ?? { width: '', class: '', id: '' },
  };

  if (parentRepeaterKey) {
    base.parent_repeater = parentRepeaterKey;
  }

  switch (ft.kind) {
    case 'atom':
      base.type = ft.subtype;
      // choices special handling
      if (['select', 'checkbox', 'radio'].includes(ft.subtype)) {
        base.choices = choicesObj(field.config?.choices as string[]);
      }
      break;

    case 'repeat':
      base.type = 'repeater';
      base.sub_fields = ft.fields.map((f) => fieldToACF(f, entities, overrides, key));
      break;

    case 'ref': {
      const targetEntity = entities.find((e) => e.id === ft.target);
      const targetSlug = targetEntity ? entitySlug(targetEntity, overrides) : 'post';

      if (ft.cardinality === '1') {
        base.type = 'post_object';
        base.post_type = [targetSlug];
      } else if (ft.cardinality === 'taxonomy') {
        base.type = 'taxonomy';
        base.taxonomy = targetEntity ? entitySlug(targetEntity, overrides) : 'category';
      } else {
        base.type = 'relationship';
        base.post_type = [targetSlug];
      }
      break;
    }
  }

  // Fill remaining properties from schema + config
  const schema = getSchemaForField(field);
  for (const prop of schema) {
    if (['choices', 'conditional_logic', 'required', 'instructions'].includes(prop.key)) continue;
    if (prop.nested) continue; // wrapper.* handled above as whole object
    if (base[prop.key] !== undefined) continue; // already set above (e.g. post_type, taxonomy)
    base[prop.key] = field.config?.[prop.key] ?? prop.default;
  }

  return base;
}

// === Taxonomy entity → ACF taxonomy definition ===

function taxonomyToACF(entity: Entity, objectTypes: string[], overrides?: ExportOverrides): ACFTaxonomy {
  const slug = entitySlug(entity, overrides);
  const name = entity.name;
  return {
    key: `taxonomy_${idToKey(entity.id)}`,
    title: name,
    menu_order: 0,
    active: true,
    taxonomy: slug,
    object_type: objectTypes,
    advanced_configuration: 0,
    import_source: '',
    import_date: '',
    labels: {
      name,
      singular_name: name,
      menu_name: name,
      all_items: `所有${name}`,
      edit_item: `编辑${name}`,
      view_item: `查看${name}`,
      update_item: `更新${name}`,
      add_new_item: `新增${name}`,
      new_item_name: `新${name}名称`,
      search_items: `搜索${name}`,
      not_found: `未找到${name}`,
    },
    description: '',
    capabilities: {
      manage_terms: 'manage_categories',
      edit_terms: 'manage_categories',
      delete_terms: 'manage_categories',
      assign_terms: 'edit_posts',
    },
    public: true,
    publicly_queryable: true,
    hierarchical: true,
    show_ui: true,
    show_in_menu: true,
    show_in_nav_menus: true,
    show_in_rest: true,
    rest_base: '',
    rest_namespace: 'wp/v2',
    rest_controller_class: 'WP_REST_Terms_Controller',
    show_tagcloud: true,
    show_in_quick_edit: true,
    show_admin_column: false,
    rewrite: {
      permalink_rewrite: 'taxonomy_key',
      slug: '',
      with_front: true,
      rewrite_hierarchical: true,
    },
    query_var: 'taxonomy_key',
    query_var_name: '',
    default_term: {
      default_term_enabled: false,
      default_term_name: '',
      default_term_slug: '',
      default_term_description: '',
    },
    sort: null,
    meta_box: 'default',
    meta_box_cb: '',
    meta_box_sanitize_cb: '',
  };
}

// === Normal entity → ACF post type definition ===

function postTypeToACF(entity: Entity, overrides?: ExportOverrides): ACFPostType {
  const slug = entitySlug(entity, overrides);
  const name = entity.name;
  return {
    key: `post_type_${entity.postTypeKey || idToKey(entity.id)}`,
    title: name,
    menu_order: 0,
    active: true,
    post_type: slug,
    advanced_configuration: false,
    import_source: '',
    import_date: '',
    labels: {
      name,
      singular_name: name,
      menu_name: name,
      all_items: `所有${name}`,
      add_new: '新增',
      add_new_item: `新增${name}`,
      edit_item: `编辑${name}`,
      new_item: `新${name}`,
      view_item: `查看${name}`,
      search_items: `搜索${name}`,
      not_found: `未找到${name}`,
      not_found_in_trash: `回收站中未找到${name}`,
    },
    description: '',
    public: true,
    hierarchical: false,
    exclude_from_search: false,
    publicly_queryable: true,
    show_ui: true,
    show_in_menu: true,
    admin_menu_parent: '',
    show_in_admin_bar: true,
    show_in_nav_menus: true,
    show_in_rest: true,
    rest_base: '',
    rest_namespace: 'wp/v2',
    rest_controller_class: 'WP_REST_Posts_Controller',
    menu_position: null,
    menu_icon: 'dashicons-admin-post',
    rename_capabilities: false,
    singular_capability_name: 'post',
    plural_capability_name: 'posts',
    supports: ['title', 'editor', 'thumbnail'],
    taxonomies: [],
    has_archive: true,
    has_archive_slug: '',
    rewrite: {
      permalink_rewrite: 'post_type_key',
      slug: '',
      feeds: false,
      pages: true,
      with_front: true,
    },
    query_var: 'post_type_key',
    query_var_name: '',
    can_export: true,
    delete_with_user: false,
    register_meta_box_cb: '',
    enter_title_here: '',
  };
}

// === Main export ===

export function exportToACF(entities: Entity[], overrides?: ExportOverrides): unknown[] {
  const result: unknown[] = [];

  // Classify entities
  const taxEntities = entities.filter(isTaxonomyEntity);
  const normalEntities = entities.filter((e) => !isTaxonomyEntity(e));

  // For each normal entity: one field group per entity.groups entry
  for (const entity of normalEntities) {
    const slug = entitySlug(entity, overrides);
    const groupDefaults = getDefaultGroupConfig();

    for (const [groupIdx, group] of entity.groups.entries()) {
      const nonTaxFields = group.fields.filter(
        (f) => !(f.type.kind === 'ref' && f.type.cardinality === 'taxonomy')
      );
      if (nonTaxFields.length === 0) continue;

      const fieldGroup: ACFFieldGroup = {
        key: group.key || `group_${idToKey(group.id)}`,
        title: group.title,
        fields: nonTaxFields.map((f) => fieldToACF(f, entities, overrides)),
        location: [[{ param: 'post_type', operator: '==', value: slug }]],
        menu_order: groupIdx,
        position: (group.config?.position as string) ?? (groupDefaults.position as string),
        style: (group.config?.style as string) ?? (groupDefaults.style as string),
        label_placement: (group.config?.label_placement as string) ?? (groupDefaults.label_placement as string),
        instruction_placement: (group.config?.instruction_placement as string) ?? (groupDefaults.instruction_placement as string),
        hide_on_screen: serializeHideOnScreen(group.config?.hide_on_screen),
        active: true,
        description: (group.config?.description as string) ?? '',
        show_in_rest: (group.config?.show_in_rest as number) ?? 0,
      };
      result.push(fieldGroup);
    }
  }

  // For each taxonomy entity: taxonomy definition
  for (const taxEntity of taxEntities) {
    const objectTypes = normalEntities
      .filter((e) =>
        allFields(e).some(
          (f) => f.type.kind === 'ref' && f.type.cardinality === 'taxonomy' && f.type.target === taxEntity.id
        )
      )
      .map((e) => entitySlug(e, overrides));

    result.push(taxonomyToACF(taxEntity, objectTypes.length > 0 ? objectTypes : ['post'], overrides));
  }

  // Post type definitions for normal entities (skip built-in WP types)
  for (const entity of normalEntities) {
    const slug = entitySlug(entity, overrides);
    if (!WP_BUILTIN_TYPES.has(slug)) {
      result.push(postTypeToACF(entity, overrides));
    }
  }

  return result;
}

export function downloadJSON(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 4);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
