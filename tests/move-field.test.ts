import { describe, it, expect } from 'vitest';
import { computeMoveIndex } from '../src/lib/field-dnd';

// === A. computeMoveIndex 纯函数测试 ===
describe('computeMoveIndex', () => {
  it('向下跳: from=0, target=2, below, total=4 → 2', () => {
    expect(computeMoveIndex(0, 2, 'below', 4)).toBe(2);
  });

  it('向下但 above: from=0, target=2, above, total=4 → 1', () => {
    expect(computeMoveIndex(0, 2, 'above', 4)).toBe(1);
  });

  it('移到首位: from=3, target=0, above, total=4 → 0', () => {
    expect(computeMoveIndex(3, 0, 'above', 4)).toBe(0);
  });

  it('移到末位: from=0, target=3, below, total=4 → 3', () => {
    expect(computeMoveIndex(0, 3, 'below', 4)).toBe(3);
  });

  it('向上: from=2, target=1, above, total=4 → 1', () => {
    expect(computeMoveIndex(2, 1, 'above', 4)).toBe(1);
  });

  it('自己→no-op: from=1, target=1, above, total=3 → -1', () => {
    expect(computeMoveIndex(1, 1, 'above', 3)).toBe(-1);
  });

  it('相邻 above→实际不动: from=1, target=2, above, total=3 → -1', () => {
    expect(computeMoveIndex(1, 2, 'above', 3)).toBe(-1);
  });

  it('越界 fromIndex → -1', () => {
    expect(computeMoveIndex(-1, 2, 'above', 4)).toBe(-1);
    expect(computeMoveIndex(4, 2, 'above', 4)).toBe(-1);
  });

  it('越界 targetIndex → -1', () => {
    expect(computeMoveIndex(0, -1, 'above', 4)).toBe(-1);
    expect(computeMoveIndex(0, 4, 'above', 4)).toBe(-1);
  });
});

// === B. store.moveField 集成测试 ===
// 直接测试 splice 逻辑，不依赖 Svelte runtime
describe('moveField logic (splice)', () => {
  function makeFields(names: string[]) {
    return names.map((n, i) => ({
      id: `f${i}`,
      name: n,
      type: { kind: 'atom' as const, subtype: 'text' as const },
    }));
  }

  function moveField(fields: typeof retVal, fromIndex: number, toIndex: number) {
    const len = fields.length;
    if (fromIndex < 0 || fromIndex >= len) return;
    if (toIndex < 0 || toIndex >= len) return;
    if (fromIndex === toIndex) return;
    const [field] = fields.splice(fromIndex, 1);
    fields.splice(toIndex, 0, field);
  }

  let retVal = makeFields([]);

  it('向下: [A,B,C,D] move(0,2) → [B,C,A,D]', () => {
    const fields = makeFields(['A', 'B', 'C', 'D']);
    moveField(fields, 0, 2);
    expect(fields.map((f) => f.name)).toEqual(['B', 'C', 'A', 'D']);
  });

  it('向上: [A,B,C,D] move(3,1) → [A,D,B,C]', () => {
    const fields = makeFields(['A', 'B', 'C', 'D']);
    moveField(fields, 3, 1);
    expect(fields.map((f) => f.name)).toEqual(['A', 'D', 'B', 'C']);
  });

  it('首→末: [A,B,C,D] move(0,3) → [B,C,D,A]', () => {
    const fields = makeFields(['A', 'B', 'C', 'D']);
    moveField(fields, 0, 3);
    expect(fields.map((f) => f.name)).toEqual(['B', 'C', 'D', 'A']);
  });

  it('末→首: [A,B,C,D] move(3,0) → [D,A,B,C]', () => {
    const fields = makeFields(['A', 'B', 'C', 'D']);
    moveField(fields, 3, 0);
    expect(fields.map((f) => f.name)).toEqual(['D', 'A', 'B', 'C']);
  });

  it('no-op: fromIndex === toIndex', () => {
    const fields = makeFields(['A', 'B', 'C']);
    moveField(fields, 1, 1);
    expect(fields.map((f) => f.name)).toEqual(['A', 'B', 'C']);
  });

  it('越界: fromIndex 负数不改变数组', () => {
    const fields = makeFields(['A', 'B']);
    moveField(fields, -1, 0);
    expect(fields.map((f) => f.name)).toEqual(['A', 'B']);
  });

  it('越界: toIndex 超出长度不改变数组', () => {
    const fields = makeFields(['A', 'B']);
    moveField(fields, 0, 5);
    expect(fields.map((f) => f.name)).toEqual(['A', 'B']);
  });
});
