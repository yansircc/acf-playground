<script lang="ts">
  import type { FieldType } from '$lib/types';
  import { store } from '$lib/store.svelte';

  type ToolboxItem = {
    label: string;
    icon: string;
    fieldType: FieldType;
  };

  const basicFields: ToolboxItem[] = [
    { label: '文本', icon: 'Aa', fieldType: { kind: 'atom', subtype: 'text' } },
    { label: '多行', icon: '¶', fieldType: { kind: 'atom', subtype: 'textarea' } },
    { label: '数字', icon: '#', fieldType: { kind: 'atom', subtype: 'number' } },
    { label: '范围', icon: '↔', fieldType: { kind: 'atom', subtype: 'range' } },
    { label: '邮箱', icon: '@', fieldType: { kind: 'atom', subtype: 'email' } },
    { label: '链接', icon: '🔗', fieldType: { kind: 'atom', subtype: 'url' } },
    { label: '密码', icon: '🔒', fieldType: { kind: 'atom', subtype: 'password' } },
  ];

  const contentFields: ToolboxItem[] = [
    { label: '图片', icon: '🖼', fieldType: { kind: 'atom', subtype: 'image' } },
    { label: '文件', icon: '📎', fieldType: { kind: 'atom', subtype: 'file' } },
    { label: '编辑器', icon: '📝', fieldType: { kind: 'atom', subtype: 'wysiwyg' } },
    { label: 'oEmbed', icon: '▶', fieldType: { kind: 'atom', subtype: 'oembed' } },
    { label: '图库', icon: '🖼️', fieldType: { kind: 'atom', subtype: 'gallery' } },
  ];

  const choiceFields: ToolboxItem[] = [
    { label: '选择', icon: '▼', fieldType: { kind: 'atom', subtype: 'select', choices: ['选项 1', '选项 2', '选项 3'] } },
    { label: '复选', icon: '☑', fieldType: { kind: 'atom', subtype: 'checkbox', choices: ['选项 A', '选项 B', '选项 C'] } },
    { label: '单选', icon: '⊙', fieldType: { kind: 'atom', subtype: 'radio', choices: ['选项 A', '选项 B', '选项 C'] } },
    { label: '是/否', icon: '✓', fieldType: { kind: 'atom', subtype: 'true_false' } },
  ];

  const dateFields: ToolboxItem[] = [
    { label: '日期', icon: '📅', fieldType: { kind: 'atom', subtype: 'date_picker' } },
    { label: '日期时间', icon: '📅', fieldType: { kind: 'atom', subtype: 'date_time_picker' } },
    { label: '时间', icon: '⏰', fieldType: { kind: 'atom', subtype: 'time_picker' } },
    { label: '颜色', icon: '🎨', fieldType: { kind: 'atom', subtype: 'color_picker' } },
    { label: '页面链接', icon: '📄', fieldType: { kind: 'atom', subtype: 'page_link' } },
    { label: '地图', icon: '📍', fieldType: { kind: 'atom', subtype: 'google_map' } },
    { label: '用户', icon: '👤', fieldType: { kind: 'atom', subtype: 'user' } },
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

  function handleNewEntityDrag(event: DragEvent) {
    if (!event.dataTransfer) return;
    event.dataTransfer.setData(
      'application/acf-field',
      JSON.stringify({ action: 'new-entity' })
    );
    event.dataTransfer.effectAllowed = 'copy';
  }

  function handleNewEntity() {
    const base = '新实体';
    const existingNames = new Set(store.entities.map((e) => e.name));
    let name = base;
    let i = 2;
    while (existingNames.has(name)) {
      name = `${base} ${i++}`;
    }
    store.addEntity(name);
  }
</script>

<div class="toolbox-bar">
  <div class="toolbox-group">
    <div
      class="badge badge-entity"
      draggable="true"
      ondragstart={handleNewEntityDrag}
      onclick={handleNewEntity}
      role="button"
      tabindex="0"
      onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleNewEntity(); }}
    >
      <span class="badge-icon">+</span>
      <span class="badge-label">新实体</span>
    </div>
  </div>
  <div class="toolbox-divider"></div>
  <div class="toolbox-group">
    <span class="group-label">基础</span>
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
    <span class="group-label">内容</span>
    {#each contentFields as item}
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
    <span class="group-label">选择</span>
    {#each choiceFields as item}
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
    <span class="group-label">其他</span>
    {#each dateFields as item}
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
    flex-wrap: wrap;
    align-items: center;
    gap: $spacing-xs $spacing-sm;
    padding: $spacing-sm $spacing-lg;
    background: $color-surface;
    border-bottom: 1px solid $color-border;
    flex-shrink: 0;
  }

  .toolbox-group {
    display: flex;
    align-items: center;
    gap: $spacing-xs;
    flex-wrap: wrap;
  }

  .toolbox-divider {
    width: 1px;
    height: 20px;
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
    font-family: ui-monospace, monospace;
    text-transform: uppercase;
    letter-spacing: 0.02em;

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

    &.badge-entity {
      border-color: $color-primary;
      background: $color-primary-lighter;
      cursor: pointer;

      &:hover {
        background: $color-primary-light;
      }
    }
  }

  .badge-icon {
    font-size: $font-size-sm;
    line-height: 1;
  }

  .badge-label {
    font-size: $font-size-xs;
    font-weight: 600;
  }
</style>
