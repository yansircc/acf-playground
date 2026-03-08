<script lang="ts">
  import type { FieldType, Entity } from '$lib/types';
  import { store } from '$lib/store.svelte';
  import { generateMockRow } from '$lib/mock-data';
  import TaxonomyEditor from './TaxonomyEditor.svelte';
  import RefField from './RefField.svelte';
  import RepeaterField from './RepeaterField.svelte';

  const entity: Entity | undefined = $derived(store.currentEntity);
  const data: Record<string, unknown>[] = $derived(store.currentData);

  // 多行展开状态
  let expandedRow: number | null = $state(null);

  // 当实体切换时重置展开状态；只有 1 行时自动展开
  let lastEntityId: string | null = null;
  $effect(() => {
    const eid = entity?.id ?? null;
    if (eid !== lastEntityId) {
      lastEntityId = eid;
      expandedRow = data.length === 1 ? 0 : null;
    }
  });

  function getRowTitle(entityId: string, rowIndex: number): string {
    const ent = store.entities.find((e) => e.id === entityId);
    if (!ent) return `记录 #${rowIndex + 1}`;
    const textField = ent.fields.find((f) => f.type.kind === 'atom' && f.type.subtype === 'text');
    if (!textField) return `记录 #${rowIndex + 1}`;
    const val = store.data[entityId]?.[rowIndex]?.[textField.id];
    return (val as string) || `记录 #${rowIndex + 1}`;
  }

  function getFieldValue(fieldId: string, rowIndex = 0): unknown {
    return data[rowIndex]?.[fieldId] ?? '';
  }

  function handleInput(fieldId: string, value: unknown, rowIndex = 0) {
    if (!entity) return;
    store.updateFieldData(entity.id, fieldId, value, rowIndex);
  }

  function handleFieldNameChange(fieldId: string, name: string) {
    if (!entity) return;
    store.updateField(entity.id, fieldId, { name });
  }

  function handleAddRow() {
    if (!entity) return;
    store.addDataRow(entity.id);
    expandedRow = (store.data[entity.id]?.length ?? 1) - 1;
  }

  function handleRemoveRow(rowIndex: number) {
    if (!entity) return;
    store.removeDataRow(entity.id, rowIndex);
    if (expandedRow === rowIndex) {
      expandedRow = null;
    } else if (expandedRow !== null && expandedRow > rowIndex) {
      expandedRow--;
    }
  }

  function handleMock() {
    if (!entity) return;
    const row = generateMockRow(entity, store.data[entity.id]?.length ?? 0, store.data);
    store.addDataRow(entity.id);
    const newIdx = (store.data[entity.id]?.length ?? 1) - 1;
    for (const [fieldId, value] of Object.entries(row)) {
      store.data[entity.id][newIdx][fieldId] = value;
    }
    expandedRow = newIdx;
  }

  function toggleRow(rowIndex: number) {
    expandedRow = expandedRow === rowIndex ? null : rowIndex;
  }

  function subtypeLabel(type: FieldType): string {
    switch (type.kind) {
      case 'atom':
        switch (type.subtype) {
          case 'text': return '文本';
          case 'textarea': return '多行文本';
          case 'number': return '数字';
          case 'email': return '邮箱';
          case 'url': return '链接';
          case 'image': return '图片';
        }
        return type.subtype;
      case 'repeat': return '重复器';
      case 'ref':
        switch (type.cardinality) {
          case '1': return '文章对象';
          case 'n': return '关联';
          case 'taxonomy': return '分类';
        }
    }
  }

  function isTaxonomyEntity(): boolean {
    if (!entity) return false;
    return store.isSelfRefEntity(entity.id);
  }
</script>

<div class="form-panel">
  {#if entity}
    <div class="panel-header">
      <input
        class="entity-name-input"
        type="text"
        value={entity.name}
        oninput={(e) => { entity.name = (e.target as HTMLInputElement).value; }}
      />
      <span class="field-count">{entity.fields.length} 个字段</span>
    </div>

    <div class="form-body">
      {#if entity.fields.length === 0}
        <div class="empty-state">
          从上方拖拽字段到画布中的实体节点
        </div>
      {/if}

      {#if isTaxonomyEntity()}
        <TaxonomyEditor {entity} />

      {:else if entity.fields.length > 0}
        <!-- Normal entity: multi-row list + expand -->
        <div class="row-list-header">
          <span class="row-count">{data.length} 条记录</span>
          <div class="row-actions">
            <button class="action-btn mock-btn" onclick={handleMock}>Mock</button>
            <button class="action-btn add-btn" onclick={handleAddRow}>+</button>
          </div>
        </div>

        <div class="row-list">
          {#each data as _row, ri}
            <div class="row-item" class:expanded={expandedRow === ri}>
              <div class="row-item-header" onclick={() => toggleRow(ri)} role="button" tabindex="0" onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleRow(ri); }}>
                <span class="row-toggle">{expandedRow === ri ? '▾' : '▸'}</span>
                <span class="row-title">{getRowTitle(entity.id, ri)}</span>
                <button class="row-remove" onclick={(e) => { e.stopPropagation(); handleRemoveRow(ri); }}
                  disabled={data.length <= 1}>&times;</button>
              </div>

              {#if expandedRow === ri}
                <div class="row-fields">
                  {#each entity.fields as field (field.id)}
                    <div class="field-group">
                      <div class="field-header">
                        <span class="field-type-badge" class:taxonomy={field.type.kind === 'ref' && field.type.cardinality === 'taxonomy'}>{subtypeLabel(field.type)}</span>
                        <input
                          class="field-name-input"
                          type="text"
                          value={field.name}
                          oninput={(e) => handleFieldNameChange(field.id, (e.target as HTMLInputElement).value)}
                        />
                      </div>

                      <div class="field-control">
                        {#if field.type.kind === 'atom'}
                          {#if field.type.subtype === 'text'}
                            <input type="text" class="wp-input"
                              value={getFieldValue(field.id, ri) as string}
                              oninput={(e) => handleInput(field.id, (e.target as HTMLInputElement).value, ri)}
                              placeholder="输入文本..." />
                          {:else if field.type.subtype === 'number'}
                            <input type="number" class="wp-input"
                              value={getFieldValue(field.id, ri) as string}
                              oninput={(e) => handleInput(field.id, (e.target as HTMLInputElement).value, ri)}
                              placeholder="0" />
                          {:else if field.type.subtype === 'email'}
                            <input type="email" class="wp-input"
                              value={getFieldValue(field.id, ri) as string}
                              oninput={(e) => handleInput(field.id, (e.target as HTMLInputElement).value, ri)}
                              placeholder="user@example.com" />
                          {:else if field.type.subtype === 'url'}
                            <input type="url" class="wp-input"
                              value={getFieldValue(field.id, ri) as string}
                              oninput={(e) => handleInput(field.id, (e.target as HTMLInputElement).value, ri)}
                              placeholder="https://..." />
                          {:else if field.type.subtype === 'textarea'}
                            <textarea class="wp-input wp-textarea"
                              value={getFieldValue(field.id, ri) as string}
                              oninput={(e) => handleInput(field.id, (e.target as HTMLTextAreaElement).value, ri)}
                              placeholder="输入文本..." rows="3"></textarea>
                          {:else if field.type.subtype === 'image'}
                            <input type="url" class="wp-input"
                              value={getFieldValue(field.id, ri) as string}
                              oninput={(e) => handleInput(field.id, (e.target as HTMLInputElement).value, ri)}
                              placeholder="图片 URL..." />
                            {#if getFieldValue(field.id, ri)}
                              <img class="image-preview"
                                src={getFieldValue(field.id, ri) as string} alt="预览"
                                onerror={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            {/if}
                          {/if}

                        {:else if field.type.kind === 'ref'}
                          <RefField {field} {entity} rowIndex={ri}
                            value={getFieldValue(field.id, ri)}
                            onchange={(val) => handleInput(field.id, val, ri)} />

                        {:else if field.type.kind === 'repeat'}
                          <RepeaterField field={{ ...field, type: field.type }} {entity} rowIndex={ri} />
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {:else}
    <div class="empty-state full">
      <p>选择一个实体以编辑其字段</p>
    </div>
  {/if}
</div>

<style lang="scss">
  .form-panel {
    width: $panel-width;
    background: $color-bg;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-left: 1px solid $color-border;
    flex-shrink: 0;
  }

  .panel-header {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    padding: $spacing-md;
    background: $color-surface;
    border-bottom: 1px solid $color-border;
  }

  .entity-name-input {
    flex: 1;
    border: none;
    font-size: $font-size-lg;
    font-weight: 600;
    background: transparent;
    color: $color-text;
    outline: none;

    &:focus {
      border-bottom: 2px solid $color-primary;
    }
  }

  .field-count {
    font-size: $font-size-xs;
    color: $color-text-muted;
    white-space: nowrap;
  }

  .form-body {
    flex: 1;
    overflow-y: auto;
    padding: $spacing-md;
  }

  // === Multi-row list ===

  .row-list-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: $spacing-sm;
    padding: $spacing-xs 0;
  }

  .row-count {
    font-size: $font-size-sm;
    color: $color-text-secondary;
    font-weight: 500;
  }

  .row-actions {
    display: flex;
    gap: $spacing-xs;
  }

  .action-btn {
    padding: $spacing-xs $spacing-sm;
    border-radius: $border-radius;
    font-size: $font-size-sm;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }

  .mock-btn {
    color: $color-primary;
    border: 1px solid $color-primary;
    background: transparent;

    &:hover {
      background: $color-primary-lighter;
    }
  }

  .add-btn {
    color: $color-primary;
    border: 1px dashed $color-primary;
    background: transparent;
    min-width: 28px;

    &:hover {
      background: $color-primary-lighter;
    }
  }

  .row-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
    background: $color-border-light;
    border: 1px solid $color-border-light;
    border-radius: $border-radius;
    overflow: hidden;
  }

  .row-item {
    background: $color-surface;
  }

  .row-item-header {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    width: 100%;
    padding: $spacing-sm $spacing-md;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    font-size: $font-size-sm;
    color: $color-text;

    &:hover {
      background: $color-bg;
    }
  }

  .row-toggle {
    width: 14px;
    color: $color-text-muted;
    font-size: $font-size-xs;
    flex-shrink: 0;
  }

  .row-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 500;
  }

  .row-remove {
    color: $color-danger;
    font-size: $font-size-lg;
    opacity: 0.3;
    padding: 0 $spacing-xs;
    background: none;
    border: none;
    cursor: pointer;
    flex-shrink: 0;

    &:hover:not(:disabled) {
      opacity: 1;
    }

    &:disabled {
      opacity: 0.1;
      cursor: not-allowed;
    }
  }

  .row-fields {
    padding: $spacing-sm $spacing-md $spacing-md;
    border-top: 1px solid $color-border-light;
  }

  // === Field groups ===

  .field-group {
    background: $color-surface;
    border: 1px solid $color-border-light;
    border-radius: $border-radius;
    margin-bottom: $spacing-md;
    overflow: hidden;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .field-header {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    padding: $spacing-sm $spacing-md;
    border-bottom: 1px solid $color-border-light;
    background: $color-bg-light;
  }

  .field-type-badge {
    font-size: $font-size-xs;
    background: $color-primary;
    color: white;
    padding: 2px $spacing-sm;
    border-radius: 10px;
    font-weight: 600;
    white-space: nowrap;

    &.taxonomy {
      background: $color-taxonomy;
    }
  }

  .field-name-input {
    flex: 1;
    border: none;
    background: transparent;
    font-size: $font-size-sm;
    font-weight: 500;
    color: $color-text;
    outline: none;
  }

  .field-control {
    padding: $spacing-md;
  }

  .wp-input {
    width: 100%;
    padding: $spacing-sm $spacing-md;
    border: 1px solid $color-border;
    border-radius: $border-radius;
    font-size: $font-size-base;
    color: $color-text;
    background: $color-surface;
    outline: none;
    transition: border-color 0.15s;

    &:focus {
      border-color: $color-primary;
      box-shadow: 0 0 0 1px $color-primary;
    }
  }

  .wp-textarea {
    resize: vertical;
    min-height: 60px;
  }

  .image-preview {
    margin-top: $spacing-sm;
    max-width: 100%;
    max-height: 120px;
    border-radius: $border-radius;
    border: 1px solid $color-border-light;
    object-fit: cover;
  }

  .empty-state {
    color: $color-text-muted;
    text-align: center;
    padding: $spacing-xl;
    font-style: italic;

    &.full {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
    }
  }
</style>
