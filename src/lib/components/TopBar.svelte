<script lang="ts">
  import { store } from '$lib/store.svelte';
  import { exportToACF, downloadJSON } from '$lib/acf-export';
  import type { ExportOverrides } from '$lib/acf-export';
  import { readStoreFile } from '$lib/store-import';
  import {
    validateExportIdentifiers,
    normalizeEntitySlug,
    normalizeFieldName,
    isTaxonomyEntity,
    collectAllFields,
    toSnakeCheck,
  } from '$lib/wp-helpers';
  import type { Field } from '$lib/types';

  let fileInput: HTMLInputElement;
  let menuOpen = $state(false);
  let exporting = $state(false);

  function showToast(message: string) {
    const el = document.createElement('div');
    el.textContent = message;
    Object.assign(el.style, {
      position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
      background: '#323232', color: '#fff', padding: '10px 24px', borderRadius: '6px',
      fontSize: '14px', fontWeight: '500', zIndex: '9999', opacity: '0',
      transition: 'opacity 0.3s',
    });
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = '1'; });
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    }, 2500);
  }

  /** Build payload for /api/slugify — only entities/fields with issues */
  function buildSlugifyPayload(
    entities: typeof store.entities,
    entityIssueIds: Set<string>,
    fieldIssueIds: Set<string>,
  ) {
    return entities
      .filter((e) => entityIssueIds.has(e.id) || collectAllFields(e.fields).some((f) => fieldIssueIds.has(f.id)))
      .map((e) => ({
        id: e.id,
        name: e.name,
        isTaxonomy: isTaxonomyEntity(e),
        needSlug: entityIssueIds.has(e.id),
        fields: collectAllFields(e.fields)
          .filter((f) => fieldIssueIds.has(f.id))
          .map((f) => ({ id: f.id, name: f.name })),
      }));
  }

  /**
   * Build a usedNames set for a scope of sibling fields,
   * pre-populated with valid (non-issue) siblings' exported names.
   */
  function buildScopeUsedNames(fields: Field[], fieldIssueIds: Set<string>, overrides: ExportOverrides): Set<string> {
    const used = new Set<string>();
    for (const f of fields) {
      if (!fieldIssueIds.has(f.id)) {
        // This field is valid — its exported name is toSnakeCheck(f.name)
        const name = toSnakeCheck(f.name);
        if (name) used.add(name);
      } else if (overrides.fieldNames[f.id]) {
        // Already resolved in a prior pass — include it
        used.add(overrides.fieldNames[f.id]);
      }
    }
    return used;
  }

  /** Apply LLM results through normalize functions for safety */
  function applyLLMResult(
    llmEntities: Array<{ id: string; slug: string; fields: Array<{ id: string; name: string }> }>,
    entities: typeof store.entities,
    entityIssueIds: Set<string>,
    fieldIssueIds: Set<string>,
  ): ExportOverrides {
    const overrides: ExportOverrides = { entitySlugs: {}, fieldNames: {} };

    // Collect already-valid slugs into usedSlugs
    const usedSlugs = new Set<string>();
    for (const e of entities) {
      if (!entityIssueIds.has(e.id)) {
        const slug = e.slug || e.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
        if (slug) usedSlugs.add(slug);
      }
    }

    // Build a lookup from field id → LLM suggestion
    const llmFieldMap = new Map<string, string>();
    for (const llmE of llmEntities) {
      if (llmE.fields) {
        for (const llmF of llmE.fields) {
          if (fieldIssueIds.has(llmF.id) && llmF.name) {
            llmFieldMap.set(llmF.id, llmF.name);
          }
        }
      }
    }

    // Apply LLM entity slugs through normalizeEntitySlug
    for (const llmE of llmEntities) {
      if (entityIssueIds.has(llmE.id) && llmE.slug) {
        const entity = entities.find((e) => e.id === llmE.id);
        const isTax = entity ? isTaxonomyEntity(entity) : false;
        const maxLen = isTax ? 32 : 20;
        const fallback = isTax ? 'tax' : 'item';
        overrides.entitySlugs[llmE.id] = normalizeEntitySlug(llmE.slug, maxLen, usedSlugs, fallback);
      }
    }

    // Deterministic fallback for any entityIssueIds the LLM missed
    for (const entityId of entityIssueIds) {
      if (!overrides.entitySlugs[entityId]) {
        const entity = entities.find((e) => e.id === entityId);
        if (entity) {
          const isTax = isTaxonomyEntity(entity);
          const maxLen = isTax ? 32 : 20;
          const fallback = isTax ? 'tax' : 'item';
          overrides.entitySlugs[entityId] = normalizeEntitySlug(entity.slug || entity.name, maxLen, usedSlugs, fallback);
        }
      }
    }

    // Apply field names per scope (entity top-level, each repeater)
    for (const entity of entities) {
      normalizeFieldScope(entity.fields, fieldIssueIds, llmFieldMap, overrides);
    }

    return overrides;
  }

  /** Recursively normalize field names within a sibling scope */
  function normalizeFieldScope(
    fields: Field[],
    fieldIssueIds: Set<string>,
    llmFieldMap: Map<string, string>,
    overrides: ExportOverrides,
  ): void {
    // Pre-populate with valid siblings
    const usedNames = buildScopeUsedNames(fields, fieldIssueIds, overrides);

    for (const field of fields) {
      if (fieldIssueIds.has(field.id) && !overrides.fieldNames[field.id]) {
        const raw = llmFieldMap.get(field.id) || field.name;
        overrides.fieldNames[field.id] = normalizeFieldName(raw, usedNames);
      }

      // Recurse into repeater sub-fields
      if (field.type.kind === 'repeat') {
        normalizeFieldScope(field.type.fields, fieldIssueIds, llmFieldMap, overrides);
      }
    }
  }

  /** Deterministic fallback — no LLM needed */
  function buildDeterministicOverrides(
    entities: typeof store.entities,
    entityIssueIds: Set<string>,
    fieldIssueIds: Set<string>,
  ): ExportOverrides {
    const overrides: ExportOverrides = { entitySlugs: {}, fieldNames: {} };
    const usedSlugs = new Set<string>();

    // Collect already-valid slugs
    for (const e of entities) {
      if (!entityIssueIds.has(e.id)) {
        const slug = e.slug || e.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
        if (slug) usedSlugs.add(slug);
      }
    }

    for (const entity of entities) {
      if (entityIssueIds.has(entity.id)) {
        const isTax = isTaxonomyEntity(entity);
        const maxLen = isTax ? 32 : 20;
        const fallback = isTax ? 'tax' : 'item';
        const raw = entity.slug || entity.name;
        overrides.entitySlugs[entity.id] = normalizeEntitySlug(raw, maxLen, usedSlugs, fallback);
      }

      // Handle fields recursively (covers nested repeaters from ACF import)
      const emptyLLM = new Map<string, string>();
      normalizeFieldScope(entity.fields, fieldIssueIds, emptyLLM, overrides);
    }

    return overrides;
  }

  async function handleExport() {
    if (exporting) return;
    const entities = store.entities;
    const issues = validateExportIdentifiers(entities);

    let overrides: ExportOverrides | undefined;

    if (issues.length > 0) {
      const entityIssueIds = new Set(issues.filter((i) => i.scope === 'entity').map((i) => i.id));
      const fieldIssueIds = new Set(issues.filter((i) => i.scope === 'field').map((i) => i.id));

      exporting = true;
      showToast('正在优化字段键名...');
      try {
        const payload = buildSlugifyPayload(entities, entityIssueIds, fieldIssueIds);
        const resp = await fetch('/api/slugify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entities: payload }),
        });
        const data = await resp.json();
        if (data.error) throw new Error(data.error);
        overrides = applyLLMResult(data.entities, entities, entityIssueIds, fieldIssueIds);
      } catch {
        // Fallback: deterministic normalization
        overrides = buildDeterministicOverrides(entities, entityIssueIds, fieldIssueIds);
      } finally {
        exporting = false;
      }
      showToast('已优化键名');
    }

    const acfData = exportToACF(entities, overrides);
    downloadJSON(acfData, 'acf-export.json');
    showToast('已导出 ACF JSON');
    menuOpen = false;
  }

  function handleReset() {
    menuOpen = false;
    if (store.entities.length === 0 || confirm('确定要重置所有实体和数据吗？')) {
      store.reset();
    }
  }

  function handlePreview() {
    window.open('/preview', '_blank');
  }

  function handleImport() {
    menuOpen = false;
    fileInput.click();
  }

  async function handleFileSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const state = await readStoreFile(file);
      store.hydrate(state);
    } catch (err) {
      alert('导入失败：' + String(err));
    }
    input.value = '';
  }

  function toggleMenu() {
    menuOpen = !menuOpen;
  }

  function handleWindowClick(e: MouseEvent) {
    if (menuOpen) {
      const target = e.target as HTMLElement;
      if (!target.closest('.menu-wrapper')) {
        menuOpen = false;
      }
    }
  }
</script>

<svelte:window onclick={handleWindowClick} />

<input
  type="file"
  accept=".json"
  style="display:none"
  bind:this={fileInput}
  onchange={handleFileSelected}
/>

<header class="topbar">
  <div class="brand">
    <strong>ACF Playground</strong>
  </div>

  <nav class="actions">
    <button class="btn-preview" onclick={handlePreview}>
      预览
    </button>
    <div class="menu-wrapper">
      <button class="btn-menu" onclick={toggleMenu} aria-label="更多操作">⋮</button>
      {#if menuOpen}
        <div class="dropdown">
          <button class="dropdown-item" onclick={handleImport}>导入</button>
          <button class="dropdown-item" onclick={handleExport} disabled={store.entities.length === 0}>导出 JSON</button>
          <hr class="dropdown-divider" />
          <button class="dropdown-item danger" onclick={handleReset}>重置</button>
        </div>
      {/if}
    </div>
  </nav>
</header>

<style lang="scss">
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: $topbar-height;
    padding: 0 $spacing-lg;
    background: $color-node-header;
    color: white;
    flex-shrink: 0;
    z-index: 10;
  }

  .brand {
    font-size: $font-size-lg;
    letter-spacing: -0.02em;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
  }

  .btn-preview {
    padding: $spacing-xs $spacing-md;
    border: 1px solid rgba(255, 255, 255, 0.4);
    border-radius: $border-radius;
    color: white;
    background: transparent;
    font-size: $font-size-sm;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;

    &:hover {
      background: rgba(255, 255, 255, 0.1);
    }
  }

  .menu-wrapper {
    position: relative;
  }

  .btn-menu {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: $border-radius;
    color: rgba(255, 255, 255, 0.7);
    background: transparent;
    font-size: $font-size-lg;
    cursor: pointer;
    transition: all 0.15s;

    &:hover {
      color: white;
      background: rgba(255, 255, 255, 0.1);
    }
  }

  .dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: $spacing-xs;
    min-width: 140px;
    background: $color-surface;
    border: 1px solid $color-border;
    border-radius: $border-radius;
    box-shadow: $shadow-md;
    overflow: hidden;
    z-index: 100;
  }

  .dropdown-item {
    display: block;
    width: 100%;
    padding: $spacing-sm $spacing-md;
    border: none;
    background: transparent;
    color: $color-text;
    font-size: $font-size-sm;
    text-align: left;
    cursor: pointer;
    transition: background 0.1s;

    &:hover {
      background: $color-bg;
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    &.danger {
      color: $color-danger;
    }
  }

  .dropdown-divider {
    margin: 0;
    border: none;
    border-top: 1px solid $color-border-light;
  }
</style>
