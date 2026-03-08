// === 三原语类型系统 ===

export type AtomSubtype = 'text' | 'number' | 'image' | 'url' | 'email' | 'textarea';

export type FieldType =
  | { kind: 'atom'; subtype: AtomSubtype }
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
