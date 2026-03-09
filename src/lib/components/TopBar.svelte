<script lang="ts">
  import { store } from '$lib/store.svelte';
  import { exportToACF, downloadJSON } from '$lib/acf-export';
  import { readStoreFile } from '$lib/store-import';

  let fileInput: HTMLInputElement;
  let menuOpen = $state(false);

  function showToast(message: string) {
    const el = document.createElement('div');
    el.textContent = message;
    Object.assign(el.style, {
      position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
      background: '#323232', color: '#fff', padding: '10px 24px', borderRadius: '6px',
      fontSize: '14px', fontWeight: '500', zIndex: '9999', opacity: '0',
      transition: 'opacity 0.3s',
    });
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = '1'; });
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    }, 2500);
  }

  function handleExport() {
    const acfData = exportToACF(store.entities);
    downloadJSON(acfData, 'acf-export.json');
    showToast('已导出 ACF JSON');
    menuOpen = false;
  }

  function handleReset() {
    menuOpen = false;
    if (store.entities.length === 0 || confirm('确定要重置所有实体和数据吗？')) {
      store.reset();
    }
  }

  function handlePreview() {
    window.open('/preview', '_blank');
  }

  function handleImport() {
    menuOpen = false;
    fileInput.click();
  }

  async function handleFileSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const state = await readStoreFile(file);
      store.hydrate(state);
    } catch (err) {
      alert('导入失败：' + String(err));
    }
    input.value = '';
  }

  function toggleMenu() {
    menuOpen = !menuOpen;
  }

  function handleWindowClick(e: MouseEvent) {
    if (menuOpen) {
      const target = e.target as HTMLElement;
      if (!target.closest('.menu-wrapper')) {
        menuOpen = false;
      }
    }
  }
</script>

<svelte:window onclick={handleWindowClick} />

<input
  type="file"
  accept=".json"
  style="display:none"
  bind:this={fileInput}
  onchange={handleFileSelected}
/>

<header class="topbar">
  <div class="brand">
    <strong>ACF Playground</strong>
  </div>

  <nav class="actions">
    <button class="btn-preview" onclick={handlePreview}>
      预览
    </button>
    <div class="menu-wrapper">
      <button class="btn-menu" onclick={toggleMenu} aria-label="更多操作">⋮</button>
      {#if menuOpen}
        <div class="dropdown">
          <button class="dropdown-item" onclick={handleImport}>导入</button>
          <button class="dropdown-item" onclick={handleExport} disabled={store.entities.length === 0}>导出 JSON</button>
          <hr class="dropdown-divider" />
          <button class="dropdown-item danger" onclick={handleReset}>重置</button>
        </div>
      {/if}
    </div>
  </nav>
</header>

<style lang="scss">
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: $topbar-height;
    padding: 0 $spacing-lg;
    background: $color-node-header;
    color: white;
    flex-shrink: 0;
    z-index: 10;
  }

  .brand {
    font-size: $font-size-lg;
    letter-spacing: -0.02em;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
  }

  .btn-preview {
    padding: $spacing-xs $spacing-md;
    border: 1px solid rgba(255, 255, 255, 0.4);
    border-radius: $border-radius;
    color: white;
    background: transparent;
    font-size: $font-size-sm;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;

    &:hover {
      background: rgba(255, 255, 255, 0.1);
    }
  }

  .menu-wrapper {
    position: relative;
  }

  .btn-menu {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: $border-radius;
    color: rgba(255, 255, 255, 0.7);
    background: transparent;
    font-size: $font-size-lg;
    cursor: pointer;
    transition: all 0.15s;

    &:hover {
      color: white;
      background: rgba(255, 255, 255, 0.1);
    }
  }

  .dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: $spacing-xs;
    min-width: 140px;
    background: $color-surface;
    border: 1px solid $color-border;
    border-radius: $border-radius;
    box-shadow: $shadow-md;
    overflow: hidden;
    z-index: 100;
  }

  .dropdown-item {
    display: block;
    width: 100%;
    padding: $spacing-sm $spacing-md;
    border: none;
    background: transparent;
    color: $color-text;
    font-size: $font-size-sm;
    text-align: left;
    cursor: pointer;
    transition: background 0.1s;

    &:hover {
      background: $color-bg;
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    &.danger {
      color: $color-danger;
    }
  }

  .dropdown-divider {
    margin: 0;
    border: none;
    border-top: 1px solid $color-border-light;
  }
</style>
