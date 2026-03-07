<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';
  import type { NodeProps } from '@xyflow/svelte';
  import type { Entity, FieldType } from '$lib/types';
  import { store } from '$lib/store.svelte';

  let { data }: NodeProps = $props();

  const entity: Entity = $derived(data.entity as Entity);
  const isSelected: boolean = $derived(data.selected as boolean);

  function fieldIcon(type: FieldType): string {
    switch (type.kind) {
      case 'atom':
        switch (type.subtype) {
          case 'text': return 'Aa';
          case 'textarea': return '\u00b6';
          case 'number': return '#';
          case 'email': return '@';
          case 'url': return '\u{1f517}';
          case 'image': return '\u{1f5bc}';
        }
        break;
      case 'repeat': return '\u{1f501}';
      case 'ref': return type.cardinality === '1' ? '\u2192' : '\u21c9';
    }
    return '?';
  }

  function removeField(fieldId: string) {
    store.removeField(entity.id, fieldId);
  }
</script>

<Handle type="target" position={Position.Left} />

<div
  class="entity-node"
  class:selected={isSelected}
  role="group"
>
  <div class="entity-header">
    <span class="entity-name">{entity.name}</span>
    <button class="delete-btn" onclick={() => store.removeEntity(entity.id)} title="Delete entity">&times;</button>
  </div>

  <div class="entity-fields">
    {#if entity.fields.length === 0}
      <div class="empty-hint">Drop fields here</div>
    {/if}
    {#each entity.fields as field (field.id)}
      <div class="field-row">
        <span class="field-icon">{fieldIcon(field.type)}</span>
        <span class="field-name">{field.name}</span>
        <button class="field-remove" onclick={() => removeField(field.id)}>&times;</button>
        {#if field.type.kind === 'ref'}
          <Handle type="source" position={Position.Right} id={field.id} />
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
