import { describe, it, expect } from 'vitest';
import { normalizeStoreState } from '../src/lib/store-import';

describe('normalizeStoreState', () => {
  it('migrates entity.fields to entity.groups', () => {
    const legacy: Record<string, unknown> = {
      entities: [{
        id: 'abc',
        name: 'Product',
        fields: [
          { id: 'f1', name: 'title', type: { kind: 'atom', subtype: 'text' } },
          { id: 'f2', name: 'price', type: { kind: 'atom', subtype: 'number' } },
        ],
      }],
      data: {},
      positions: {},
      selected: null,
    };

    const result = normalizeStoreState(legacy);
    const entity = (result.entities as any[])[0];
    expect(entity.groups).toBeDefined();
    expect(entity.fields).toBeUndefined();
    expect(entity.groups).toHaveLength(1);
    expect(entity.groups[0].id).toBe('abc'); // group.id === entity.id
    expect(entity.groups[0].title).toBe('Product');
    expect(entity.groups[0].fields).toHaveLength(2);
  });

  it('does not modify already-migrated entities', () => {
    const modern: Record<string, unknown> = {
      entities: [{
        id: 'abc',
        name: 'Product',
        groups: [{
          id: 'abc',
          title: 'Product',
          fields: [{ id: 'f1', name: 'title', type: { kind: 'atom', subtype: 'text' } }],
        }],
      }],
      data: {},
      positions: {},
      selected: null,
    };

    const result = normalizeStoreState(modern);
    const entity = (result.entities as any[])[0];
    expect(entity.groups).toHaveLength(1);
    expect(entity.groups[0].fields).toHaveLength(1);
  });

  it('multiple normalizations are idempotent', () => {
    const legacy: Record<string, unknown> = {
      entities: [{
        id: 'abc',
        name: 'Product',
        fields: [{ id: 'f1', name: 'title', type: { kind: 'atom', subtype: 'text' } }],
      }],
      data: {},
      positions: {},
      selected: null,
    };

    const first = normalizeStoreState(legacy);
    const second = normalizeStoreState(first);
    expect(second).toEqual(first);
  });

  it('handles empty entities array', () => {
    const result = normalizeStoreState({ entities: [], data: {}, positions: {}, selected: null });
    expect((result.entities as any[])).toHaveLength(0);
  });
});
