<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';
  import type { NodeProps } from '@xyflow/svelte';
  import type { Entity, FieldType } from '$lib/types';
  import { store } from '$lib/store.svelte';
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
          case 'email': return '@';
          case 'url': return '🔗';
          case 'image': return '🖼';
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
    <button class="delete-btn" onclick={() => store.removeEntity(entity.id)} title="Delete entity">&times;</button>
  </div>

  <div class="entity-fields">
    {#if entity.fields.length === 0}
      <div class="empty-hint">拖入字段到此处</div>
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
