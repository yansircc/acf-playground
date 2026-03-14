<script lang="ts">
  import type { Field } from '$lib/types';

  let {
    field,
    value = '',
    onchange,
    rowIndex = 0,
    variant = 'default',
  }: {
    field: Field;
    value: unknown;
    onchange: (v: unknown) => void;
    rowIndex?: number;
    variant?: 'default' | 'table' | 'compact';
  } = $props();

  const subtype = $derived(field.type.kind === 'atom' ? field.type.subtype : 'text');
  const choices = $derived(
    field.type.kind === 'atom' && 'choices' in field.type ? (field.type.choices ?? []) : []
  );
</script>

<div class="atom-value-input" class:variant-table={variant === 'table'} class:variant-compact={variant === 'compact'}>
{#if subtype === 'text' || subtype === 'password'}
  <input type={subtype} class="vi"
    value={value as string}
    oninput={(e) => onchange((e.target as HTMLInputElement).value)}
    placeholder={subtype === 'password' ? '••••••' : '输入文本...'} />
{:else if subtype === 'number'}
  <input type="number" class="vi"
    value={value as string}
    oninput={(e) => onchange((e.target as HTMLInputElement).value)}
    placeholder="0" />
{:else if subtype === 'range'}
  <div class="range-wrapper">
    <input type="range" class="vi-range" min="0" max="100"
      value={value as string || '50'}
      oninput={(e) => onchange((e.target as HTMLInputElement).value)} />
    <span class="range-value">{value || '50'}</span>
  </div>
{:else if subtype === 'email'}
  <input type="email" class="vi"
    value={value as string}
    oninput={(e) => onchange((e.target as HTMLInputElement).value)}
    placeholder="user@example.com" />
{:else if subtype === 'url' || subtype === 'page_link' || subtype === 'oembed' || subtype === 'image' || subtype === 'file'}
  <input type="url" class="vi"
    value={value as string}
    oninput={(e) => onchange((e.target as HTMLInputElement).value)}
    placeholder={
      subtype === 'page_link' ? '页面 URL...' :
      subtype === 'oembed' ? 'YouTube / Vimeo URL...' :
      subtype === 'image' ? '图片 URL...' :
      subtype === 'file' ? '文件 URL...' :
      'https://...'
    } />
{:else if subtype === 'textarea' || subtype === 'gallery' || subtype === 'wysiwyg'}
  <textarea class="vi vi-textarea"
    value={value as string}
    oninput={(e) => onchange((e.target as HTMLTextAreaElement).value)}
    placeholder={
      subtype === 'gallery' ? '图片 URL（每行一个）...' :
      subtype === 'wysiwyg' ? '输入富文本内容...' :
      '输入文本...'
    }
    rows={variant === 'table' ? 1 : 3}></textarea>
{:else if subtype === 'select' || subtype === 'radio'}
  <select class="vi"
    value={value as string}
    onchange={(e) => onchange((e.target as HTMLSelectElement).value)}>
    <option value="">— 选择 —</option>
    {#each choices as choice}
      <option value={choice}>{choice}</option>
    {/each}
  </select>
{:else if subtype === 'checkbox'}
  {@const arr = Array.isArray(value) ? value as string[] : []}
  <div class="checkbox-group">
    {#each choices as choice}
      <label class="checkbox-item">
        <input type="checkbox"
          value={choice}
          checked={arr.includes(choice)}
          onchange={(e) => {
            const checked = (e.target as HTMLInputElement).checked;
            const next = [...arr];
            if (checked) next.push(choice); else next.splice(next.indexOf(choice), 1);
            onchange(next);
          }} />
        <span>{choice}</span>
      </label>
    {/each}
  </div>
{:else if subtype === 'true_false'}
  <label class="tf-label">
    <input type="checkbox"
      checked={!!value}
      onchange={() => onchange(!value)} />
    <span>{value ? '是' : '否'}</span>
  </label>
{:else if subtype === 'date_picker'}
  <input type="date" class="vi"
    value={value as string}
    oninput={(e) => onchange((e.target as HTMLInputElement).value)} />
{:else if subtype === 'date_time_picker'}
  <input type="datetime-local" class="vi"
    value={value as string}
    oninput={(e) => onchange((e.target as HTMLInputElement).value)} />
{:else if subtype === 'time_picker'}
  <input type="time" class="vi"
    value={value as string}
    oninput={(e) => onchange((e.target as HTMLInputElement).value)} />
{:else if subtype === 'color_picker'}
  <div class="color-wrapper">
    <input type="color" class="vi-color"
      value={value as string || '#000000'}
      oninput={(e) => onchange((e.target as HTMLInputElement).value)} />
    <input type="text" class="vi color-hex"
      value={value as string || '#000000'}
      oninput={(e) => onchange((e.target as HTMLInputElement).value)}
      placeholder="#000000" />
  </div>
{:else if subtype === 'google_map'}
  <input type="text" class="vi"
    value={value as string}
    oninput={(e) => onchange((e.target as HTMLInputElement).value)}
    placeholder="地址..." />
{:else if subtype === 'user'}
  <input type="text" class="vi"
    value={value as string}
    oninput={(e) => onchange((e.target as HTMLInputElement).value)}
    placeholder="用户名..." />
{/if}
</div>

<style lang="scss">
  .atom-value-input {
    width: 100%;
  }

  // === default variant ===
  .vi {
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

  .vi-textarea {
    resize: vertical;
    min-height: 60px;
  }

  .range-wrapper {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
  }

  .vi-range {
    flex: 1;
    accent-color: $color-primary;
  }

  .range-value {
    font-size: $font-size-sm;
    color: $color-text-secondary;
    min-width: 32px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .color-wrapper {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
  }

  .vi-color {
    width: 40px;
    height: 34px;
    border: 1px solid $color-border;
    border-radius: $border-radius;
    padding: 2px;
    cursor: pointer;
  }

  .color-hex {
    flex: 1;
  }

  .checkbox-group {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-xs $spacing-md;
  }

  .checkbox-item {
    display: flex;
    align-items: center;
    gap: $spacing-xs;
    font-size: $font-size-sm;
    cursor: pointer;

    input { accent-color: $color-primary; }
  }

  .tf-label {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    font-size: $font-size-sm;
    cursor: pointer;

    input { accent-color: $color-primary; }
  }

  // === table variant — borderless, transparent, compact ===
  .variant-table {
    .vi {
      border: none;
      background: transparent;
      padding: $spacing-xs $spacing-sm;
      font-size: $font-size-sm;
      border-radius: 0;
      box-shadow: none;

      &:focus {
        background: $color-primary-light;
        box-shadow: none;
      }
    }

    .vi-textarea {
      min-height: unset;
      resize: none;
    }

    .vi-range {
      height: 18px;
    }

    .vi-color {
      width: 28px;
      height: 24px;
      border: none;
    }

    .color-hex {
      font-size: $font-size-xs;
    }

    .range-value {
      font-size: $font-size-xs;
    }

    .checkbox-group {
      padding: $spacing-xs $spacing-sm;
      gap: $spacing-xs;
    }

    .checkbox-item {
      font-size: $font-size-xs;
    }

    .tf-label {
      padding: $spacing-xs $spacing-sm;
      font-size: $font-size-xs;
    }
  }

  // === compact variant — bordered, small ===
  .variant-compact {
    .vi {
      padding: $spacing-xs $spacing-sm;
      font-size: $font-size-sm;
    }

    .vi-textarea {
      min-height: 40px;
    }

    .vi-color {
      width: 32px;
      height: 28px;
    }

    .checkbox-group {
      gap: $spacing-xs;
    }

    .checkbox-item {
      font-size: $font-size-xs;
    }

    .tf-label {
      font-size: $font-size-xs;
    }
  }
</style>
