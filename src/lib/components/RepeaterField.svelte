<script lang="ts">
  import type { Field, FieldType, Entity, AtomSubtype } from '$lib/types';
  import { ATOM_GROUPS } from '$lib/field-catalog';
  import { store } from '$lib/store.svelte';
  import { tick } from 'svelte';
  import AtomValueInput from './AtomValueInput.svelte';

  interface Props {
    field: Field & { type: { kind: 'repeat'; fields: Field[] } };
    entity: Entity;
    rowIndex: number;
  }

  let { field, entity, rowIndex }: Props = $props();

  const otherEntities = $derived(
    store.entities.filter((e) => e.id !== entity.id)
  );

  function getRepeaterRows(): Record<string, unknown>[] {
    const val = store.data[entity.id]?.[rowIndex]?.[field.id];
    return Array.isArray(val) ? val : [{}];
  }

  function addSubField(fieldType: FieldType, initialConfig?: Record<string, unknown>) {
    store.addSubField(entity.id, field.id, fieldType, initialConfig);
  }

  function removeSubField(subFieldId: string) {
    store.removeSubField(entity.id, field.id, subFieldId);
  }

  function handleCellInput(subFieldId: string, value: unknown, repeatIndex: number) {
    store.updateRepeaterData(entity.id, field.id, subFieldId, value, rowIndex, repeatIndex);
  }

  function addRow() {
    store.addRepeaterRow(entity.id, field.id, rowIndex);
  }

  function removeRow(repeatIndex: number) {
    store.removeRepeaterRow(entity.id, field.id, repeatIndex, rowIndex);
  }

  // --- Sub-field rename (double-click on tag or column header) ---
  let editingSubFieldId: string | null = $state(null);
  let editSubFieldName = $state('');
  let editSubFieldInput: HTMLInputElement | undefined = $state();

  async function startSubFieldEdit(sf: Field) {
    editingSubFieldId = sf.id;
    editSubFieldName = sf.name;
    await tick();
    editSubFieldInput?.focus();
    editSubFieldInput?.select();
  }

  function commitSubFieldEdit(subFieldId: string) {
    const trimmed = editSubFieldName.trim();
    if (trimmed) {
      store.updateField(entity.id, subFieldId, { name: trimmed });
    }
    editingSubFieldId = null;
  }
</script>

<div class="repeater-group">
  <div class="sub-field-bar">
    <span class="sub-field-label">子字段：</span>
    {#each field.type.fields as sf (sf.id)}
      {#if editingSubFieldId === sf.id}
        <input
          class="sub-field-edit"
          bind:this={editSubFieldInput}
          bind:value={editSubFieldName}
          onblur={() => commitSubFieldEdit(sf.id)}
          onkeydown={(e) => { if (e.key === 'Enter') commitSubFieldEdit(sf.id); if (e.key === 'Escape') editingSubFieldId = null; }}
        />
      {:else}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <span class="sub-field-tag" ondblclick={() => startSubFieldEdit(sf)} title="双击改名">
          {sf.name}
          <button class="tag-remove" onclick={() => removeSubField(sf.id)}>&times;</button>
        </span>
      {/if}
    {/each}
    <select
      class="add-sub-select"
      onchange={(e) => {
        const sel = e.target as HTMLSelectElement;
        if (!sel.value) return;
        if (sel.value.startsWith('ref:')) {
          const targetId = sel.value.slice(4);
          addSubField({ kind: 'ref', target: targetId, cardinality: '1' });
        } else {
          const subtype = sel.value as AtomSubtype;
          const opt = ATOM_GROUPS.flatMap(g => g.options).find(o => o.value === subtype);
          const initialConfig = opt?.initialConfig?.();
          addSubField(opt ? opt.defaultFieldType() : { kind: 'atom', subtype }, initialConfig);
        }
        sel.value = '';
      }}
    >
      <option value="">+ 添加</option>
      {#each ATOM_GROUPS as group}
        <optgroup label={group.label}>
          {#each group.options as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </optgroup>
      {/each}
      {#if otherEntities.length > 0}
        <optgroup label="引用">
          {#each otherEntities as refEnt}
            <option value="ref:{refEnt.id}">{refEnt.name}</option>
          {/each}
        </optgroup>
      {/if}
    </select>
  </div>

  {#if field.type.fields.length > 0}
    <div class="excel-wrapper">
      <table class="excel-table">
        <thead>
          <tr>
            <th class="col-index">#</th>
            {#each field.type.fields as subField (subField.id)}
              {#if editingSubFieldId === subField.id}
                <th>
                  <input
                    class="col-edit"
                    bind:this={editSubFieldInput}
                    bind:value={editSubFieldName}
                    onblur={() => commitSubFieldEdit(subField.id)}
                    onkeydown={(e) => { if (e.key === 'Enter') commitSubFieldEdit(subField.id); if (e.key === 'Escape') editingSubFieldId = null; }}
                  />
                </th>
              {:else}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <th ondblclick={() => startSubFieldEdit(subField)} class="editable" title="双击改名">{subField.name}</th>
              {/if}
            {/each}
            <th class="col-action"></th>
          </tr>
        </thead>
        <tbody>
          {#each getRepeaterRows() as repeatRow, rri}
            <tr>
              <td class="col-index">{rri + 1}</td>
              {#each field.type.fields as subField (subField.id)}
                <td>
                  {#if subField.type.kind === 'ref'}
                    {@const sfRefOptions = store.getRefOptions(subField.type.target)}
                    <select
                      class="cell-input"
                      value={String(repeatRow[subField.id] ?? '')}
                      onchange={(e) => {
                        const val = (e.target as HTMLSelectElement).value;
                        handleCellInput(subField.id, val === '' ? '' : Number(val), rri);
                      }}
                    >
                      <option value="">--</option>
                      {#each sfRefOptions as opt}
                        <option value={String(opt.index)}>{opt.label}</option>
                      {/each}
                    </select>
                  {:else}
                    <AtomValueInput
                      field={subField}
                      value={repeatRow[subField.id] ?? ''}
                      onchange={(v) => handleCellInput(subField.id, v, rri)}
                      rowIndex={rri}
                      variant="table"
                    />
                  {/if}
                </td>
              {/each}
              <td class="col-action">
                <button class="remove-row-btn" onclick={() => removeRow(rri)}>&times;</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <div class="empty-hint">用上方「+ 添加」按钮添加子字段</div>
  {/if}

  <button class="add-row-btn" onclick={addRow}>
    + 添加行
  </button>
</div>

<style lang="scss">
  .repeater-group {
    display: flex;
    flex-direction: column;
    gap: $spacing-sm;
  }

  .sub-field-bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: $spacing-xs;
    padding: $spacing-xs 0;
    border-bottom: 1px dashed $color-border-light;
    margin-bottom: $spacing-xs;
  }

  .sub-field-label {
    font-size: $font-size-xs;
    color: $color-text-secondary;
    font-weight: 600;
    margin-right: $spacing-xs;
  }

  .sub-field-tag {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 2px $spacing-sm;
    background: $color-primary-light;
    color: $color-primary;
    border-radius: 10px;
    font-size: $font-size-xs;
    font-weight: 500;
    cursor: default;

    &:hover {
      background: $color-primary-bg-hover;
    }
  }

  .sub-field-edit {
    padding: 2px $spacing-sm;
    border: 1px solid $color-primary;
    border-radius: 10px;
    font-size: $font-size-xs;
    font-weight: 500;
    color: $color-primary;
    outline: none;
    min-width: 0;
    width: 80px;
  }

  .tag-remove {
    font-size: $font-size-xs;
    color: $color-primary;
    opacity: 0.6;
    line-height: 1;
    padding: 0 2px;

    &:hover {
      opacity: 1;
      color: $color-danger;
    }
  }

  .add-sub-select {
    padding: 2px $spacing-sm;
    border: 1px dashed $color-primary;
    border-radius: $border-radius;
    font-size: $font-size-xs;
    color: $color-primary;
    background: transparent;
    cursor: pointer;

    &:focus {
      outline: none;
      border-color: $color-primary;
    }
  }

  .excel-wrapper {
    overflow-x: auto;
    border: 1px solid $color-border;
    border-radius: $border-radius;
  }

  .excel-table {
    width: 100%;
    border-collapse: collapse;
    font-size: $font-size-sm;

    th {
      background: $color-bg-light;
      font-weight: 600;
      font-size: $font-size-xs;
      color: $color-text-secondary;
      padding: $spacing-xs $spacing-sm;
      border-bottom: 1px solid $color-border;
      text-align: left;
      white-space: nowrap;

      &.editable {
        cursor: default;

        &:hover {
          color: $color-primary;
        }
      }
    }

    td {
      padding: 0;
      border-bottom: 1px solid $color-border-light;
    }

    tr:last-child td {
      border-bottom: none;
    }
  }

  .col-index {
    width: 32px;
    text-align: center;
    color: $color-text-muted;
    font-size: $font-size-xs;
    padding: $spacing-xs !important;
  }

  .col-action {
    width: 28px;
    text-align: center;
    padding: 0 !important;
  }

  .col-edit {
    width: 100%;
    border: 1px solid $color-primary;
    border-radius: $border-radius;
    font-size: $font-size-xs;
    font-weight: 600;
    padding: 2px $spacing-xs;
    outline: none;
    background: $color-surface;
  }

  .cell-input {
    width: 100%;
    border: none;
    background: transparent;
    padding: $spacing-xs $spacing-sm;
    font-size: $font-size-sm;
    color: $color-text;
    outline: none;

    &:focus {
      background: $color-primary-light;
    }
  }

  .remove-row-btn {
    color: $color-danger;
    font-size: $font-size-base;
    opacity: 0.3;
    padding: $spacing-xs;

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

  .empty-hint {
    font-size: $font-size-xs;
    color: $color-text-muted;
    font-style: italic;
    padding: $spacing-sm;
    text-align: center;
  }
</style>
