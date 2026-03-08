<script lang="ts">
  import type { Field, Entity } from '$lib/types';
  import { store } from '$lib/store.svelte';

  interface Props {
    entity: Entity;
  }

  let { entity }: Props = $props();

  const otherEntities = $derived(
    store.entities.filter((e) => e.id !== entity.id)
  );

  // === Taxonomy tree ===

  type TreeNode = {
    rowIndex: number;
    name: string;
    children: TreeNode[];
  };

  function buildTree(): TreeNode[] {
    const rows = store.data[entity.id] ?? [];
    const nameField = entity.fields.find((f) => f.type.kind === 'atom' && f.type.subtype === 'text');
    const parentField = entity.fields.find((f) => f.type.kind === 'ref' && f.type.target === entity.id);
    if (!nameField || !parentField) return [];

    const nodes: TreeNode[] = rows.map((row, i) => ({
      rowIndex: i,
      name: (row[nameField.id] as string) || `项目 ${i + 1}`,
      children: [],
    }));

    const roots: TreeNode[] = [];
    for (let i = 0; i < rows.length; i++) {
      const parentVal = rows[i][parentField.id];
      const parentIdx = typeof parentVal === 'number' ? parentVal : -1;
      if (parentIdx >= 0 && parentIdx < nodes.length && parentIdx !== i) {
        nodes[parentIdx].children.push(nodes[i]);
      } else {
        roots.push(nodes[i]);
      }
    }
    return roots;
  }

  function getSelfRefOptions(excludeRowIndex: number): { index: number; name: string }[] {
    const rows = store.data[entity.id] ?? [];
    const nameField = entity.fields.find((f) => f.type.kind === 'atom' && f.type.subtype === 'text');
    return rows
      .map((row, i) => ({ index: i, name: nameField ? (row[nameField.id] as string || `项目 ${i + 1}`) : `项目 ${i + 1}` }))
      .filter((_, i) => i !== excludeRowIndex);
  }

  function handleRefTargetChange(field: Field, target: string) {
    if (field.type.kind !== 'ref') return;
    store.updateRefTarget(entity.id, field.id, target);
  }

  const treeData = $derived(buildTree());
</script>

<!-- Taxonomy tree view -->
<div class="taxonomy-section">
  <div class="section-header">
    <span class="section-label">分类树</span>
    <button class="add-row-btn" onclick={() => {
      if (!store.data[entity.id]) store.data[entity.id] = [];
      store.data[entity.id].push({});
    }}>
      + 新分类项
    </button>
  </div>

  {#if treeData.length > 0}
    <div class="tree-view">
      {#snippet treeItem(node: TreeNode, depth: number)}
        <div class="tree-node" style="padding-left: {depth * 20 + 8}px">
          <span class="tree-icon">{node.children.length > 0 ? '▸' : '·'}</span>
          <span class="tree-name">{node.name}</span>
          <span class="tree-index">#{node.rowIndex + 1}</span>
        </div>
        {#each node.children as child}
          {@render treeItem(child, depth + 1)}
        {/each}
      {/snippet}
      {#each treeData as root}
        {@render treeItem(root, 0)}
      {/each}
    </div>
  {/if}
</div>

<!-- Row editor -->
{#each (store.data[entity.id] ?? []) as row, ri}
  <div class="field-group">
    <div class="field-header">
      <span class="field-type-badge taxonomy">#{ri + 1}</span>
      <span class="field-name-static">分类项</span>
      <button class="remove-row-inline" onclick={() => {
        store.data[entity.id]?.splice(ri, 1);
      }}>&times;</button>
    </div>
    <div class="field-control">
      {#each entity.fields as field (field.id)}
        <div class="inline-field">
          <span class="inline-label">{field.name}</span>
          {#if field.type.kind === 'atom'}
            <input
              type="text"
              class="wp-input wp-input-sm"
              value={(row[field.id] ?? '') as string}
              oninput={(e) => store.updateFieldData(entity.id, field.id, (e.target as HTMLInputElement).value, ri)}
              placeholder={field.name}
            />
          {:else if field.type.kind === 'ref' && field.type.target === entity.id}
            <select
              class="wp-input wp-input-sm"
              value={(row[field.id] ?? '') as string}
              onchange={(e) => {
                const val = (e.target as HTMLSelectElement).value;
                store.updateFieldData(entity.id, field.id, val === '' ? '' : Number(val), ri);
              }}
            >
              <option value="">-- 无父级 --</option>
              {#each getSelfRefOptions(ri) as opt}
                <option value={String(opt.index)}>{opt.name}</option>
              {/each}
            </select>
          {:else if field.type.kind === 'ref'}
            <select
              class="wp-input wp-input-sm"
              value={field.type.target}
              onchange={(e) => handleRefTargetChange(field, (e.target as HTMLSelectElement).value)}
            >
              <option value="">-- 选择实体 --</option>
              {#each otherEntities as other}
                <option value={other.id}>{other.name}</option>
              {/each}
            </select>
          {/if}
        </div>
      {/each}
    </div>
  </div>
{/each}

<style lang="scss">
  .taxonomy-section {
    margin-bottom: $spacing-md;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: $spacing-sm;
  }

  .section-label {
    font-size: $font-size-sm;
    font-weight: 600;
    color: $color-text;
  }

  .tree-view {
    background: $color-surface;
    border: 1px solid $color-border-light;
    border-radius: $border-radius;
    padding: $spacing-xs 0;
    margin-bottom: $spacing-sm;
  }

  .tree-node {
    display: flex;
    align-items: center;
    gap: $spacing-xs;
    padding: 3px $spacing-sm;
    font-size: $font-size-sm;

    &:hover {
      background: $color-bg;
    }
  }

  .tree-icon {
    width: 12px;
    text-align: center;
    color: $color-text-muted;
    font-size: $font-size-xs;
  }

  .tree-name {
    flex: 1;
    color: $color-text;
  }

  .tree-index {
    font-size: $font-size-xs;
    color: $color-text-muted;
  }

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

  .field-name-static {
    flex: 1;
    font-size: $font-size-sm;
    font-weight: 500;
    color: $color-text;
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

  .wp-input-sm {
    padding: $spacing-xs $spacing-sm;
    font-size: $font-size-sm;
  }

  .remove-row-inline {
    color: $color-danger;
    font-size: $font-size-lg;
    opacity: 0.4;
    padding: 0 $spacing-xs;
    margin-left: auto;

    &:hover {
      opacity: 1;
    }
  }

  .add-row-btn {
    align-self: flex-start;
    padding: $spacing-xs $spacing-md;
    font-size: $font-size-sm;
    color: $color-primary;
    border: 1px dashed $color-primary;
    border-radius: $border-radius;

    &:hover {
      background: $color-primary-lighter;
    }
  }

  .inline-field {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    margin-bottom: $spacing-xs;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .inline-label {
    font-size: $font-size-xs;
    color: $color-text-secondary;
    font-weight: 500;
    width: 50px;
    flex-shrink: 0;
  }
</style>
