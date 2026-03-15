<script lang="ts">
  import type { Field } from '$lib/types';

  let { field }: { field: Field } = $props();

  function addChoice() {
    if (field.type.kind !== 'atom' || !('choices' in field.type)) return;
    const choices = field.type.choices ?? [];
    field.type.choices = [...choices, `选项 ${choices.length + 1}`];
  }

  function removeChoice(index: number) {
    if (field.type.kind !== 'atom' || !field.type.choices) return;
    field.type.choices = field.type.choices.filter((_, i) => i !== index);
  }

  function updateChoice(index: number, val: string) {
    if (field.type.kind !== 'atom' || !field.type.choices) return;
    field.type.choices[index] = val;
  }
</script>

{#if field.type.kind === 'atom' && 'choices' in field.type}
  <div class="choices-editor">
    {#each field.type.choices ?? [] as choice, ci}
      <div class="choices-row">
        <input type="text" class="choices-input" value={choice}
          oninput={(e) => updateChoice(ci, (e.target as HTMLInputElement).value)} />
        <button class="choices-remove" onclick={() => removeChoice(ci)}>&times;</button>
      </div>
    {/each}
    <button class="choices-add" onclick={addChoice}>+ 添加选项</button>
  </div>
{/if}

<style lang="scss">
  .choices-editor {
    margin-top: $spacing-sm;
    padding-top: $spacing-sm;
    border-top: 1px dashed $color-border-light;
  }

  .choices-row {
    display: flex;
    align-items: center;
    gap: $spacing-xs;
    margin-bottom: $spacing-xs;
  }

  .choices-input {
    flex: 1;
    padding: 2px $spacing-sm;
    border: 1px solid $color-border-light;
    border-radius: $border-radius;
    font-size: $font-size-xs;
    color: $color-text-secondary;
    outline: none;

    &:focus {
      border-color: $color-primary;
    }
  }

  .choices-remove {
    color: $color-danger;
    background: none;
    border: none;
    cursor: pointer;
    font-size: $font-size-sm;
    opacity: 0.4;
    padding: 0 2px;

    &:hover { opacity: 1; }
  }

  .choices-add {
    font-size: $font-size-xs;
    color: $color-primary;
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 0;

    &:hover { text-decoration: underline; }
  }
</style>
