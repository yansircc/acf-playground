<script lang="ts">
  import type { Field, FieldGroup } from '$lib/types';
  import { store } from '$lib/store.svelte';

  let { field, entityId, group }: { field: Field; entityId: string; group: FieldGroup } = $props();

  type Rule = { field: string; operator: string; value: string; _resolved?: boolean };
  type ConditionalLogic = Rule[][] | 0;

  const cl = $derived(field.config?.conditional_logic as ConditionalLogic ?? 0);
  const enabled = $derived(cl !== 0 && Array.isArray(cl));

  // Available fields: same group, excluding self, top-level only
  const availableFields = $derived(
    group.fields.filter(f => f.id !== field.id && f.type.kind !== 'repeat')
  );

  function getOperators(targetField: Field | undefined): { value: string; label: string }[] {
    const base = [
      { value: '==', label: '等于' },
      { value: '!=', label: '不等于' },
      { value: '==empty', label: '为空' },
      { value: '!=empty', label: '不为空' },
    ];
    if (targetField?.type.kind === 'atom' && targetField.type.subtype === 'text') {
      base.push({ value: '==contains', label: '包含' });
    }
    return base;
  }

  function toggleEnabled() {
    const newCl = enabled ? 0 : [[]];
    updateCl(newCl);
  }

  function updateCl(newCl: ConditionalLogic) {
    const config = { ...field.config ?? {}, conditional_logic: newCl };
    store.updateFieldConfig(entityId, field.id, config);
  }

  function addOrGroup() {
    if (!Array.isArray(cl)) return;
    const next = [...cl, [{ field: '', operator: '==', value: '' }]];
    updateCl(next);
  }

  function addAndRule(orIndex: number) {
    if (!Array.isArray(cl)) return;
    const next = cl.map((og, i) => i === orIndex ? [...og, { field: '', operator: '==', value: '' }] : og);
    updateCl(next);
  }

  function removeRule(orIndex: number, andIndex: number) {
    if (!Array.isArray(cl)) return;
    const next = cl.map((og, i) => {
      if (i !== orIndex) return og;
      return og.filter((_, j) => j !== andIndex);
    }).filter(og => og.length > 0);
    updateCl(next.length > 0 ? next : 0);
  }

  function updateRule(orIndex: number, andIndex: number, key: keyof Rule, value: string) {
    if (!Array.isArray(cl)) return;
    const next = cl.map((og, i) => {
      if (i !== orIndex) return og;
      return og.map((rule, j) => {
        if (j !== andIndex) return rule;
        return { ...rule, [key]: value };
      });
    });
    updateCl(next);
  }

  function isReadOnly(rule: Rule): boolean {
    return rule._resolved === false;
  }

  function getFieldLabel(fieldId: string): string {
    const f = availableFields.find(af => af.id === fieldId);
    return f?.name ?? fieldId;
  }
</script>

<div class="cl-editor">
  <label class="cl-toggle">
    <input type="checkbox" checked={enabled} onchange={toggleEnabled} />
    <span>条件逻辑</span>
  </label>

  {#if enabled && Array.isArray(cl)}
    <div class="cl-groups">
      {#each cl as orGroup, oi}
        {#if oi > 0}
          <div class="cl-or-label">或</div>
        {/if}
        <div class="cl-and-group">
          {#each orGroup as rule, ai}
            {#if isReadOnly(rule)}
              <div class="cl-rule cl-rule-readonly">
                <span class="cl-readonly-warn" title="引用了不支持编辑的字段">⚠</span>
                <span class="cl-readonly-text">{rule.field} {rule.operator} {rule.value}</span>
                <button class="cl-remove" onclick={() => removeRule(oi, ai)}>&times;</button>
              </div>
            {:else}
              <div class="cl-rule">
                <select class="cl-select" value={rule.field}
                  onchange={(e) => updateRule(oi, ai, 'field', (e.target as HTMLSelectElement).value)}>
                  <option value="">-- 选择字段 --</option>
                  {#each availableFields as af}
                    <option value={af.id}>{af.name}</option>
                  {/each}
                </select>
                <select class="cl-select cl-select-sm" value={rule.operator}
                  onchange={(e) => updateRule(oi, ai, 'operator', (e.target as HTMLSelectElement).value)}>
                  {#each getOperators(availableFields.find(af => af.id === rule.field)) as op}
                    <option value={op.value}>{op.label}</option>
                  {/each}
                </select>
                {#if rule.operator !== '==empty' && rule.operator !== '!=empty'}
                  {@const targetField = availableFields.find(af => af.id === rule.field)}
                  {#if targetField?.type.kind === 'atom' && targetField.type.subtype === 'true_false'}
                    <select class="cl-select cl-select-sm" value={rule.value}
                      onchange={(e) => updateRule(oi, ai, 'value', (e.target as HTMLSelectElement).value)}>
                      <option value="1">是</option>
                      <option value="0">否</option>
                    </select>
                  {:else if targetField?.type.kind === 'atom' && targetField.config?.choices}
                    <select class="cl-select" value={rule.value}
                      onchange={(e) => updateRule(oi, ai, 'value', (e.target as HTMLSelectElement).value)}>
                      <option value="">--</option>
                      {#each (targetField.config.choices as string[]) as choice}
                        <option value={choice}>{choice}</option>
                      {/each}
                    </select>
                  {:else}
                    <input type="text" class="cl-input" value={rule.value}
                      oninput={(e) => updateRule(oi, ai, 'value', (e.target as HTMLInputElement).value)} />
                  {/if}
                {/if}
                <button class="cl-remove" onclick={() => removeRule(oi, ai)}>&times;</button>
              </div>
            {/if}
            {#if ai < orGroup.length - 1}
              <div class="cl-and-label">且</div>
            {/if}
          {/each}
          <button class="cl-add" onclick={() => addAndRule(oi)}>+ 且</button>
        </div>
      {/each}
      <button class="cl-add cl-add-or" onclick={addOrGroup}>+ 或</button>
    </div>
  {/if}
</div>

<style lang="scss">
  .cl-editor {
    padding-top: $spacing-xs;
    border-top: 1px dashed $color-border-light;
  }

  .cl-toggle {
    display: flex;
    align-items: center;
    gap: $spacing-xs;
    font-size: $font-size-xs;
    font-weight: 500;
    cursor: pointer;
    margin-bottom: $spacing-xs;
    input { accent-color: $color-primary; }
  }

  .cl-groups {
    padding-left: $spacing-sm;
  }

  .cl-and-group {
    border-left: 2px solid $color-primary-lighter;
    padding-left: $spacing-sm;
    margin-bottom: $spacing-xs;
  }

  .cl-rule {
    display: flex;
    align-items: center;
    gap: $spacing-xs;
    margin-bottom: $spacing-xs;
    flex-wrap: wrap;
  }

  .cl-rule-readonly {
    opacity: 0.6;
    background: $color-bg-light;
    padding: $spacing-xs;
    border-radius: $border-radius;
  }

  .cl-readonly-warn {
    font-size: $font-size-xs;
  }

  .cl-readonly-text {
    font-size: $font-size-xs;
    font-family: monospace;
    flex: 1;
  }

  .cl-select {
    padding: 2px $spacing-xs;
    border: 1px solid $color-border-light;
    border-radius: $border-radius;
    font-size: $font-size-xs;
    outline: none;
    background: $color-surface;
    max-width: 120px;
    &:focus { border-color: $color-primary; }
  }

  .cl-select-sm { max-width: 80px; }

  .cl-input {
    padding: 2px $spacing-xs;
    border: 1px solid $color-border-light;
    border-radius: $border-radius;
    font-size: $font-size-xs;
    outline: none;
    flex: 1;
    min-width: 50px;
    &:focus { border-color: $color-primary; }
  }

  .cl-remove {
    color: $color-danger;
    font-size: $font-size-sm;
    opacity: 0.4;
    padding: 0 2px;
    background: none;
    border: none;
    cursor: pointer;
    &:hover { opacity: 1; }
  }

  .cl-and-label, .cl-or-label {
    font-size: $font-size-xs;
    color: $color-text-muted;
    font-weight: 600;
    padding: 0 $spacing-xs;
    margin-bottom: $spacing-xs;
  }

  .cl-or-label {
    text-align: center;
    padding: $spacing-xs 0;
  }

  .cl-add {
    font-size: $font-size-xs;
    color: $color-primary;
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 0;
    &:hover { text-decoration: underline; }
  }

  .cl-add-or {
    margin-top: $spacing-xs;
  }
</style>
