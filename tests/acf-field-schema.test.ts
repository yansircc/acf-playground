import { describe, it, expect } from 'vitest';
import { getSchemaForField, getDefaultConfig, getDefaultGroupConfig, setConfigValue } from '../src/lib/acf-field-schema';

describe('getSchemaForField', () => {
  it('returns schema for text atom', () => {
    const schema = getSchemaForField({ type: { kind: 'atom', subtype: 'text' } });
    const keys = schema.map(p => p.key);
    expect(keys).toContain('required');
    expect(keys).toContain('instructions');
    expect(keys).toContain('default_value');
    expect(keys).toContain('placeholder');
    expect(keys).toContain('maxlength');
  });

  it('returns schema for number atom with min/max/step', () => {
    const schema = getSchemaForField({ type: { kind: 'atom', subtype: 'number' } });
    const keys = schema.map(p => p.key);
    expect(keys).toContain('min');
    expect(keys).toContain('max');
    expect(keys).toContain('step');
  });

  it('returns schema for select with choices', () => {
    const schema = getSchemaForField({ type: { kind: 'atom', subtype: 'select' } });
    const keys = schema.map(p => p.key);
    expect(keys).toContain('choices');
    expect(keys).toContain('allow_null');
    expect(keys).toContain('multiple');
  });

  it('returns schema for repeater', () => {
    const schema = getSchemaForField({ type: { kind: 'repeat', fields: [] } });
    const keys = schema.map(p => p.key);
    expect(keys).toContain('min');
    expect(keys).toContain('max');
    expect(keys).toContain('layout');
    expect(keys).toContain('button_label');
  });

  it('returns schema for relationship', () => {
    const schema = getSchemaForField({ type: { kind: 'ref', target: '', cardinality: 'n' } });
    const keys = schema.map(p => p.key);
    expect(keys).toContain('filters');
    expect(keys).toContain('elements');
    expect(keys).toContain('allow_null');
  });

  it('returns schema for post_object', () => {
    const schema = getSchemaForField({ type: { kind: 'ref', target: '', cardinality: '1' } });
    const keys = schema.map(p => p.key);
    expect(keys).toContain('allow_null');
    expect(keys).toContain('multiple');
  });

  it('returns schema for taxonomy ref', () => {
    const schema = getSchemaForField({ type: { kind: 'ref', target: '', cardinality: 'taxonomy' } });
    const keys = schema.map(p => p.key);
    expect(keys).toContain('field_type');
    expect(keys).toContain('add_term');
    expect(keys).toContain('save_terms');
  });

  it('all atom subtypes have a schema', () => {
    const subtypes = [
      'text', 'textarea', 'number', 'range', 'email', 'url', 'password',
      'image', 'file', 'wysiwyg', 'oembed', 'gallery',
      'select', 'checkbox', 'radio', 'true_false',
      'date_picker', 'date_time_picker', 'time_picker', 'color_picker',
      'page_link', 'google_map', 'user',
    ] as const;
    for (const subtype of subtypes) {
      const schema = getSchemaForField({ type: { kind: 'atom', subtype } });
      expect(schema.length).toBeGreaterThan(0);
    }
  });
});

describe('getDefaultConfig', () => {
  it('returns config with wrapper', () => {
    const config = getDefaultConfig({ type: { kind: 'atom', subtype: 'text' } });
    expect(config.wrapper).toEqual({ width: '', class: '', id: '' });
    expect(config.required).toBe(0);
    expect(config.instructions).toBe('');
  });

  it('returns default values for number', () => {
    const config = getDefaultConfig({ type: { kind: 'atom', subtype: 'number' } });
    expect(config.min).toBe('');
    expect(config.max).toBe('');
    expect(config.step).toBe('');
  });
});

describe('getDefaultGroupConfig', () => {
  it('returns group config with defaults', () => {
    const config = getDefaultGroupConfig();
    expect(config.position).toBe('normal');
    expect(config.style).toBe('default');
    expect(config.label_placement).toBe('top');
    expect(config.hide_on_screen).toEqual([]);
  });
});

describe('setConfigValue', () => {
  it('sets a top-level value', () => {
    const config = { required: 0 };
    const next = setConfigValue(config, { key: 'required', label: '', type: 'toggle', default: 0 }, 1);
    expect(next.required).toBe(1);
  });

  it('sets a nested value', () => {
    const config = { wrapper: { width: '', class: '', id: '' } };
    const next = setConfigValue(config,
      { key: 'width', label: '', type: 'text', default: '', nested: 'wrapper' },
      '50%'
    );
    expect((next.wrapper as Record<string, unknown>).width).toBe('50%');
    expect((next.wrapper as Record<string, unknown>).class).toBe('');
  });
});
