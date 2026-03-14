import type { Entity, Field } from './types';

// === WP Reserved Slugs ===

export const WP_RESERVED_SLUGS = new Set([
  // Built-in post types
  'post', 'page', 'attachment', 'revision', 'nav_menu_item',
  // Built-in taxonomies
  'category', 'tag', 'post_tag', 'nav_menu', 'link_category', 'post_format',
  // WP rewrite high-risk
  'action', 'author', 'order', 'theme', 'type',
]);

export const WP_BUILTIN_TYPES = new Set([
  'post', 'page', 'attachment', 'revision', 'nav_menu_item',
]);

// === Taxonomy Detection ===

/** True taxonomy: self-ref with cardinality === 'taxonomy' */
export function isTaxonomyEntity(entity: Entity): boolean {
  return entity.fields.some(
    (f) => f.type.kind === 'ref' && f.type.target === entity.id && f.type.cardinality === 'taxonomy',
  );
}

// === Slug / Name Normalization ===

/** Normalize entity slug (post_type or taxonomy key) — ASCII-only, deduped, reserved-word safe */
export function normalizeEntitySlug(
  raw: string,
  maxLen: number,
  usedSlugs: Set<string>,
  fallbackBase: string = 'item',
): string {
  let slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, maxLen);
  if (!slug) slug = fallbackBase;
  if (WP_RESERVED_SLUGS.has(slug)) slug = `custom_${slug}`.slice(0, maxLen);
  let candidate = slug;
  let i = 2;
  while (usedSlugs.has(candidate)) {
    candidate = `${slug.slice(0, maxLen - String(i).length - 1)}_${i}`;
    i++;
  }
  usedSlugs.add(candidate);
  return candidate;
}

/** Normalize ACF field name — ASCII-only, sibling-deduped */
export function normalizeFieldName(
  raw: string,
  usedNames: Set<string>,
): string {
  let name = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  if (!name) name = 'field';
  let candidate = name;
  let i = 2;
  while (usedNames.has(candidate)) {
    candidate = `${name}_${i}`;
    i++;
  }
  usedNames.add(candidate);
  return candidate;
}

// === Export Validation ===

export type IdentifierIssue = {
  id: string;
  name: string;
  scope: 'entity' | 'field';
  issues: ('non_ascii' | 'too_long' | 'conflict' | 'reserved' | 'empty')[];
};

const NON_ASCII_RE = /[^\x00-\x7F]/;

/** Compute the snake_case name as acf-export.ts toSnake() would — preserves CJK for issue detection */
export function toSnakeCheck(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '_')
    .replace(/^_|_$/g, '');
}

/** Check all entity slugs and field names for export issues */
export function validateExportIdentifiers(entities: Entity[]): IdentifierIssue[] {
  const issues: IdentifierIssue[] = [];
  const usedSlugs = new Set<string>();

  // Check entity slugs
  for (const entity of entities) {
    const slug = entity.slug || toSnakeCheck(entity.name);
    const entityIssues: IdentifierIssue['issues'] = [];

    if (!slug) entityIssues.push('empty');
    if (NON_ASCII_RE.test(slug)) entityIssues.push('non_ascii');

    const isTax = isTaxonomyEntity(entity);
    const maxLen = isTax ? 32 : 20;
    if (slug.length > maxLen) entityIssues.push('too_long');

    if (WP_RESERVED_SLUGS.has(slug)) entityIssues.push('reserved');

    if (usedSlugs.has(slug)) {
      entityIssues.push('conflict');
    } else {
      usedSlugs.add(slug);
    }

    if (entityIssues.length > 0) {
      issues.push({ id: entity.id, name: entity.name, scope: 'entity', issues: entityIssues });
    }
  }

  // Check field names — recursive to handle nested repeaters (possible via ACF import)
  for (const entity of entities) {
    validateFieldScope(entity.fields, issues);
  }

  return issues;
}

/** Validate a scope of sibling fields, recursing into repeaters */
function validateFieldScope(fields: Field[], issues: IdentifierIssue[]): void {
  const usedNames = new Set<string>();
  for (const field of fields) {
    const fname = toSnakeCheck(field.name);
    const fieldIssues: IdentifierIssue['issues'] = [];

    if (!fname) fieldIssues.push('empty');
    if (NON_ASCII_RE.test(fname)) fieldIssues.push('non_ascii');
    if (usedNames.has(fname)) {
      fieldIssues.push('conflict');
    } else {
      usedNames.add(fname);
    }

    if (fieldIssues.length > 0) {
      issues.push({ id: field.id, name: field.name, scope: 'field', issues: fieldIssues });
    }

    // Recurse into repeater sub-fields (each repeater has its own namespace)
    if (field.type.kind === 'repeat') {
      validateFieldScope(field.type.fields, issues);
    }
  }
}

// === Field Collection ===

export function collectAllFields(fields: Field[]): Field[] {
  return fields.flatMap((f) =>
    f.type.kind === 'repeat' ? [f, ...collectAllFields(f.type.fields)] : [f],
  );
}
