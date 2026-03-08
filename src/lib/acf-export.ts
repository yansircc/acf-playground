import type { Entity, Field } from './types';

type ACFField = {
  key: string;
  label: string;
  name: string;
  type: string;
  instructions?: string;
  required?: number;
  sub_fields?: ACFField[];
  post_type?: string[];
  taxonomy?: string[];
  return_format?: string;
  min?: number;
  max?: number;
  [key: string]: unknown;
};

type ACFFieldGroup = {
  key: string;
  title: string;
  fields: ACFField[];
  location: Array<Array<{ param: string; operator: string; value: string }>>;
  active: boolean;
};

function fieldTypeToACF(field: Field): ACFField {
  const base: ACFField = {
    key: `field_${field.id.replace(/-/g, '')}`,
    label: field.name,
    name: field.name.toLowerCase().replace(/\s+/g, '_'),
    type: '',
  };

  const ft = field.type;
  switch (ft.kind) {
    case 'atom':
      base.type = ft.subtype;
      if (ft.subtype === 'image') {
        base.return_format = 'url';
      }
      break;

    case 'repeat':
      base.type = 'repeater';
      base.sub_fields = ft.fields.map(fieldTypeToACF);
      base.min = 0;
      base.max = 0;
      break;

    case 'ref':
      if (ft.cardinality === '1') {
        base.type = 'post_object';
        base.return_format = 'object';
      } else if (ft.cardinality === 'taxonomy') {
        base.type = 'taxonomy';
        base.taxonomy = [ft.target ? 'category' : 'category'];
        base.return_format = 'id';
      } else {
        base.type = 'relationship';
        base.return_format = 'object';
      }
      if (ft.target && ft.cardinality !== 'taxonomy') {
        base.post_type = ['post'];
      }
      break;
  }

  return base;
}

export function exportToACF(entities: Entity[]): ACFFieldGroup[] {
  return entities.map((entity) => ({
    key: `group_${entity.id.replace(/-/g, '')}`,
    title: entity.name,
    fields: entity.fields.map(fieldTypeToACF),
    location: [
      [
        {
          param: 'post_type',
          operator: '==',
          value: entity.name.toLowerCase().replace(/\s+/g, '_'),
        },
      ],
    ],
    active: true,
  }));
}

export function downloadJSON(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
