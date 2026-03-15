import { describe, it, expect } from 'vitest';
import { exportToACF } from '../src/lib/acf-export';
import type { Entity } from '../src/lib/types';

describe('export validation', () => {
  it('exports entities with no config same as default', () => {
    const entities: Entity[] = [{
      id: 'ent1',
      name: 'Product',
      groups: [{
        id: 'ent1',
        title: 'Product',
        fields: [
          { id: 'f1', name: 'Title', type: { kind: 'atom', subtype: 'text' } },
        ],
      }],
    }];

    const exported = exportToACF(entities);
    const fg = exported[0] as any;
    expect(fg.fields[0].type).toBe('text');
    expect(fg.fields[0].required).toBe(0);
    expect(fg.fields[0].wrapper).toEqual({ width: '', class: '', id: '' });
    expect(fg.fields[0].default_value).toBe('');
    expect(fg.fields[0].placeholder).toBe('');
  });

  it('exports entities with custom config', () => {
    const entities: Entity[] = [{
      id: 'ent1',
      name: 'Product',
      groups: [{
        id: 'ent1',
        title: 'Product',
        fields: [
          {
            id: 'f1', name: 'Title',
            type: { kind: 'atom', subtype: 'text' },
            config: { required: 1, placeholder: 'Enter title...', instructions: 'Required field' },
          },
        ],
      }],
    }];

    const exported = exportToACF(entities);
    const fg = exported[0] as any;
    expect(fg.fields[0].required).toBe(1);
    expect(fg.fields[0].placeholder).toBe('Enter title...');
    expect(fg.fields[0].instructions).toBe('Required field');
  });
});
