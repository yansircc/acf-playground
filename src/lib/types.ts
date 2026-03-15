// === 三原语类型系统 ===

// ACF 全部 Atom 字段类型
export type AtomSubtype =
  // Basic
  | 'text' | 'textarea' | 'number' | 'range' | 'email' | 'url' | 'password'
  // Content
  | 'image' | 'file' | 'wysiwyg' | 'oembed' | 'gallery'
  // Choice
  | 'select' | 'checkbox' | 'radio' | 'true_false'
  // jQuery
  | 'google_map' | 'date_picker' | 'date_time_picker' | 'time_picker' | 'color_picker'
  // Relational (Atom-like)
  | 'page_link' | 'user';

export type FieldType =
  | { kind: 'atom'; subtype: AtomSubtype }
  | { kind: 'repeat'; fields: Field[] }
  | { kind: 'ref'; target: string; cardinality: '1' | 'n' | 'taxonomy' };

export type Field = {
  id: string;
  name: string;
  type: FieldType;
  config?: Record<string, unknown>;
};

export type FieldGroup = {
  id: string;
  title: string;
  fields: Field[];
  config?: Record<string, unknown>;
  key?: string; // preserved ACF key for round-trip
};

export type Entity = {
  id: string;
  name: string;
  groups: FieldGroup[];
  slug?: string; // preserved from ACF import for round-trip fidelity
  postTypeKey?: string; // original post_type_* key from ACF import
};

export type Position = { x: number; y: number };

// Store 中存储的数据层
export type EntityData = Record<string, unknown>[];

export type StoreState = {
  entities: Entity[];
  data: Record<string, EntityData>;
  positions: Record<string, Position>;
  selected: string | null;
};

// xyflow edge（派生，不存储）
export type DerivedEdge = {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
};

// === Helper functions ===

/** Get all top-level fields from an entity (across all groups) */
export function allFields(entity: Entity): Field[] {
  return entity.groups.flatMap(g => g.fields);
}

/** Recursively find a field by ID, including repeater sub-fields */
export function findFieldRecursive(entity: Entity, fieldId: string): Field | undefined {
  for (const group of entity.groups) {
    for (const f of group.fields) {
      if (f.id === fieldId) return f;
      if (f.type.kind === 'repeat') {
        const sub = f.type.fields.find(sf => sf.id === fieldId);
        if (sub) return sub;
      }
    }
  }
}
