<script lang="ts">
  import type { Field, Entity } from '$lib/types';
  import { store } from '$lib/store.svelte';

  interface Props {
    field: Field;
    entity: Entity;
    rowIndex: number;
    value: unknown;
    onchange: (value: unknown) => void;
  }

  let { field, entity, rowIndex, value, onchange }: Props = $props();

  const otherEntities = $derived(
    store.entities.filter((e) => e.id !== entity.id)
  );
</script>

{#if field.type.kind === 'ref'}
  {#if field.type.target === ''}
    <!-- Schema config: pick target entity -->
    <select
      class="wp-input"
      value={field.type.target}
      onchange={(e) => {
        store.updateRefTarget(entity.id, field.id, (e.target as HTMLSelectElement).value);
      }}
    >
      <option value="">-- 选择实体 --</option>
      {#each otherEntities as other}
        <option value={other.id}>{other.name}</option>
      {/each}
    </select>
  {:else if field.type.cardinality === '1' || field.type.cardinality === 'taxonomy'}
    <!-- Ref(1) / taxonomy: dropdown to pick a record -->
    {@const refOptions = store.getRefOptions(field.type.target)}
    <select
      class="wp-input"
      value={String(value ?? '')}
      onchange={(e) => {
        const val = (e.target as HTMLSelectElement).value;
        onchange(val === '' ? '' : Number(val));
      }}
    >
      <option value="">-- 选择记录 --</option>
      {#each refOptions as opt}
        <option value={String(opt.index)}>{opt.label}</option>
      {/each}
    </select>
  {:else}
    <!-- Ref(n): checkbox list to multi-select records -->
    {@const refOptions = store.getRefOptions(field.type.target)}
    {@const currentVal = (value || []) as number[]}
    <div class="checkbox-list">
      {#each refOptions as opt}
        <label class="checkbox-item">
          <input
            type="checkbox"
            checked={Array.isArray(currentVal) && currentVal.includes(opt.index)}
            onchange={() => {
              const arr = Array.isArray(currentVal) ? [...currentVal] : [];
              const idx = arr.indexOf(opt.index);
              if (idx >= 0) arr.splice(idx, 1);
              else arr.push(opt.index);
              onchange(arr);
            }}
          />
          <span>{opt.label}</span>
        </label>
      {/each}
      {#if refOptions.length === 0}
        <span class="empty-hint">目标实体暂无记录</span>
      {/if}
    </div>
  {/if}
{/if}

<style lang="scss">
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

  .checkbox-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: $spacing-xs 0;
  }

  .checkbox-item {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    padding: $spacing-xs $spacing-sm;
    border-radius: $border-radius;
    font-size: $font-size-sm;
    cursor: pointer;

    &:hover {
      background: $color-bg;
    }

    input[type="checkbox"] {
      accent-color: $color-primary;
    }
  }

  .empty-hint {
    font-size: $font-size-xs;
    color: $color-text-muted;
    font-style: italic;
    padding: $spacing-sm;
    text-align: center;
  }
</style>
