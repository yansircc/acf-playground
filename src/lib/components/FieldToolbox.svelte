<script lang="ts">
  import type { FieldType } from '$lib/types';

  type ToolboxItem = {
    label: string;
    icon: string;
    fieldType: FieldType;
  };

  const basicFields: ToolboxItem[] = [
    { label: '文本', icon: 'Aa', fieldType: { kind: 'atom', subtype: 'text' } },
    { label: '多行', icon: '¶', fieldType: { kind: 'atom', subtype: 'textarea' } },
    { label: '数字', icon: '#', fieldType: { kind: 'atom', subtype: 'number' } },
    { label: '邮箱', icon: '@', fieldType: { kind: 'atom', subtype: 'email' } },
    { label: '链接', icon: '🔗', fieldType: { kind: 'atom', subtype: 'url' } },
    { label: '图片', icon: '🖼', fieldType: { kind: 'atom', subtype: 'image' } },
  ];

  const advancedFields: ToolboxItem[] = [
    { label: '重复器', icon: '🔁', fieldType: { kind: 'repeat', fields: [] } },
    { label: '关联', icon: '⇉', fieldType: { kind: 'ref', target: '', cardinality: 'n' } },
    { label: '文章对象', icon: '→', fieldType: { kind: 'ref', target: '', cardinality: '1' } },
    { label: '分类', icon: '🏷', fieldType: { kind: 'ref', target: '', cardinality: 'taxonomy' } },
  ];

  function handleDragStart(event: DragEvent, item: ToolboxItem) {
    if (!event.dataTransfer) return;
    event.dataTransfer.setData(
      'application/acf-field',
      JSON.stringify({ action: 'add-field', fieldType: item.fieldType })
    );
    event.dataTransfer.effectAllowed = 'copy';
  }
</script>

<div class="toolbox-bar">
  <div class="toolbox-group">
    <span class="group-label">基础字段</span>
    {#each basicFields as item}
      <div
        class="badge"
        draggable="true"
        ondragstart={(e) => handleDragStart(e, item)}
        role="button"
        tabindex="0"
      >
        <span class="badge-icon">{item.icon}</span>
        <span class="badge-label">{item.label}</span>
      </div>
    {/each}
  </div>
  <div class="toolbox-divider"></div>
  <div class="toolbox-group">
    <span class="group-label">高级</span>
    {#each advancedFields as item}
      <div
        class="badge"
        class:taxonomy={item.fieldType.kind === 'ref' && 'cardinality' in item.fieldType && item.fieldType.cardinality === 'taxonomy'}
        draggable="true"
        ondragstart={(e) => handleDragStart(e, item)}
        role="button"
        tabindex="0"
      >
        <span class="badge-icon">{item.icon}</span>
        <span class="badge-label">{item.label}</span>
      </div>
    {/each}
  </div>
</div>

<style lang="scss">
  .toolbox-bar {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    padding: $spacing-sm $spacing-lg;
    background: $color-surface;
    border-bottom: 1px solid $color-border;
    flex-shrink: 0;
    overflow-x: auto;
  }

  .toolbox-group {
    display: flex;
    align-items: center;
    gap: $spacing-xs;
    flex-shrink: 0;
  }

  .toolbox-divider {
    width: 1px;
    height: 24px;
    background: $color-border;
    flex-shrink: 0;
  }

  .group-label {
    font-size: $font-size-xs;
    color: $color-text-muted;
    font-weight: 600;
    white-space: nowrap;
    margin-right: $spacing-xs;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: $spacing-xs $spacing-sm;
    border: 1px solid $color-border-light;
    border-radius: 16px;
    cursor: grab;
    user-select: none;
    background: $color-surface;
    white-space: nowrap;
    transition: all 0.15s;
    font-size: $font-size-sm;

    &:hover {
      border-color: $color-primary;
      background: $color-primary-light;
    }

    &:active {
      cursor: grabbing;
    }

    &.taxonomy {
      border-color: $color-taxonomy;

      &:hover {
        background: rgba($color-taxonomy, 0.1);
        border-color: $color-taxonomy;
      }
    }
  }

  .badge-icon {
    font-size: $font-size-sm;
    line-height: 1;
  }

  .badge-label {
    font-size: $font-size-xs;
    font-weight: 500;
  }
</style>
