<script lang="ts">
  import type { FieldType, Entity } from '$lib/types';
  import { store } from '$lib/store.svelte';
  import { generateRefValue } from '$lib/mock-data';
  import TaxonomyEditor from './TaxonomyEditor.svelte';
  import RefField from './RefField.svelte';
  import RepeaterField from './RepeaterField.svelte';
  import AtomField from './AtomField.svelte';

  let { width = 340 }: { width?: number } = $props();

  const entity: Entity | undefined = $derived(store.currentEntity);
  const data: Record<string, unknown>[] = $derived(store.currentData);

  // 多行展开状态
  let expandedRow: number | null = $state(null);
  let aiMockLoading = $state(false);

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

  async function handleAIMock() {
    if (!entity || aiMockLoading) return;
    const input = prompt('生成几条模拟数据？(1-10)', '3');
    if (!input) return;
    const count = Math.max(1, Math.min(10, parseInt(input, 10) || 3));

    aiMockLoading = true;
    try {
      const res = await fetch('/api/mock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity,
          allEntities: store.entities,
          count
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const { rows } = await res.json();
      for (const row of rows) {
        for (const field of entity.fields) {
          if (field.type.kind === 'ref') {
            row[field.id] = generateRefValue(field, store.data);
          }
        }
        store.addDataRow(entity.id);
        const idx = (store.data[entity.id]?.length ?? 1) - 1;
        for (const [fieldId, value] of Object.entries(row)) {
          store.data[entity.id][idx][fieldId] = value;
        }
      }
      expandedRow = (store.data[entity.id]?.length ?? 1) - 1;
    } catch (e) {
      alert(`AI 生成失败：${e instanceof Error ? e.message : '未知错误'}`);
    } finally {
      aiMockLoading = false;
    }
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
          case 'range': return '范围';
          case 'email': return '邮箱';
          case 'url': return '链接';
          case 'password': return '密码';
          case 'image': return '图片';
          case 'file': return '文件';
          case 'wysiwyg': return '编辑器';
          case 'oembed': return 'oEmbed';
          case 'gallery': return '图库';
          case 'select': return '选择';
          case 'checkbox': return '复选';
          case 'radio': return '单选';
          case 'true_false': return '是/否';
          case 'date_picker': return '日期';
          case 'date_time_picker': return '日期时间';
          case 'time_picker': return '时间';
          case 'color_picker': return '颜色';
          case 'page_link': return '页面链接';
          case 'google_map': return '地图';
          case 'user': return '用户';
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

<div class="form-panel" style="width: {width}px">
  {#if entity}
    <div class="panel-header">
      <input
        class="entity-name-input"
        type="text"
        value={entity.name}
        oninput={(e) => {
          const val = (e.target as HTMLInputElement).value;
          if (val.trim()) entity.name = val;
        }}
        onblur={(e) => {
          const val = (e.target as HTMLInputElement).value.trim();
          if (!val) (e.target as HTMLInputElement).value = entity.name;
        }}
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
            <button class="action-btn ai-mock-btn" onclick={handleAIMock} disabled={aiMockLoading}>
              {aiMockLoading ? '生成中...' : 'AI 帮填'}
            </button>
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
                          <AtomField {field}
                            value={getFieldValue(field.id, ri)}
                            onchange={(v) => handleInput(field.id, v, ri)}
                            rowIndex={ri} />

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

  .ai-mock-btn {
    color: white;
    border: 1px solid $color-accent;
    background: $color-accent;

    &:hover:not(:disabled) {
      opacity: 0.85;
    }

    &:disabled {
      opacity: 0.6;
      cursor: wait;
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
