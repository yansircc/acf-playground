<script lang="ts">
  import type { Field } from '$lib/types';
  import AtomValueInput from './AtomValueInput.svelte';

  let {
    field,
    value = '',
    onchange,
    rowIndex = 0,
  }: {
    field: Field;
    value: unknown;
    onchange: (v: unknown) => void;
    rowIndex?: number;
  } = $props();

  // 只有 kind === 'atom' 时才会渲染这个组件
  const subtype = $derived(field.type.kind === 'atom' ? field.type.subtype : 'text');

  /** 需要增强 UI 的子类型 — 其余全部委托给 AtomValueInput */
  const ENHANCED_SUBTYPES = new Set([
    'select', 'radio', 'checkbox', 'wysiwyg', 'image', 'file', 'oembed', 'true_false',
  ]);

  const isEnhanced = $derived(ENHANCED_SUBTYPES.has(subtype));
  const choices = $derived(field.config?.choices as string[] ?? []);

  // oEmbed URL → embed URL 转换
  function toEmbedUrl(url: string): string | null {
    if (!url) return null;
    try {
      let m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
      if (m) return `https://www.youtube.com/embed/${m[1]}`;
      m = url.match(/vimeo\.com\/(\d+)/);
      if (m) return `https://player.vimeo.com/video/${m[1]}`;
    } catch { /* ignore malformed URLs */ }
    return null;
  }

  // WYSIWYG 工具栏命令
  function execWysiwyg(command: string, val?: string) {
    document.execCommand(command, false, val);
  }

  function handleWysiwygLink() {
    const url = prompt('输入链接 URL：', 'https://');
    if (url) document.execCommand('createLink', false, url);
  }

  // 图片/文件上传
  function handleFileUpload(accept: string) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => onchange(reader.result as string);
      reader.readAsDataURL(file);
    };
    input.click();
  }

  // 选项管理
  function addChoice() {
    const choices = field.config?.choices as string[] ?? [];
    if (!field.config) field.config = {};
    field.config.choices = [...choices, `选项 ${choices.length + 1}`];
  }

  function removeChoice(index: number) {
    const choices = field.config?.choices as string[] | undefined;
    if (!choices) return;
    field.config!.choices = choices.filter((_, i) => i !== index);
  }

  function updateChoice(index: number, val: string) {
    const choices = field.config?.choices as string[] | undefined;
    if (!choices) return;
    choices[index] = val;
  }
</script>

{#snippet choicesEditor()}
  {#if field.config?.choices}
    <div class="choices-editor">
      {#each choices as choice, ci}
        <div class="choices-row">
          <input type="text" class="choices-input" value={choice}
            oninput={(e) => updateChoice(ci, (e.target as HTMLInputElement).value)} />
          <button class="choices-remove" onclick={() => removeChoice(ci)}>&times;</button>
        </div>
      {/each}
      <button class="choices-add" onclick={addChoice}>+ 添加选项</button>
    </div>
  {/if}
{/snippet}

{#if !isEnhanced}
  <!-- 简单类型：委托给 AtomValueInput -->
  <AtomValueInput {field} {value} {onchange} {rowIndex} />
{:else if subtype === 'oembed'}
  <input type="url" class="wp-input"
    value={value as string}
    oninput={(e) => onchange((e.target as HTMLInputElement).value)}
    placeholder="YouTube / Vimeo URL..." />
  {#if toEmbedUrl(value as string)}
    <div class="oembed-preview">
      <iframe
        src={toEmbedUrl(value as string)}
        title="oEmbed 预览"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
      ></iframe>
    </div>
  {/if}
{:else if subtype === 'wysiwyg'}
  <div class="wysiwyg-wrapper">
    <div class="wysiwyg-toolbar">
      <button type="button" title="粗体" onmousedown={(e) => { e.preventDefault(); execWysiwyg('bold'); }}><b>B</b></button>
      <button type="button" title="斜体" onmousedown={(e) => { e.preventDefault(); execWysiwyg('italic'); }}><i>I</i></button>
      <button type="button" title="链接" onmousedown={(e) => { e.preventDefault(); handleWysiwygLink(); }}>🔗</button>
      <button type="button" title="无序列表" onmousedown={(e) => { e.preventDefault(); execWysiwyg('insertUnorderedList'); }}>•</button>
      <button type="button" title="有序列表" onmousedown={(e) => { e.preventDefault(); execWysiwyg('insertOrderedList'); }}>1.</button>
    </div>
    <div
      class="wysiwyg-editor"
      contenteditable="true"
      role="textbox"
      aria-multiline="true"
      oninput={(e) => onchange((e.target as HTMLElement).innerHTML)}
    >{@html (value as string) || ''}</div>
  </div>
{:else if subtype === 'image' || subtype === 'file'}
  <div class="file-input-row">
    <input type="url" class="wp-input"
      value={value as string}
      oninput={(e) => onchange((e.target as HTMLInputElement).value)}
      placeholder={subtype === 'image' ? '图片 URL...' : '文件 URL...'} />
    <button
      type="button"
      class="upload-btn"
      title="上传文件"
      onclick={() => handleFileUpload(subtype === 'image' ? 'image/*' : '*/*')}
    >📎</button>
  </div>
  {#if subtype === 'image' && value}
    <img class="image-preview"
      src={value as string} alt="预览"
      onerror={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
  {:else if subtype === 'file' && value}
    <div class="file-name-preview">
      {#if (value as string).startsWith('data:')}
        已上传文件
      {:else}
        {value}
      {/if}
    </div>
  {/if}
{:else if subtype === 'select'}
  <select class="wp-input"
    value={value as string}
    onchange={(e) => onchange((e.target as HTMLSelectElement).value)}>
    <option value="">— 选择 —</option>
    {#each choices as choice}
      <option value={choice}>{choice}</option>
    {/each}
  </select>
  {@render choicesEditor()}
{:else if subtype === 'radio'}
  <div class="choice-group">
    {#each choices as choice, ci}
      <div class="choice-row">
        <label class="choice-item">
          <input type="radio" name="{field.id}-{rowIndex}"
            value={choice}
            checked={value === choice}
            onchange={() => onchange(choice)} />
        </label>
        <input type="text" class="choices-input" value={choice}
          oninput={(e) => updateChoice(ci, (e.target as HTMLInputElement).value)} />
        <button class="choices-remove" onclick={() => removeChoice(ci)}>&times;</button>
      </div>
    {/each}
    <button class="choices-add" onclick={addChoice}>+ 添加选项</button>
  </div>
{:else if subtype === 'checkbox'}
  <div class="choice-group">
    {#each choices as choice, ci}
      {@const currentVal = Array.isArray(value) ? value as string[] : []}
      <div class="choice-row">
        <label class="choice-item">
          <input type="checkbox"
            value={choice}
            checked={currentVal.includes(choice)}
            onchange={(e) => {
              const checked = (e.target as HTMLInputElement).checked;
              const arr = [...currentVal];
              if (checked) arr.push(choice); else arr.splice(arr.indexOf(choice), 1);
              onchange(arr);
            }} />
        </label>
        <input type="text" class="choices-input" value={choice}
          oninput={(e) => updateChoice(ci, (e.target as HTMLInputElement).value)} />
        <button class="choices-remove" onclick={() => removeChoice(ci)}>&times;</button>
      </div>
    {/each}
    <button class="choices-add" onclick={addChoice}>+ 添加选项</button>
  </div>
{:else if subtype === 'true_false'}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="toggle-label"
    onclick={() => onchange(!value)}
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onchange(!value); } }}
    role="switch"
    aria-checked={!!value}
    tabindex="0"
  >
    <span class="toggle-track" class:on={!!value}>
      <span class="toggle-thumb"></span>
    </span>
    <span>{value ? '是' : '否'}</span>
  </div>
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

  .image-preview {
    margin-top: $spacing-sm;
    max-width: 100%;
    max-height: 120px;
    border-radius: $border-radius;
    border: 1px solid $color-border-light;
    object-fit: cover;
  }

  .choice-group {
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
  }

  .choice-item {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    cursor: pointer;

    input { accent-color: $color-primary; }
  }

  .choice-row {
    display: flex;
    align-items: center;
    gap: $spacing-xs;
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    font-size: $font-size-sm;
    cursor: pointer;
    user-select: none;
  }

  .toggle-track {
    position: relative;
    width: 40px;
    height: 22px;
    background: $color-border;
    border-radius: 11px;
    transition: background 0.2s;
    flex-shrink: 0;

    &.on {
      background: $color-primary;
    }
  }

  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    background: white;
    border-radius: 50%;
    transition: transform 0.2s;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);

    .on > & {
      transform: translateX(18px);
    }
  }

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

  .color-wrapper {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
  }

  // === oEmbed Preview ===

  .oembed-preview {
    margin-top: $spacing-sm;
    position: relative;
    width: 100%;
    padding-bottom: 56.25%; // 16:9
    border-radius: $border-radius;
    overflow: hidden;
    border: 1px solid $color-border-light;
    background: #000;

    iframe {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border: none;
    }
  }

  // === WYSIWYG Editor ===

  .wysiwyg-wrapper {
    border: 1px solid $color-border;
    border-radius: $border-radius;
    overflow: hidden;

    &:focus-within {
      border-color: $color-primary;
      box-shadow: 0 0 0 1px $color-primary;
    }
  }

  .wysiwyg-toolbar {
    display: flex;
    gap: 1px;
    padding: 2px;
    background: $color-bg-light;
    border-bottom: 1px solid $color-border-light;

    button {
      padding: 4px 8px;
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: $font-size-sm;
      color: $color-text-secondary;
      border-radius: 2px;
      line-height: 1;

      &:hover {
        background: $color-border-light;
        color: $color-text;
      }
    }
  }

  .wysiwyg-editor {
    min-height: 100px;
    padding: $spacing-sm $spacing-md;
    font-size: $font-size-base;
    color: $color-text;
    outline: none;
    line-height: 1.5;

    &:empty::before {
      content: '输入富文本内容...';
      color: $color-text-muted;
    }

    :global(a) {
      color: $color-primary;
      text-decoration: underline;
    }
  }

  // === File Upload ===

  .file-input-row {
    display: flex;
    gap: $spacing-xs;
    align-items: center;

    .wp-input {
      flex: 1;
    }
  }

  .upload-btn {
    padding: $spacing-sm;
    border: 1px solid $color-border;
    border-radius: $border-radius;
    background: $color-surface;
    cursor: pointer;
    font-size: $font-size-base;
    line-height: 1;
    flex-shrink: 0;

    &:hover {
      background: $color-bg-light;
      border-color: $color-primary;
    }
  }

  .file-name-preview {
    margin-top: $spacing-xs;
    font-size: $font-size-xs;
    color: $color-text-secondary;
    padding: $spacing-xs $spacing-sm;
    background: $color-bg-light;
    border-radius: $border-radius;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
