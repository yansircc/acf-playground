<script lang="ts">
  import type { FieldType, Entity } from '$lib/types';
  import { store } from '$lib/store.svelte';
  import { generateMockRow } from '$lib/mock-data';
  import TaxonomyEditor from './TaxonomyEditor.svelte';
  import RefField from './RefField.svelte';
  import RepeaterField from './RepeaterField.svelte';

  let { width = 340 }: { width?: number } = $props();

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

  function addChoice(field: import('$lib/types').Field) {
    if (field.type.kind !== 'atom' || !('choices' in field.type)) return;
    const choices = field.type.choices ?? [];
    const n = choices.length + 1;
    field.type.choices = [...choices, `选项 ${n}`];
  }

  function removeChoice(field: import('$lib/types').Field, index: number) {
    if (field.type.kind !== 'atom' || !field.type.choices) return;
    field.type.choices = field.type.choices.filter((_, i) => i !== index);
  }

  function updateChoice(field: import('$lib/types').Field, index: number, value: string) {
    if (field.type.kind !== 'atom' || !field.type.choices) return;
    field.type.choices[index] = value;
  }
</script>

{#snippet choicesEditor(field: import('$lib/types').Field)}
  {#if field.type.kind === 'atom' && 'choices' in field.type}
    <div class="choices-editor">
      {#each field.type.choices ?? [] as choice, ci}
        <div class="choices-row">
          <input type="text" class="choices-input" value={choice}
            oninput={(e) => updateChoice(field, ci, (e.target as HTMLInputElement).value)} />
          <button class="choices-remove" onclick={() => removeChoice(field, ci)}>&times;</button>
        </div>
      {/each}
      <button class="choices-add" onclick={() => addChoice(field)}>+ 添加选项</button>
    </div>
  {/if}
{/snippet}

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
                          {#if field.type.subtype === 'text' || field.type.subtype === 'password'}
                            <input type={field.type.subtype} class="wp-input"
                              value={getFieldValue(field.id, ri) as string}
                              oninput={(e) => handleInput(field.id, (e.target as HTMLInputElement).value, ri)}
                              placeholder={field.type.subtype === 'password' ? '••••••' : '输入文本...'} />
                          {:else if field.type.subtype === 'number'}
                            <input type="number" class="wp-input"
                              value={getFieldValue(field.id, ri) as string}
                              oninput={(e) => handleInput(field.id, (e.target as HTMLInputElement).value, ri)}
                              placeholder="0" />
                          {:else if field.type.subtype === 'range'}
                            <div class="range-wrapper">
                              <input type="range" class="wp-range" min="0" max="100"
                                value={getFieldValue(field.id, ri) as string || '50'}
                                oninput={(e) => handleInput(field.id, (e.target as HTMLInputElement).value, ri)} />
                              <span class="range-value">{getFieldValue(field.id, ri) || '50'}</span>
                            </div>
                          {:else if field.type.subtype === 'email'}
                            <input type="email" class="wp-input"
                              value={getFieldValue(field.id, ri) as string}
                              oninput={(e) => handleInput(field.id, (e.target as HTMLInputElement).value, ri)}
                              placeholder="user@example.com" />
                          {:else if field.type.subtype === 'url' || field.type.subtype === 'oembed' || field.type.subtype === 'page_link'}
                            <input type="url" class="wp-input"
                              value={getFieldValue(field.id, ri) as string}
                              oninput={(e) => handleInput(field.id, (e.target as HTMLInputElement).value, ri)}
                              placeholder={field.type.subtype === 'oembed' ? 'YouTube / Vimeo URL...' : field.type.subtype === 'page_link' ? '页面 URL...' : 'https://...'} />
                          {:else if field.type.subtype === 'textarea'}
                            <textarea class="wp-input wp-textarea"
                              value={getFieldValue(field.id, ri) as string}
                              oninput={(e) => handleInput(field.id, (e.target as HTMLTextAreaElement).value, ri)}
                              placeholder="输入文本..." rows="3"></textarea>
                          {:else if field.type.subtype === 'wysiwyg'}
                            <textarea class="wp-input wp-textarea"
                              value={getFieldValue(field.id, ri) as string}
                              oninput={(e) => handleInput(field.id, (e.target as HTMLTextAreaElement).value, ri)}
                              placeholder="富文本内容（WordPress 中为可视化编辑器）..." rows="5"></textarea>
                          {:else if field.type.subtype === 'image' || field.type.subtype === 'file'}
                            <input type="url" class="wp-input"
                              value={getFieldValue(field.id, ri) as string}
                              oninput={(e) => handleInput(field.id, (e.target as HTMLInputElement).value, ri)}
                              placeholder={field.type.subtype === 'image' ? '图片 URL...' : '文件 URL...'} />
                            {#if field.type.subtype === 'image' && getFieldValue(field.id, ri)}
                              <img class="image-preview"
                                src={getFieldValue(field.id, ri) as string} alt="预览"
                                onerror={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            {/if}
                          {:else if field.type.subtype === 'gallery'}
                            <textarea class="wp-input wp-textarea"
                              value={getFieldValue(field.id, ri) as string}
                              oninput={(e) => handleInput(field.id, (e.target as HTMLTextAreaElement).value, ri)}
                              placeholder="图片 URL（每行一个）..." rows="3"></textarea>
                          {:else if field.type.subtype === 'select'}
                            <select class="wp-input"
                              value={getFieldValue(field.id, ri) as string}
                              onchange={(e) => handleInput(field.id, (e.target as HTMLSelectElement).value, ri)}>
                              <option value="">— 选择 —</option>
                              {#each field.type.choices ?? [] as choice}
                                <option value={choice}>{choice}</option>
                              {/each}
                            </select>
                            {@render choicesEditor(field)}
                          {:else if field.type.subtype === 'radio'}
                            <div class="choice-group">
                              {#each field.type.choices ?? [] as choice, ci}
                                <div class="choice-row">
                                  <label class="choice-item">
                                    <input type="radio" name="{field.id}-{ri}"
                                      value={choice}
                                      checked={getFieldValue(field.id, ri) === choice}
                                      onchange={() => handleInput(field.id, choice, ri)} />
                                  </label>
                                  <input type="text" class="choices-input" value={choice}
                                    oninput={(e) => updateChoice(field, ci, (e.target as HTMLInputElement).value)} />
                                  <button class="choices-remove" onclick={() => removeChoice(field, ci)}>&times;</button>
                                </div>
                              {/each}
                              <button class="choices-add" onclick={() => addChoice(field)}>+ 添加选项</button>
                            </div>
                          {:else if field.type.subtype === 'checkbox'}
                            <div class="choice-group">
                              {#each field.type.choices ?? [] as choice, ci}
                                {@const currentVal = (getFieldValue(field.id, ri) as string[]) ?? []}
                                <div class="choice-row">
                                  <label class="choice-item">
                                    <input type="checkbox"
                                      value={choice}
                                      checked={currentVal.includes(choice)}
                                      onchange={(e) => {
                                        const checked = (e.target as HTMLInputElement).checked;
                                        const arr = [...currentVal];
                                        if (checked) arr.push(choice); else arr.splice(arr.indexOf(choice), 1);
                                        handleInput(field.id, arr, ri);
                                      }} />
                                  </label>
                                  <input type="text" class="choices-input" value={choice}
                                    oninput={(e) => updateChoice(field, ci, (e.target as HTMLInputElement).value)} />
                                  <button class="choices-remove" onclick={() => removeChoice(field, ci)}>&times;</button>
                                </div>
                              {/each}
                              <button class="choices-add" onclick={() => addChoice(field)}>+ 添加选项</button>
                            </div>
                          {:else if field.type.subtype === 'true_false'}
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <div class="toggle-label"
                              onclick={() => handleInput(field.id, !getFieldValue(field.id, ri), ri)}
                              onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleInput(field.id, !getFieldValue(field.id, ri), ri); } }}
                              role="switch"
                              aria-checked={!!getFieldValue(field.id, ri)}
                              tabindex="0"
                            >
                              <span class="toggle-track" class:on={!!getFieldValue(field.id, ri)}>
                                <span class="toggle-thumb"></span>
                              </span>
                              <span>{getFieldValue(field.id, ri) ? '是' : '否'}</span>
                            </div>
                          {:else if field.type.subtype === 'date_picker'}
                            <input type="date" class="wp-input"
                              value={getFieldValue(field.id, ri) as string}
                              oninput={(e) => handleInput(field.id, (e.target as HTMLInputElement).value, ri)} />
                          {:else if field.type.subtype === 'date_time_picker'}
                            <input type="datetime-local" class="wp-input"
                              value={getFieldValue(field.id, ri) as string}
                              oninput={(e) => handleInput(field.id, (e.target as HTMLInputElement).value, ri)} />
                          {:else if field.type.subtype === 'time_picker'}
                            <input type="time" class="wp-input"
                              value={getFieldValue(field.id, ri) as string}
                              oninput={(e) => handleInput(field.id, (e.target as HTMLInputElement).value, ri)} />
                          {:else if field.type.subtype === 'color_picker'}
                            <div class="color-wrapper">
                              <input type="color" class="wp-color"
                                value={getFieldValue(field.id, ri) as string || '#000000'}
                                oninput={(e) => handleInput(field.id, (e.target as HTMLInputElement).value, ri)} />
                              <input type="text" class="wp-input color-hex"
                                value={getFieldValue(field.id, ri) as string || '#000000'}
                                oninput={(e) => handleInput(field.id, (e.target as HTMLInputElement).value, ri)}
                                placeholder="#000000" />
                            </div>
                          {:else if field.type.subtype === 'google_map'}
                            <input type="text" class="wp-input"
                              value={getFieldValue(field.id, ri) as string}
                              oninput={(e) => handleInput(field.id, (e.target as HTMLInputElement).value, ri)}
                              placeholder="地址..." />
                          {:else if field.type.subtype === 'user'}
                            <input type="text" class="wp-input"
                              value={getFieldValue(field.id, ri) as string}
                              oninput={(e) => handleInput(field.id, (e.target as HTMLInputElement).value, ri)}
                              placeholder="用户名..." />
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

  .range-wrapper {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
  }

  .wp-range {
    flex: 1;
    accent-color: $color-primary;
  }

  .range-value {
    font-size: $font-size-sm;
    color: $color-text-secondary;
    min-width: 32px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .choice-group {
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
  }

  .choice-item {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    cursor: pointer;

    input { accent-color: $color-primary; }
  }

  .choice-row {
    display: flex;
    align-items: center;
    gap: $spacing-xs;
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    font-size: $font-size-sm;
    cursor: pointer;
    user-select: none;
  }

  .toggle-track {
    position: relative;
    width: 40px;
    height: 22px;
    background: $color-border;
    border-radius: 11px;
    transition: background 0.2s;
    flex-shrink: 0;

    &.on {
      background: $color-primary;
    }
  }

  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    background: white;
    border-radius: 50%;
    transition: transform 0.2s;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);

    .on > & {
      transform: translateX(18px);
    }
  }

  .choices-editor {
    margin-top: $spacing-sm;
    padding-top: $spacing-sm;
    border-top: 1px dashed $color-border-light;
  }

  .choices-row {
    display: flex;
    align-items: center;
    gap: $spacing-xs;
    margin-bottom: $spacing-xs;
  }

  .choices-input {
    flex: 1;
    padding: 2px $spacing-sm;
    border: 1px solid $color-border-light;
    border-radius: $border-radius;
    font-size: $font-size-xs;
    color: $color-text-secondary;
    outline: none;

    &:focus {
      border-color: $color-primary;
    }
  }

  .choices-remove {
    color: $color-danger;
    background: none;
    border: none;
    cursor: pointer;
    font-size: $font-size-sm;
    opacity: 0.4;
    padding: 0 2px;

    &:hover { opacity: 1; }
  }

  .choices-add {
    font-size: $font-size-xs;
    color: $color-primary;
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 0;

    &:hover { text-decoration: underline; }
  }

  .color-wrapper {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
  }

  .wp-color {
    width: 40px;
    height: 34px;
    border: 1px solid $color-border;
    border-radius: $border-radius;
    padding: 2px;
    cursor: pointer;
  }

  .color-hex {
    flex: 1;
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
