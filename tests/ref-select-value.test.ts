/**
 * Smoke test: ref(1) select 值类型回归
 *
 * Bug 背景：Svelte 5 的 <select value={x}> 用 === 比较 option value。
 * 如果 option value 是 number 而 select value 是 string（或反之），
 * 不会命中，导致 ref dropdown 显示为空。
 *
 * 修复：所有 <option value={String(index)}> 统一为 string，
 * 数据层 ref 值保持 number，组件层做 String() 转换。
 *
 * 本测试验证 fixture 的数据契约：
 * 1. ref(1) 字段的 data 值是 number 类型
 * 2. String(data值) 能匹配目标实体的行索引
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

interface FieldType {
  kind: 'atom' | 'repeat' | 'ref';
  subtype?: string;
  target?: string;
  cardinality?: '1' | 'n' | 'taxonomy';
  fields?: Field[];
}

interface Field {
  id: string;
  name: string;
  type: FieldType;
}

interface Entity {
  id: string;
  name: string;
  fields: Field[];
}

interface StoreState {
  entities: Entity[];
  data: Record<string, Record<string, unknown>[]>;
  positions: Record<string, { x: number; y: number }>;
  selected: string | null;
}

const __dirname = dirname(fileURLToPath(import.meta.url));

const fixture: StoreState = JSON.parse(
  readFileSync(join(__dirname, '../static/fixtures/school-demo.json'), 'utf-8')
);

describe('school-demo fixture ref(1) 数据契约', () => {
  // Collect all ref(1) field + data pairs
  const refCases: { entityName: string; fieldName: string; entityId: string; fieldId: string; targetId: string }[] = [];

  for (const entity of fixture.entities) {
    for (const field of entity.fields) {
      if (field.type.kind === 'ref' && field.type.cardinality === '1' && field.type.target) {
        refCases.push({
          entityName: entity.name,
          fieldName: field.name,
          entityId: entity.id,
          fieldId: field.id,
          targetId: field.type.target,
        });
      }
    }
  }

  it('fixture 中存在 ref(1) 字段可供测试', () => {
    expect(refCases.length).toBeGreaterThan(0);
  });

  for (const { entityName, fieldName, entityId, fieldId, targetId } of refCases) {
    describe(`${entityName}.${fieldName} → ${targetId}`, () => {
      const rows = fixture.data[entityId] ?? [];
      const targetRows = fixture.data[targetId] ?? [];

      for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
        const value = rows[rowIdx][fieldId];

        it(`row[${rowIdx}] 值 ${JSON.stringify(value)} 是 number 类型`, () => {
          // ref(1) 的 data 值必须是 number（行索引）
          expect(typeof value).toBe('number');
        });

        it(`row[${rowIdx}] String("${value}") 匹配目标实体的有效行索引`, () => {
          // 模拟组件的 String 转换逻辑
          const strValue = String(value);
          const validIndices = targetRows.map((_, i) => String(i));
          expect(validIndices).toContain(strValue);
        });
      }
    });
  }

  // Also test repeater sub-fields with ref(1)
  describe('repeater 内 ref(1) 子字段', () => {
    const subRefCases: { entityName: string; repeaterName: string; fieldName: string; entityId: string; repeaterId: string; fieldId: string; targetId: string }[] = [];

    for (const entity of fixture.entities) {
      for (const field of entity.fields) {
        if (field.type.kind === 'repeat' && field.type.fields) {
          for (const sub of field.type.fields) {
            if (sub.type.kind === 'ref' && sub.type.cardinality === '1' && sub.type.target) {
              subRefCases.push({
                entityName: entity.name,
                repeaterName: field.name,
                fieldName: sub.name,
                entityId: entity.id,
                repeaterId: field.id,
                fieldId: sub.id,
                targetId: sub.type.target,
              });
            }
          }
        }
      }
    }

    it('fixture 中存在 repeater 内 ref(1) 子字段', () => {
      expect(subRefCases.length).toBeGreaterThan(0);
    });

    for (const { entityName, repeaterName, fieldName, entityId, repeaterId, fieldId, targetId } of subRefCases) {
      describe(`${entityName}.${repeaterName}.${fieldName} → ${targetId}`, () => {
        const rows = fixture.data[entityId] ?? [];
        const targetRows = fixture.data[targetId] ?? [];

        for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
          const repeatData = rows[rowIdx][repeaterId];
          if (!Array.isArray(repeatData)) continue;

          for (let rIdx = 0; rIdx < repeatData.length; rIdx++) {
            const value = repeatData[rIdx][fieldId];

            it(`row[${rowIdx}].repeat[${rIdx}] 值 ${JSON.stringify(value)} 是 number`, () => {
              expect(typeof value).toBe('number');
            });

            it(`row[${rowIdx}].repeat[${rIdx}] String("${value}") 匹配有效行索引`, () => {
              const strValue = String(value);
              const validIndices = targetRows.map((_, i) => String(i));
              expect(validIndices).toContain(strValue);
            });
          }
        }
      });
    }
  });
});
