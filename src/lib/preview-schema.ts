import type { Field, Entity, EntityData } from '$lib/types';
import type { ProjectedField, ProjectedEntity } from '$lib/template-generator';

/** HTML 属性转义 */
export function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 将 Field 投影为 LLM 可读的语义结构（去掉 UUID） */
function projectField(f: Field, entities: Entity[]): ProjectedField {
  if (f.type.kind === 'atom') {
    return { name: f.name, type: f.type.subtype };
  }
  if (f.type.kind === 'repeat') {
    return {
      name: f.name,
      type: 'repeat',
      subFields: f.type.fields.map((sf) => projectField(sf, entities)),
    };
  }
  // ref
  const target = entities.find((e) => e.id === (f.type as { target: string }).target);
  return {
    name: f.name,
    type: 'ref',
    cardinality: (f.type as { cardinality: string }).cardinality,
    target: target?.name ?? '',
  };
}

/** Schema 语义投影：entities → { name, fields[] } */
export function projectSchema(entities: Entity[]): { entities: ProjectedEntity[] } {
  return {
    entities: entities.map((e) => ({
      name: e.name,
      fields: e.fields.map((f) => projectField(f, entities)),
    })),
  };
}

/** 解析 LLM API 返回的实体内容 */
export function parseEntityContents(
  json: { pages: { entity_name: string; listing_html: string; detail_html: string }[] },
): Record<string, { listing: string; detail: string }> {
  const contents: Record<string, { listing: string; detail: string }> = {};
  for (const page of json.pages ?? []) {
    contents[page.entity_name] = {
      listing: page.listing_html,
      detail: page.detail_html,
    };
  }
  return contents;
}

/** 构建注入 iframe 的 schema（保留 id + kind + ref 信息） */
export function buildClientSchema(entities: Entity[]) {
  return entities.map((e) => ({
    id: e.id,
    name: e.name,
    fields: e.fields.map((f) => {
      const base: Record<string, unknown> = { id: f.id, name: f.name, kind: f.type.kind };
      if (f.type.kind === 'atom') {
        base.subtype = f.type.subtype;
      }
      if (f.type.kind === 'ref') {
        base.target = f.type.target;
        base.cardinality = f.type.cardinality;
      }
      if (f.type.kind === 'repeat') {
        base.fields = f.type.fields.map((sf) => {
          const sub: Record<string, unknown> = { id: sf.id, name: sf.name, kind: sf.type.kind };
          if (sf.type.kind === 'ref') {
            sub.target = sf.type.target;
            sub.cardinality = sf.type.cardinality;
          }
          return sub;
        });
      }
      return base;
    }),
  }));
}

/** 构建注入 iframe 的数据快照 */
export function buildClientData(
  entities: Entity[],
  data: Record<string, EntityData>,
): Record<string, Record<string, unknown>[]> {
  const out: Record<string, Record<string, unknown>[]> = {};
  for (const entity of entities) {
    out[entity.id] = (data[entity.id] ?? [{}]).map((row) => ({ ...row }));
  }
  return out;
}
