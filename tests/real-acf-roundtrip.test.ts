import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { exportToACF } from '../src/lib/acf-export';
import { importACF } from '../src/lib/acf-import';

// Load the real ACF export file
const acfJson = JSON.parse(
  readFileSync(resolve('/Users/yansir/Downloads/acf-export (27).json'), 'utf-8')
);

/**
 * Normalize an ACF export array for comparison:
 * - Sort items by key for stable ordering
 * - Remove properties that are legitimately different between original ACF export and our re-export
 *   (like labels, advanced config, capabilities — things we don't model)
 */
function classifyItems(items: any[]) {
  const groups: any[] = [];
  const taxonomies: any[] = [];
  const postTypes: any[] = [];
  for (const item of items) {
    const key = item.key as string;
    if (key.startsWith('group_')) groups.push(item);
    else if (key.startsWith('taxonomy_')) taxonomies.push(item);
    else if (key.startsWith('post_type_')) postTypes.push(item);
  }
  return { groups, taxonomies, postTypes };
}

/** Extract field-level semantic data for comparison */
function extractFieldSignature(field: any): any {
  return {
    type: field.type,
    label: field.label,
    name: field.name,
    required: field.required ?? 0,
    instructions: field.instructions ?? '',
    // Only compare choices if present
    ...(field.choices ? { choices: field.choices } : {}),
    // Sub-fields for repeaters
    ...(field.sub_fields ? { sub_fields: field.sub_fields.map(extractFieldSignature) } : {}),
  };
}

/** Extract group-level semantic data */
function extractGroupSignature(group: any) {
  return {
    title: group.title,
    position: group.position,
    style: group.style,
    label_placement: group.label_placement,
    instruction_placement: group.instruction_placement,
    location_slug: group.location?.[0]?.[0]?.value,
    fields: (group.fields || []).map(extractFieldSignature),
  };
}

describe('Real ACF file round-trip idempotency', () => {
  // Step 1: Import the original ACF JSON
  const storeState = importACF(acfJson);

  // Step 2: Export from our store
  const export1 = exportToACF(storeState.entities);

  // Step 3: Re-import our export
  const storeState2 = importACF(export1 as any[]);

  // Step 4: Re-export
  const export2 = exportToACF(storeState2.entities);

  it('imports the correct number of entities', () => {
    // 1 product entity + 4 taxonomy entities = 5
    expect(storeState.entities.length).toBe(5);
  });

  it('preserves all field groups on import', () => {
    const product = storeState.entities.find(e => e.slug === 'product');
    expect(product).toBeDefined();
    // 3 field groups: 产品通用字段, 领带专属字段, 丝巾手帕专属字段
    expect(product!.groups.length).toBe(3);
    expect(product!.groups.map(g => g.title)).toEqual([
      '产品通用字段',
      '领带专属字段',
      '丝巾手帕专属字段',
    ]);
  });

  it('preserves field count per group', () => {
    const product = storeState.entities.find(e => e.slug === 'product');
    expect(product!.groups[0].fields.length).toBe(8 + 4); // 8 fields + 4 taxonomy refs
    expect(product!.groups[1].fields.length).toBe(3);
    expect(product!.groups[2].fields.length).toBe(2);
  });

  it('preserves taxonomy entities', () => {
    const taxNames = storeState.entities
      .filter(e => e.slug && ['product_category', 'design_pattern', 'fabric_material', 'fabric_craft'].includes(e.slug))
      .map(e => e.name);
    expect(taxNames.sort()).toEqual(['产品品类', '花型', '面料工艺', '面料材质'].sort());
  });

  it('export1 has correct item counts', () => {
    const { groups, taxonomies, postTypes } = classifyItems(export1 as any[]);
    // 3 field groups (one per group in product)
    expect(groups.length).toBe(3);
    // 4 taxonomies
    expect(taxonomies.length).toBe(4);
    // 1 post type
    expect(postTypes.length).toBe(1);
  });

  it('export1 → import → export2: field groups are identical', () => {
    const groups1 = classifyItems(export1 as any[]).groups
      .map(extractGroupSignature)
      .sort((a: any, b: any) => a.title.localeCompare(b.title));
    const groups2 = classifyItems(export2 as any[]).groups
      .map(extractGroupSignature)
      .sort((a: any, b: any) => a.title.localeCompare(b.title));

    expect(groups2).toEqual(groups1);
  });

  it('export1 → import → export2: taxonomy count is identical', () => {
    const tax1 = classifyItems(export1 as any[]).taxonomies.length;
    const tax2 = classifyItems(export2 as any[]).taxonomies.length;
    expect(tax2).toBe(tax1);
  });

  it('export1 → import → export2: post type count is identical', () => {
    const pt1 = classifyItems(export1 as any[]).postTypes.length;
    const pt2 = classifyItems(export2 as any[]).postTypes.length;
    expect(pt2).toBe(pt1);
  });

  it('exported JSON does not contain _resolved', () => {
    const json1 = JSON.stringify(export1);
    const json2 = JSON.stringify(export2);
    expect(json1).not.toContain('_resolved');
    expect(json2).not.toContain('_resolved');
  });

  it('export preserves choices for select fields', () => {
    const groups1 = classifyItems(export1 as any[]).groups;
    const generalGroup = groups1.find((g: any) => g.title === '产品通用字段');
    expect(generalGroup).toBeDefined();

    // Find base_pattern field by label
    const basePattern = generalGroup.fields.find((f: any) => f.label === '底纹');
    expect(basePattern).toBeDefined();
    expect(basePattern.choices).toBeDefined();
    // Verify choices round-tripped correctly
    expect(Object.values(basePattern.choices)).toContain('缎纹底纹');
    expect(Object.values(basePattern.choices)).toContain('平纹底纹');
  });

  it('export preserves field config (required, instructions, placeholder)', () => {
    const groups1 = classifyItems(export1 as any[]).groups;
    const generalGroup = groups1.find((g: any) => g.title === '产品通用字段');

    const gallery = generalGroup.fields.find((f: any) => f.label === '产品图集');
    expect(gallery).toBeDefined();
    expect(gallery.required).toBe(1);
    expect(gallery.instructions).toBe('正面、背面、细节等多角度产品图');

    const colorName = generalGroup.fields.find((f: any) => f.label === '颜色名称');
    expect(colorName).toBeDefined();
    expect(colorName.placeholder).toBe('Navy Blue');
  });

  it('export preserves group-level position setting', () => {
    const groups1 = classifyItems(export1 as any[]).groups;
    // All 3 groups have position: acf_after_title in the original
    for (const g of groups1) {
      expect(g.position).toBe('acf_after_title');
    }
  });
});
