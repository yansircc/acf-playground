import { describe, it, expect } from 'vitest';
import { exportToACF } from '../src/lib/acf-export';
import { importACF } from '../src/lib/acf-import';
import type { Entity } from '../src/lib/types';

function makeEntity(name: string, id: string, fields: any[]): Entity {
  return {
    id,
    name,
    groups: [{
      id,
      title: name,
      fields,
    }],
  };
}

describe('export → import → export round-trip', () => {
  it('round-trips a simple entity with text and number fields', () => {
    const entities: Entity[] = [
      makeEntity('Product', 'ent1', [
        { id: 'f1', name: 'Title', type: { kind: 'atom', subtype: 'text' } },
        { id: 'f2', name: 'Price', type: { kind: 'atom', subtype: 'number' } },
      ]),
    ];

    const exported1 = exportToACF(entities);
    const imported = importACF(exported1 as any[]);
    const exported2 = exportToACF(imported.entities);

    // Compare field groups (first items)
    const fg1 = (exported1[0] as any);
    const fg2 = (exported2[0] as any);
    expect(fg2.title).toBe(fg1.title);
    expect(fg2.fields.length).toBe(fg1.fields.length);
    for (let i = 0; i < fg1.fields.length; i++) {
      expect(fg2.fields[i].type).toBe(fg1.fields[i].type);
      expect(fg2.fields[i].label).toBe(fg1.fields[i].label);
    }
  });

  it('round-trips select field with choices', () => {
    const entities: Entity[] = [
      makeEntity('Product', 'ent1', [
        {
          id: 'f1', name: 'Status', type: { kind: 'atom', subtype: 'select' },
          config: { choices: ['Active', 'Inactive', 'Draft'] },
        },
      ]),
    ];

    const exported1 = exportToACF(entities);
    const imported = importACF(exported1 as any[]);
    const exported2 = exportToACF(imported.entities);

    const fg1 = (exported1[0] as any);
    const fg2 = (exported2[0] as any);
    expect(fg2.fields[0].choices).toEqual(fg1.fields[0].choices);
  });

  it('round-trips multi-group entity', () => {
    const entities: Entity[] = [{
      id: 'ent1',
      name: 'Product',
      groups: [
        {
          id: 'g1', title: 'Basic Info', fields: [
            { id: 'f1', name: 'Title', type: { kind: 'atom', subtype: 'text' } },
          ],
        },
        {
          id: 'g2', title: 'Pricing', fields: [
            { id: 'f2', name: 'Price', type: { kind: 'atom', subtype: 'number' } },
          ],
        },
      ],
    }];

    const exported1 = exportToACF(entities);
    // Should have 2 field groups + 1 post type
    const fieldGroups = (exported1 as any[]).filter(i => (i.key as string).startsWith('group_'));
    expect(fieldGroups.length).toBe(2);
    expect(fieldGroups[0].title).toBe('Basic Info');
    expect(fieldGroups[1].title).toBe('Pricing');
  });

  it('exported JSON does not contain _resolved metadata', () => {
    const entities: Entity[] = [
      makeEntity('Product', 'ent1', [
        {
          id: 'f1', name: 'Title', type: { kind: 'atom', subtype: 'text' },
          config: {
            conditional_logic: [[{ field: 'f2', operator: '==', value: 'yes', _resolved: true }]],
          },
        },
        { id: 'f2', name: 'Active', type: { kind: 'atom', subtype: 'true_false' } },
      ]),
    ];

    const exported = exportToACF(entities);
    const json = JSON.stringify(exported);
    expect(json).not.toContain('_resolved');
  });
});
