import { describe, expect, it } from 'vitest';
import { importACF } from '../src/lib/acf-import';

describe('importACF', () => {
  it('ignores numeric conditional_logic flags from ACF exports', () => {
    const state = importACF([
      {
        key: 'post_type_product',
        title: 'Product',
        post_type: 'product',
      },
      {
        key: 'group_product',
        title: 'Product',
        location: [[{ param: 'post_type', operator: '==', value: 'product' }]],
        fields: [
          {
            key: 'field_status',
            label: 'Status',
            name: 'status',
            type: 'select',
            choices: {
              enabled: 'Enabled',
            },
            conditional_logic: 1,
          },
        ],
      },
    ] as any[]);

    expect(state.entities).toHaveLength(1);
    expect(state.entities[0].groups[0].fields).toHaveLength(1);
    expect(state.entities[0].groups[0].fields[0].config?.conditional_logic).toBeUndefined();
  });
});
