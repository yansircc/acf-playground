import type { Field, EntityData } from './types';

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateRefValue(
  field: Field,
  allData: Record<string, EntityData>
): unknown {
  if (field.type.kind !== 'ref') return '';
  const targetId = field.type.target;
  if (!targetId) return '';
  const targetRows = allData[targetId] ?? [];
  if (targetRows.length === 0) return field.type.cardinality === 'n' ? [] : '';

  if (field.type.cardinality === 'n') {
    const count = Math.min(randInt(1, 3), targetRows.length);
    const indices = Array.from({ length: targetRows.length }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = randInt(0, i);
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices.slice(0, count).sort((a, b) => a - b);
  }

  return randInt(0, targetRows.length - 1);
}
