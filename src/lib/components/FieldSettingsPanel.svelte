<script lang="ts">
  import type { Field, FieldGroup } from '$lib/types';
  import { store } from '$lib/store.svelte';
  import { getSchemaForField, setConfigValue, type ConfigPropertyDef } from '$lib/acf-field-schema';
  import ConditionalLogicEditor from './ConditionalLogicEditor.svelte';

  let { field, entityId }: { field: Field; entityId: string } = $props();

  const schema = $derived(getSchemaForField(field));

  // Find the group this field belongs to
  const fieldGroup = $derived(() => {
    const entity = store.entities.find(e => e.id === entityId);
    if (!entity) return undefined;
    return entity.groups.find(g => g.fields.some(f => f.id === field.id));
  });

  function getValue(prop: ConfigPropertyDef): unknown {
    if (prop.nested) {
      const parent = field.config?.[prop.nested] as Record<string, unknown> | undefined;
      return parent?.[prop.key] ?? prop.default;
    }
    return field.config?.[prop.key] ?? prop.default;
  }

  function handleChange(prop: ConfigPropertyDef, value: unknown) {
    const current = field.config ?? {};
    const next = setConfigValue(current, prop, value);
    store.updateFieldConfig(entityId, field.id, next);
  }

  // Group properties by group field
  const grouped = $derived(() => {
    const groups = new Map<string, ConfigPropertyDef[]>();
    const ungrouped: ConfigPropertyDef[] = [];
    for (const prop of schema) {
      if (prop.key === 'choices' || prop.key === 'conditional_logic') continue;
      if (prop.group) {
        const arr = groups.get(prop.group) ?? [];
        arr.push(prop);
        groups.set(prop.group, arr);
      } else {
        ungrouped.push(prop);
      }
    }
    return { ungrouped, groups };
  });

  let expandedGroups: Set<string> = $state(new Set());

  function toggleGroup(name: string) {
    const next = new Set(expandedGroups);
    if (next.has(name)) next.delete(name); else next.add(name);
    expandedGroups = next;
  }
</script>

<div class="field-settings">
  {#each grouped().ungrouped as prop (prop.key)}
    <div class="setting-row">
      <label class="setting-label">{prop.label}</label>
      <div class="setting-control">
        {#if prop.type === 'toggle'}
          <label class="toggle-wrap">
            <input type="checkbox"
              checked={!!getValue(prop)}
              onchange={(e) => handleChange(prop, (e.target as HTMLInputElement).checked ? 1 : 0)} />
            <span>{getValue(prop) ? '是' : '否'}</span>
          </label>
        {:else if prop.type === 'select' && prop.options}
          <select class="si"
            value={String(getValue(prop))}
            onchange={(e) => handleChange(prop, (e.target as HTMLSelectElement).value)}>
            {#each prop.options as opt}
              <option value={String(opt.value)}>{opt.label}</option>
            {/each}
          </select>
        {:else if prop.type === 'textarea'}
          <textarea class="si si-textarea"
            value={String(getValue(prop) ?? '')}
            oninput={(e) => handleChange(prop, (e.target as HTMLTextAreaElement).value)}
            rows="2"></textarea>
        {:else if prop.type === 'number'}
          <input type="number" class="si"
            value={String(getValue(prop) ?? '')}
            oninput={(e) => handleChange(prop, Number((e.target as HTMLInputElement).value))} />
        {:else}
          <input type="text" class="si"
            value={String(getValue(prop) ?? '')}
            oninput={(e) => handleChange(prop, (e.target as HTMLInputElement).value)} />
        {/if}
      </div>
    </div>
  {/each}

  {#each [...grouped().groups.entries()] as [groupName, props] (groupName)}
    <div class="setting-group">
      <button class="group-toggle" onclick={() => toggleGroup(groupName)}>
        <span class="group-arrow">{expandedGroups.has(groupName) ? '▾' : '▸'}</span>
        {groupName}
      </button>
      {#if expandedGroups.has(groupName)}
        <div class="group-content">
          {#each props as prop (prop.key)}
            <div class="setting-row">
              <label class="setting-label">{prop.label}</label>
              <div class="setting-control">
                {#if prop.type === 'toggle'}
                  <label class="toggle-wrap">
                    <input type="checkbox"
                      checked={!!getValue(prop)}
                      onchange={(e) => handleChange(prop, (e.target as HTMLInputElement).checked ? 1 : 0)} />
                    <span>{getValue(prop) ? '是' : '否'}</span>
                  </label>
                {:else if prop.type === 'select' && prop.options}
                  <select class="si"
                    value={String(getValue(prop))}
                    onchange={(e) => handleChange(prop, (e.target as HTMLSelectElement).value)}>
                    {#each prop.options as opt}
                      <option value={String(opt.value)}>{opt.label}</option>
                    {/each}
                  </select>
                {:else if prop.type === 'number'}
                  <input type="number" class="si"
                    value={String(getValue(prop) ?? '')}
                    oninput={(e) => handleChange(prop, Number((e.target as HTMLInputElement).value))} />
                {:else}
                  <input type="text" class="si"
                    value={String(getValue(prop) ?? '')}
                    oninput={(e) => handleChange(prop, (e.target as HTMLInputElement).value)} />
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/each}

  {#if fieldGroup()}
    <ConditionalLogicEditor {field} {entityId} group={fieldGroup()!} />
  {/if}
</div>

<style lang="scss">
  .field-settings {
    padding: $spacing-sm;
    border-top: 1px dashed $color-border-light;
    background: $color-bg-light;
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

    &:focus {
      border-color: $color-primary;
    }
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

  .setting-group {
    margin-top: $spacing-xs;
  }

  .group-toggle {
    display: flex;
    align-items: center;
    gap: $spacing-xs;
    font-size: $font-size-xs;
    font-weight: 600;
    color: $color-text-secondary;
    cursor: pointer;
    padding: $spacing-xs 0;
    background: none;
    border: none;
    width: 100%;
    text-align: left;

    &:hover { color: $color-text; }
  }

  .group-arrow {
    width: 12px;
    font-size: $font-size-xs;
  }

  .group-content {
    padding-left: $spacing-md;
    padding-top: $spacing-xs;
  }
</style>
