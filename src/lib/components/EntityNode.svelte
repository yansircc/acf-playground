<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';
  import type { NodeProps } from '@xyflow/svelte';
  import type { Entity, FieldType } from '$lib/types';
  import { store } from '$lib/store.svelte';
  import { REORDER_MIME, isReorderDrag, computeMoveIndex } from '$lib/field-dnd';
  import { tick } from 'svelte';

  let { data }: NodeProps = $props();

  const entity: Entity = $derived(data.entity as Entity);
  const isSelected: boolean = $derived(data.selected as boolean);

  function fieldIcon(type: FieldType): string {
    switch (type.kind) {
      case 'atom':
        switch (type.subtype) {
          case 'text': return 'Aa';
          case 'textarea': return '¶';
          case 'number': return '#';
          case 'range': return '↔';
          case 'email': return '@';
          case 'url': return '🔗';
          case 'password': return '🔒';
          case 'image': return '🖼';
          case 'file': return '📎';
          case 'wysiwyg': return '📝';
          case 'oembed': return '▶';
          case 'gallery': return '🖼️';
          case 'select': return '▼';
          case 'checkbox': return '☑';
          case 'radio': return '⊙';
          case 'true_false': return '✓';
          case 'date_picker': return '📅';
          case 'date_time_picker': return '📅';
          case 'time_picker': return '⏰';
          case 'color_picker': return '🎨';
          case 'page_link': return '📄';
          case 'google_map': return '📍';
          case 'user': return '👤';
        }
        break;
      case 'repeat': return '🔁';
      case 'ref':
        switch (type.cardinality) {
          case '1': return '→';
          case 'n': return '⇉';
          case 'taxonomy': return '🏷';
        }
    }
    return '?';
  }

  let editing = $state(false);
  let editName = $state('');
  let editInput: HTMLInputElement | undefined = $state();

  async function startEditing() {
    editName = entity.name;
    editing = true;
    await tick();
    editInput?.focus();
    editInput?.select();
  }

  function commitEdit() {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== entity.name) {
      store.renameEntity(entity.id, trimmed);
    }
    editing = false;
  }

  // 字段名双击编辑
  let editingFieldId: string | null = $state(null);
  let editFieldName = $state('');
  let editFieldInput: HTMLInputElement | undefined = $state();

  async function startFieldEdit(fieldId: string, currentName: string) {
    editingFieldId = fieldId;
    editFieldName = currentName;
    await tick();
    editFieldInput?.focus();
    editFieldInput?.select();
  }

  function commitFieldEdit(fieldId: string, originalName: string) {
    const trimmed = editFieldName.trim();
    if (trimmed && trimmed !== originalName) {
      store.updateField(entity.id, fieldId, { name: trimmed });
    }
    editingFieldId = null;
  }

  function removeField(fieldId: string) {
    store.removeField(entity.id, fieldId);
  }

  // === 字段拖拽排序 ===
  let dragFieldId: string | null = $state(null);
  let dropTargetFieldId: string | null = $state(null);
  let dropPosition: 'above' | 'below' | null = $state(null);

  function handleFieldDragStart(e: DragEvent, fieldId: string) {
    if (!e.dataTransfer) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(REORDER_MIME, fieldId);
    dragFieldId = fieldId;
  }

  function handleFieldDragEnd() {
    dragFieldId = null;
    dropTargetFieldId = null;
    dropPosition = null;
  }

  function handleFieldDragOver(e: DragEvent, fieldId: string) {
    if (!isReorderDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer!.dropEffect = 'move';

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    dropTargetFieldId = fieldId;
    dropPosition = e.clientY < mid ? 'above' : 'below';
  }

  function handleFieldDrop(e: DragEvent, targetFieldId: string) {
    if (!isReorderDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();

    const sourceFieldId = e.dataTransfer!.getData(REORDER_MIME);
    const fromIndex = entity.fields.findIndex((f) => f.id === sourceFieldId);
    const targetIndex = entity.fields.findIndex((f) => f.id === targetFieldId);
    const pos = dropPosition ?? 'below';
    const toIndex = computeMoveIndex(fromIndex, targetIndex, pos, entity.fields.length);

    if (toIndex !== -1) {
      store.moveField(entity.id, fromIndex, toIndex);
    }

    dragFieldId = null;
    dropTargetFieldId = null;
    dropPosition = null;
  }

  function handleFieldDragLeave(e: DragEvent) {
    const row = e.currentTarget as HTMLElement;
    if (!row.contains(e.relatedTarget as Node)) {
      dropTargetFieldId = null;
      dropPosition = null;
    }
  }
</script>

<div
  class="entity-node"
  class:selected={isSelected}
  role="group"
>
  <Handle type="target" position={Position.Left} id="header" class="target-handle" />
  <div class="entity-header">
    {#if editing}
      <input
        class="edit-name"
        bind:this={editInput}
        bind:value={editName}
        onblur={commitEdit}
        onkeydown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') editing = false; }}
      />
    {:else}
      <span class="entity-name" ondblclick={startEditing} role="textbox" tabindex="0">{entity.name}</span>
    {/if}
    <button class="delete-btn" onclick={() => { if (confirm(`确定删除实体 "${entity.name}" 及其所有数据吗？`)) store.removeEntity(entity.id); }} title="Delete entity">&times;</button>
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="entity-fields nodrag nopan"
    ondragover={(e) => {
      if (!isReorderDrag(e)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer!.dropEffect = 'move';
    }}
    ondrop={(e) => {
      if (!isReorderDrag(e)) return;
      e.preventDefault();
      e.stopPropagation();
      const sourceFieldId = e.dataTransfer!.getData(REORDER_MIME);
      const fromIndex = entity.fields.findIndex((f) => f.id === sourceFieldId);
      if (fromIndex === -1) return;
      const toIndex = entity.fields.length - 1;
      if (fromIndex !== toIndex) {
        store.moveField(entity.id, fromIndex, toIndex);
      }
      dragFieldId = null;
      dropTargetFieldId = null;
      dropPosition = null;
    }}
  >
    {#if entity.fields.length === 0}
      <div class="empty-hint">拖入字段到此处</div>
    {/if}
    {#each entity.fields as field (field.id)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="field-row"
        class:dragging={dragFieldId === field.id}
        class:drag-over-above={dropTargetFieldId === field.id && dropPosition === 'above'}
        class:drag-over-below={dropTargetFieldId === field.id && dropPosition === 'below'}
        ondragover={(e) => handleFieldDragOver(e, field.id)}
        ondrop={(e) => handleFieldDrop(e, field.id)}
        ondragleave={handleFieldDragLeave}
      >
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <span
          class="drag-grip nodrag"
          draggable="true"
          ondragstart={(e) => handleFieldDragStart(e, field.id)}
          ondragend={handleFieldDragEnd}
        >⠿</span>
        <span class="field-icon">{fieldIcon(field.type)}</span>
        {#if editingFieldId === field.id}
          <input
            class="edit-field-name"
            bind:this={editFieldInput}
            bind:value={editFieldName}
            onblur={() => commitFieldEdit(field.id, field.name)}
            onkeydown={(e) => { if (e.key === 'Enter') commitFieldEdit(field.id, field.name); if (e.key === 'Escape') editingFieldId = null; }}
          />
        {:else}
          <span class="field-name" ondblclick={() => startFieldEdit(field.id, field.name)} role="textbox" tabindex="0">{field.name}</span>
        {/if}
        <button class="field-remove" onclick={() => removeField(field.id)}>&times;</button>
        {#if field.type.kind === 'ref'}
          <Handle type="source" position={Position.Right} id={field.id} />
          <Handle type="target" position={Position.Right} id="{field.id}-target" class="ref-target-handle" />
        {:else if field.type.kind === 'repeat'}
          {#each field.type.fields as subField (subField.id)}
            {#if subField.type.kind === 'ref'}
              <Handle type="source" position={Position.Right} id={subField.id} />
              <Handle type="target" position={Position.Right} id="{subField.id}-target" class="ref-target-handle" />
            {/if}
          {/each}
        {/if}
      </div>
    {/each}
  </div>
</div>

<style lang="scss">
  .entity-node {
    min-width: 180px;
    background: $color-surface;
    border: 2px solid $color-border;
    border-radius: $border-radius-lg;
    box-shadow: $shadow-sm;
    overflow: hidden;
    font-size: $font-size-sm;
    transition: border-color 0.15s;

    &.selected {
      border-color: $color-primary;
      box-shadow: $shadow-md;
    }
  }

  .entity-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: $spacing-sm $spacing-md;
    background: $color-node-header;
    color: white;
    font-weight: 600;
    font-size: $font-size-base;
  }

  // header target handle 定位到标题栏垂直中心
  :global(.target-handle) {
    top: 18px !important;
  }

  // ref 字段的 target handle 与 source handle 重叠在右侧，视觉上只显示一个点
  // pointer-events: none 防止拦截 source handle 的 mousedown
  // SvelteFlow 的连线终点检测基于位置，不需要 pointer 事件
  // 需要 !important 覆盖 SvelteFlow 的内联 pointer-events: all
  :global(.ref-target-handle) {
    opacity: 0 !important;
    pointer-events: none !important;
  }

  .edit-name {
    background: rgba(255,255,255,0.2);
    border: 1px solid rgba(255,255,255,0.5);
    border-radius: $border-radius;
    color: white;
    font-weight: 600;
    font-size: $font-size-base;
    padding: 0 $spacing-xs;
    width: 100%;
    outline: none;
  }

  .delete-btn {
    color: rgba(255,255,255,0.6);
    font-size: $font-size-lg;
    line-height: 1;
    padding: 0 $spacing-xs;

    &:hover {
      color: $color-danger;
    }
  }

  .entity-fields {
    padding: $spacing-sm;
  }

  .empty-hint {
    color: $color-text-muted;
    font-style: italic;
    padding: $spacing-sm;
    text-align: center;
  }

  .field-row {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    padding: $spacing-xs $spacing-sm;
    border-radius: $border-radius;
    position: relative;

    &:hover {
      background: $color-bg;
    }

    &.dragging {
      opacity: 0.3;
    }

    &.drag-over-above {
      box-shadow: inset 0 2px 0 0 $color-primary;
    }

    &.drag-over-below {
      box-shadow: inset 0 -2px 0 0 $color-primary;
    }
  }

  .drag-grip {
    cursor: grab;
    color: $color-text-muted;
    font-size: $font-size-xs;
    user-select: none;
    opacity: 0;
    flex-shrink: 0;
    width: 16px;
    text-align: center;
    .field-row:hover & { opacity: 0.6; }
    &:hover { opacity: 1 !important; }
    &:active { cursor: grabbing; }
  }

  .field-icon {
    width: 24px;
    text-align: center;
    flex-shrink: 0;
  }

  .field-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: default;
  }

  .edit-field-name {
    flex: 1;
    border: 1px solid $color-primary;
    border-radius: $border-radius;
    font-size: $font-size-sm;
    padding: 0 $spacing-xs;
    outline: none;
    min-width: 0;
  }

  .field-remove {
    opacity: 0;
    color: $color-danger;
    font-size: $font-size-base;
    transition: opacity 0.15s;
    .field-row:hover & {
      opacity: 1;
    }
  }
</style>
