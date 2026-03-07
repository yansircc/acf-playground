<script lang="ts">
  import type { Field, FieldType, Entity } from '$lib/types';
  import { store } from '$lib/store.svelte';

  const entity: Entity | undefined = $derived(store.currentEntity);
  const data: Record<string, unknown>[] = $derived(store.currentData);

  function getFieldValue(fieldId: string, rowIndex = 0): unknown {
    return data[rowIndex]?.[fieldId] ?? '';
  }

  function getRepeaterRows(fieldId: string, rowIndex = 0): Record<string, unknown>[] {
    const val = data[rowIndex]?.[fieldId];
    return Array.isArray(val) ? val : [{}];
  }

  function handleInput(fieldId: string, value: unknown, rowIndex = 0) {
    if (!entity) return;
    store.updateFieldData(entity.id, fieldId, value, rowIndex);
  }

  function handleRepeaterInput(fieldId: string, subFieldId: string, value: unknown, repeatIndex: number, rowIndex = 0) {
    if (!entity) return;
    store.updateRepeaterData(entity.id, fieldId, subFieldId, value, rowIndex, repeatIndex);
  }

  function addRepeatRow(fieldId: string, rowIndex = 0) {
    if (!entity) return;
    store.addRepeaterRow(entity.id, fieldId, rowIndex);
  }

  function removeRepeatRow(fieldId: string, repeatIndex: number, rowIndex = 0) {
    if (!entity) return;
    store.removeRepeaterRow(entity.id, fieldId, repeatIndex, rowIndex);
  }

  function handleFieldNameChange(fieldId: string, name: string) {
    if (!entity) return;
    store.updateField(entity.id, fieldId, { name });
  }

  function handleRefTargetChange(field: Field, target: string) {
    if (!entity || field.type.kind !== 'ref') return;
    field.type.target = target;
  }

  // Get other entities for ref field dropdown
  const otherEntities = $derived(
    store.entities.filter((e) => entity && e.id !== entity.id)
  );

  function subtypeLabel(type: FieldType): string {
    switch (type.kind) {
      case 'atom': return type.subtype.charAt(0).toUpperCase() + type.subtype.slice(1);
      case 'repeat': return 'Repeater';
      case 'ref': return type.cardinality === '1' ? 'Post Object' : 'Relationship';
    }
  }
</script>

<div class="form-panel">
  {#if entity}
    <div class="panel-header">
      <input
        class="entity-name-input"
        type="text"
        value={entity.name}
        oninput={(e) => { entity.name = (e.target as HTMLInputElement).value; }}
      />
      <span class="field-count">{entity.fields.length} fields</span>
    </div>

    <div class="form-body">
      {#if entity.fields.length === 0}
        <div class="empty-state">
          Drag fields from the toolbox onto the entity node
        </div>
      {/if}

      {#each entity.fields as field (field.id)}
        <div class="field-group">
          <div class="field-header">
            <span class="field-type-badge">{subtypeLabel(field.type)}</span>
            <input
              class="field-name-input"
              type="text"
              value={field.name}
              oninput={(e) => handleFieldNameChange(field.id, (e.target as HTMLInputElement).value)}
            />
          </div>

          <div class="field-control">
            {#if field.type.kind === 'atom'}
              {#if field.type.subtype === 'text'}
                <input
                  type="text"
                  class="wp-input"
                  value={getFieldValue(field.id) as string}
                  oninput={(e) => handleInput(field.id, (e.target as HTMLInputElement).value)}
                  placeholder="Enter text..."
                />
              {:else if field.type.subtype === 'number'}
                <input
                  type="number"
                  class="wp-input"
                  value={getFieldValue(field.id) as string}
                  oninput={(e) => handleInput(field.id, (e.target as HTMLInputElement).value)}
                  placeholder="0"
                />
              {:else if field.type.subtype === 'email'}
                <input
                  type="email"
                  class="wp-input"
                  value={getFieldValue(field.id) as string}
                  oninput={(e) => handleInput(field.id, (e.target as HTMLInputElement).value)}
                  placeholder="user@example.com"
                />
              {:else if field.type.subtype === 'url'}
                <input
                  type="url"
                  class="wp-input"
                  value={getFieldValue(field.id) as string}
                  oninput={(e) => handleInput(field.id, (e.target as HTMLInputElement).value)}
                  placeholder="https://..."
                />
              {:else if field.type.subtype === 'textarea'}
                <textarea
                  class="wp-input wp-textarea"
                  value={getFieldValue(field.id) as string}
                  oninput={(e) => handleInput(field.id, (e.target as HTMLTextAreaElement).value)}
                  placeholder="Enter text..."
                  rows="3"
                ></textarea>
              {:else if field.type.subtype === 'image'}
                <input
                  type="url"
                  class="wp-input"
                  value={getFieldValue(field.id) as string}
                  oninput={(e) => handleInput(field.id, (e.target as HTMLInputElement).value)}
                  placeholder="Image URL..."
                />
                {#if getFieldValue(field.id)}
                  <img
                    class="image-preview"
                    src={getFieldValue(field.id) as string}
                    alt="Preview"
                    onerror={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                {/if}
              {/if}

            {:else if field.type.kind === 'ref'}
              <select
                class="wp-input"
                value={field.type.target}
                onchange={(e) => handleRefTargetChange(field, (e.target as HTMLSelectElement).value)}
              >
                <option value="">-- Select Entity --</option>
                {#each otherEntities as other}
                  <option value={other.id}>{other.name}</option>
                {/each}
              </select>

            {:else if field.type.kind === 'repeat'}
              <div class="repeater-group">
                {#each getRepeaterRows(field.id) as repeatRow, ri}
                  <div class="repeater-row">
                    <span class="row-index">#{ri + 1}</span>
                    {#each field.type.fields as subField (subField.id)}
                      <div class="sub-field">
                        <label class="sub-label">{subField.name}</label>
                        <input
                          type="text"
                          class="wp-input wp-input-sm"
                          value={(repeatRow[subField.id] ?? '') as string}
                          oninput={(e) => handleRepeaterInput(field.id, subField.id, (e.target as HTMLInputElement).value, ri)}
                        />
                      </div>
                    {/each}
                    {#if field.type.fields.length === 0}
                      <span class="empty-hint">Drop fields on this repeater node</span>
                    {/if}
                    <button class="remove-row-btn" onclick={() => removeRepeatRow(field.id, ri)}>&times;</button>
                  </div>
                {/each}
                <button class="add-row-btn" onclick={() => addRepeatRow(field.id)}>
                  + Add Row
                </button>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="empty-state full">
      <p>Select an entity to edit its fields</p>
    </div>
  {/if}
</div>

<style lang="scss">
  .form-panel {
    width: $panel-min-width;
    background: $color-bg;
    display: flex;
    flex-direction: column;
    overflow: hidden;
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

  .field-group {
    background: $color-surface;
    border: 1px solid $color-border-light;
    border-radius: $border-radius;
    margin-bottom: $spacing-md;
    overflow: hidden;
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

  .wp-input-sm {
    padding: $spacing-xs $spacing-sm;
    font-size: $font-size-sm;
  }

  .image-preview {
    margin-top: $spacing-sm;
    max-width: 100%;
    max-height: 120px;
    border-radius: $border-radius;
    border: 1px solid $color-border-light;
    object-fit: cover;
  }

  .repeater-group {
    display: flex;
    flex-direction: column;
    gap: $spacing-sm;
  }

  .repeater-row {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-sm;
    align-items: center;
    padding: $spacing-sm;
    border: 1px dashed $color-border;
    border-radius: $border-radius;
    background: $color-bg-lighter;
  }

  .row-index {
    font-size: $font-size-xs;
    color: $color-text-muted;
    font-weight: 600;
    width: 24px;
  }

  .sub-field {
    flex: 1;
    min-width: 100px;
  }

  .sub-label {
    display: block;
    font-size: $font-size-xs;
    color: $color-text-secondary;
    margin-bottom: 2px;
  }

  .remove-row-btn {
    color: $color-danger;
    font-size: $font-size-lg;
    padding: $spacing-xs;
    opacity: 0.5;

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

  .empty-hint {
    font-size: $font-size-xs;
    color: $color-text-muted;
    font-style: italic;
  }
</style>
