<script lang="ts">
  import type { Entity, Field } from '$lib/types';
  import { store } from '$lib/store.svelte';

  const entity: Entity | undefined = $derived(store.currentEntity);
  const data: Record<string, unknown>[] = $derived(store.currentData);

  function getValue(fieldId: string, rowIndex = 0): unknown {
    return data[rowIndex]?.[fieldId];
  }

  function getRepeaterRows(fieldId: string, rowIndex = 0): Record<string, unknown>[] {
    const val = data[rowIndex]?.[fieldId];
    return Array.isArray(val) ? val : [];
  }

  function getRefEntityName(targetId: string): string {
    const target = store.entities.find((e) => e.id === targetId);
    return target ? target.name : '(unlinked)';
  }

  function isEmpty(val: unknown): boolean {
    if (val === null || val === undefined || val === '') return true;
    if (Array.isArray(val) && val.length === 0) return true;
    return false;
  }
</script>

<div class="preview-panel">
  {#if entity}
    <div class="panel-header">
      <h2 class="preview-title">Preview</h2>
    </div>

    <div class="preview-body">
      <div class="preview-card">
        <h3 class="card-title">{entity.name}</h3>

        {#each entity.fields as field (field.id)}
          <div class="card-field">
            {#if field.type.kind === 'atom' && field.type.subtype === 'image'}
              {#if !isEmpty(getValue(field.id))}
                <img
                  class="card-image"
                  src={getValue(field.id) as string}
                  alt={field.name}
                  onerror={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              {:else}
                <div class="card-image-placeholder">{field.name}</div>
              {/if}

            {:else if field.type.kind === 'atom'}
              <div class="card-label">{field.name}</div>
              {#if !isEmpty(getValue(field.id))}
                <div class="card-value">
                  {#if field.type.subtype === 'url'}
                    <a href={getValue(field.id) as string} target="_blank" rel="noopener">
                      {getValue(field.id)}
                    </a>
                  {:else if field.type.subtype === 'email'}
                    <a href="mailto:{getValue(field.id)}">
                      {getValue(field.id)}
                    </a>
                  {:else}
                    {getValue(field.id)}
                  {/if}
                </div>
              {:else}
                <div class="card-value empty">--</div>
              {/if}

            {:else if field.type.kind === 'ref'}
              <div class="card-label">{field.name}</div>
              {#if field.type.target}
                <div class="card-ref" onclick={() => store.setSelected(field.type.kind === 'ref' ? field.type.target : '')} role="button" tabindex="0" onkeydown={() => {}}>
                  {getRefEntityName(field.type.target)}
                </div>
              {:else}
                <div class="card-value empty">Not linked</div>
              {/if}

            {:else if field.type.kind === 'repeat'}
              <div class="card-label">{field.name}</div>
              {#if getRepeaterRows(field.id).length > 0}
                <div class="card-repeater">
                  {#each getRepeaterRows(field.id) as row, ri}
                    <div class="repeater-entry">
                      <span class="entry-index">{ri + 1}.</span>
                      {#each field.type.fields as subField}
                        {#if !isEmpty(row[subField.id])}
                          <span class="entry-value">
                            <span class="entry-label">{subField.name}:</span> {row[subField.id]}
                          </span>
                        {/if}
                      {/each}
                      {#if field.type.fields.length === 0}
                        <span class="entry-empty">No sub-fields</span>
                      {/if}
                    </div>
                  {/each}
                </div>
              {:else}
                <div class="card-value empty">No rows</div>
              {/if}
            {/if}
          </div>
        {/each}

        {#if entity.fields.length === 0}
          <div class="card-empty">No fields added yet</div>
        {/if}
      </div>
    </div>
  {:else}
    <div class="empty-state">
      <p>Select an entity to preview</p>
    </div>
  {/if}
</div>

<style lang="scss">
  .preview-panel {
    width: $panel-min-width;
    background: $color-surface;
    border-left: 1px solid $color-border;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .panel-header {
    padding: $spacing-md;
    border-bottom: 1px solid $color-border;
  }

  .preview-title {
    font-size: $font-size-base;
    font-weight: 600;
    color: $color-text-secondary;
    margin: 0;
  }

  .preview-body {
    flex: 1;
    overflow-y: auto;
    padding: $spacing-md;
  }

  .preview-card {
    background: $color-surface;
    border: 1px solid $color-border-light;
    border-radius: $border-radius-lg;
    box-shadow: $shadow-sm;
    overflow: hidden;
  }

  .card-title {
    font-size: $font-size-lg;
    font-weight: 700;
    padding: $spacing-md $spacing-lg;
    background: linear-gradient(135deg, $color-primary, $color-accent);
    color: white;
    margin: 0;
  }

  .card-field {
    padding: $spacing-sm $spacing-lg;
    border-bottom: 1px solid $color-border-light;

    &:last-child {
      border-bottom: none;
    }
  }

  .card-label {
    font-size: $font-size-xs;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: $color-text-muted;
    margin-bottom: 2px;
  }

  .card-value {
    font-size: $font-size-base;
    color: $color-text;

    &.empty {
      color: $color-text-muted;
      font-style: italic;
    }

    a {
      color: $color-primary;
      text-decoration: underline;
    }
  }

  .card-image {
    width: 100%;
    max-height: 200px;
    object-fit: cover;
    display: block;
  }

  .card-image-placeholder {
    width: 100%;
    height: 120px;
    background: $color-bg;
    display: flex;
    align-items: center;
    justify-content: center;
    color: $color-text-muted;
    font-style: italic;
  }

  .card-ref {
    display: inline-block;
    padding: 2px $spacing-sm;
    background: $color-primary-bg;
    color: $color-primary;
    border-radius: $border-radius;
    font-size: $font-size-sm;
    cursor: pointer;
    font-weight: 500;

    &:hover {
      background: $color-primary-bg-hover;
    }
  }

  .card-repeater {
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
    margin-top: $spacing-xs;
  }

  .repeater-entry {
    display: flex;
    align-items: baseline;
    gap: $spacing-sm;
    padding: $spacing-xs $spacing-sm;
    background: $color-bg;
    border-radius: $border-radius;
    flex-wrap: wrap;
  }

  .entry-index {
    font-size: $font-size-xs;
    color: $color-text-muted;
    font-weight: 600;
  }

  .entry-value {
    font-size: $font-size-sm;
  }

  .entry-label {
    color: $color-text-secondary;
  }

  .entry-empty {
    color: $color-text-muted;
    font-style: italic;
    font-size: $font-size-xs;
  }

  .card-empty {
    padding: $spacing-lg;
    text-align: center;
    color: $color-text-muted;
    font-style: italic;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: $color-text-muted;
    font-style: italic;
  }
</style>
