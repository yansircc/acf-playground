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
  | { kind: 'atom'; subtype: AtomSubtype; choices?: string[] }
  | { kind: 'repeat'; fields: Field[] }
  | { kind: 'ref'; target: string; cardinality: '1' | 'n' | 'taxonomy' };

export type Field = {
  id: string;
  name: string;
  type: FieldType;
};

export type Entity = {
  id: string;
  name: string;
  fields: Field[];
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
