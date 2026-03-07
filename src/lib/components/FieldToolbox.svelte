<script lang="ts">
  import type { FieldType } from '$lib/types';
  import { store } from '$lib/store.svelte';

  type ToolboxItem = {
    label: string;
    icon: string;
    fieldType: FieldType;
  };

  const atomFields: ToolboxItem[] = [
    { label: 'Text', icon: 'Aa', fieldType: { kind: 'atom', subtype: 'text' } },
    { label: 'Textarea', icon: '\u00b6', fieldType: { kind: 'atom', subtype: 'textarea' } },
    { label: 'Number', icon: '#', fieldType: { kind: 'atom', subtype: 'number' } },
    { label: 'Email', icon: '@', fieldType: { kind: 'atom', subtype: 'email' } },
    { label: 'URL', icon: '\u{1f517}', fieldType: { kind: 'atom', subtype: 'url' } },
    { label: 'Image', icon: '\u{1f5bc}', fieldType: { kind: 'atom', subtype: 'image' } },
  ];

  const advancedFields: ToolboxItem[] = [
    { label: 'Repeater', icon: '\u{1f501}', fieldType: { kind: 'repeat', fields: [] } },
    { label: 'Relationship', icon: '\u21c9', fieldType: { kind: 'ref', target: '', cardinality: 'n' } },
    { label: 'Post Object', icon: '\u2192', fieldType: { kind: 'ref', target: '', cardinality: '1' } },
  ];

  function handleDragStart(event: DragEvent, item: ToolboxItem) {
    if (!event.dataTransfer) return;
    event.dataTransfer.setData(
      'application/acf-field',
      JSON.stringify({ action: 'add-field', fieldType: item.fieldType })
    );
    event.dataTransfer.effectAllowed = 'copy';
  }

  function handleEntityDragStart(event: DragEvent) {
    if (!event.dataTransfer) return;
    event.dataTransfer.setData(
      'application/acf-field',
      JSON.stringify({ action: 'new-entity' })
    );
    event.dataTransfer.effectAllowed = 'move';
  }

  function handleAddEntity() {
    store.addEntity('New Entity');
  }
</script>

<div class="toolbox">
  <div class="toolbox-section">
    <h3 class="section-title">Entity</h3>
    <button
      class="toolbox-item entity-item"
      draggable="true"
      ondragstart={handleEntityDragStart}
      onclick={handleAddEntity}
    >
      <span class="item-icon">+</span>
      <span class="item-label">New Entity</span>
    </button>
  </div>

  <div class="toolbox-section">
    <h3 class="section-title">Basic Fields</h3>
    {#each atomFields as item}
      <div
        class="toolbox-item"
        draggable="true"
        ondragstart={(e) => handleDragStart(e, item)}
        role="button"
        tabindex="0"
      >
        <span class="item-icon">{item.icon}</span>
        <span class="item-label">{item.label}</span>
      </div>
    {/each}
  </div>

  <div class="toolbox-section">
    <h3 class="section-title">Advanced</h3>
    {#each advancedFields as item}
      <div
        class="toolbox-item"
        draggable="true"
        ondragstart={(e) => handleDragStart(e, item)}
        role="button"
        tabindex="0"
      >
        <span class="item-icon">{item.icon}</span>
        <span class="item-label">{item.label}</span>
      </div>
    {/each}
  </div>
</div>

<style lang="scss">
  .toolbox {
    width: $toolbox-width;
    background: $color-surface;
    border-right: 1px solid $color-border;
    padding: $spacing-md;
    overflow-y: auto;
    flex-shrink: 0;
  }

  .toolbox-section {
    margin-bottom: $spacing-lg;
  }

  .section-title {
    font-size: $font-size-xs;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: $color-text-secondary;
    margin-bottom: $spacing-sm;
    font-weight: 600;
  }

  .toolbox-item {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    padding: $spacing-sm $spacing-md;
    border: 1px solid $color-border-light;
    border-radius: $border-radius;
    margin-bottom: $spacing-xs;
    cursor: grab;
    transition: all 0.15s;
    user-select: none;
    background: $color-surface;
    width: 100%;
    text-align: left;

    &:hover {
      border-color: $color-primary;
      background: $color-primary-light;
    }

    &:active {
      cursor: grabbing;
    }

    &.entity-item {
      background: $color-node-header;
      color: white;
      border-color: $color-node-header;
      cursor: pointer;

      &:hover {
        background: $color-node-header-hover;
      }
    }
  }

  .item-icon {
    width: 24px;
    text-align: center;
    flex-shrink: 0;
    font-size: $font-size-base;
  }

  .item-label {
    font-size: $font-size-sm;
    font-weight: 500;
  }
</style>
