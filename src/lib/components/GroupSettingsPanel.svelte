<script lang="ts">
  import { store } from '$lib/store.svelte';
  import { FIELD_GROUP_SCHEMA, HIDE_ON_SCREEN_OPTIONS } from '$lib/acf-field-schema';

  let { entityId, groupId }: { entityId: string; groupId: string } = $props();

  const group = $derived(
    store.entities.find(e => e.id === entityId)?.groups.find(g => g.id === groupId)
  );

  function getConfig(): Record<string, unknown> {
    return group?.config ?? {};
  }

  function getValue(key: string, defaultVal: unknown): unknown {
    return getConfig()[key] ?? defaultVal;
  }

  function updateValue(key: string, value: unknown) {
    const next = { ...getConfig(), [key]: value };
    store.updateGroupConfig(entityId, groupId, next);
  }

  function getHideOnScreen(): string[] {
    const val = getConfig().hide_on_screen;
    if (Array.isArray(val)) return val as string[];
    return [];
  }

  function toggleHideOnScreen(item: string) {
    const current = getHideOnScreen();
    const next = current.includes(item)
      ? current.filter(v => v !== item)
      : [...current, item];
    updateValue('hide_on_screen', next);
  }
</script>

{#if group}
<div class="group-settings">
  {#each FIELD_GROUP_SCHEMA as prop (prop.key)}
    <div class="setting-row">
      <label class="setting-label">{prop.label}</label>
      <div class="setting-control">
        {#if prop.type === 'toggle'}
          <label class="toggle-wrap">
            <input type="checkbox"
              checked={!!getValue(prop.key, prop.default)}
              onchange={(e) => updateValue(prop.key, (e.target as HTMLInputElement).checked ? 1 : 0)} />
            <span>{getValue(prop.key, prop.default) ? '是' : '否'}</span>
          </label>
        {:else if prop.type === 'select' && prop.options}
          <select class="si"
            value={String(getValue(prop.key, prop.default))}
            onchange={(e) => updateValue(prop.key, (e.target as HTMLSelectElement).value)}>
            {#each prop.options as opt}
              <option value={String(opt.value)}>{opt.label}</option>
            {/each}
          </select>
        {:else if prop.type === 'textarea'}
          <textarea class="si si-textarea"
            value={String(getValue(prop.key, prop.default) ?? '')}
            oninput={(e) => updateValue(prop.key, (e.target as HTMLTextAreaElement).value)}
            rows="2"></textarea>
        {:else}
          <input type="text" class="si"
            value={String(getValue(prop.key, prop.default) ?? '')}
            oninput={(e) => updateValue(prop.key, (e.target as HTMLInputElement).value)} />
        {/if}
      </div>
    </div>
  {/each}

  <div class="setting-row" style="align-items: flex-start">
    <label class="setting-label">隐藏项</label>
    <div class="setting-control">
      <div class="hide-options">
        {#each HIDE_ON_SCREEN_OPTIONS as opt}
          <label class="hide-option">
            <input type="checkbox"
              checked={getHideOnScreen().includes(opt.value)}
              onchange={() => toggleHideOnScreen(opt.value)} />
            <span>{opt.label}</span>
          </label>
        {/each}
      </div>
    </div>
  </div>
</div>
{/if}

<style lang="scss">
  .group-settings {
    padding: $spacing-sm $spacing-md;
    background: $color-bg-light;
    border: 1px solid $color-border-light;
    border-radius: $border-radius;
    margin-bottom: $spacing-sm;
  }

  .setting-row {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    margin-bottom: $spacing-xs;

    &:last-child { margin-bottom: 0; }
  }

  .setting-label {
    font-size: $font-size-xs;
    color: $color-text-secondary;
    font-weight: 500;
    width: 70px;
    flex-shrink: 0;
  }

  .setting-control {
    flex: 1;
    min-width: 0;
  }

  .si {
    width: 100%;
    padding: $spacing-xs $spacing-sm;
    border: 1px solid $color-border-light;
    border-radius: $border-radius;
    font-size: $font-size-xs;
    color: $color-text;
    background: $color-surface;
    outline: none;

    &:focus { border-color: $color-primary; }
  }

  .si-textarea {
    resize: vertical;
    min-height: 32px;
  }

  .toggle-wrap {
    display: flex;
    align-items: center;
    gap: $spacing-xs;
    font-size: $font-size-xs;
    cursor: pointer;
    input { accent-color: $color-primary; }
  }

  .hide-options {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-xs $spacing-md;
  }

  .hide-option {
    display: flex;
    align-items: center;
    gap: $spacing-xs;
    font-size: $font-size-xs;
    cursor: pointer;
    input { accent-color: $color-primary; }
  }
</style>
