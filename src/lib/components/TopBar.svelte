<script lang="ts">
  import { store } from '$lib/store.svelte';
  import { exportToACF, downloadJSON } from '$lib/acf-export';
  import { readStoreFile } from '$lib/store-import';

  let fileInput: HTMLInputElement;

  function handleExport() {
    const acfData = exportToACF(store.entities);
    downloadJSON(acfData, 'acf-export.json');
  }

  function handleReset() {
    if (store.entities.length === 0 || confirm('确定要重置所有实体和数据吗？')) {
      store.reset();
    }
  }

  function handleNewEntity() {
    store.addEntity('新实体');
  }

  function handlePreview() {
    window.open('/preview', '_blank');
  }

  function handleExportStore() {
    const state = store.serialize();
    downloadJSON(state, 'acf-store.json');
  }

  async function handleLoadDemo() {
    if (store.entities.length > 0 && !confirm('加载示例会覆盖当前数据，确定吗？')) return;
    try {
      const res = await fetch('/fixtures/school-demo.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const state = await res.json();
      store.hydrate(state);
    } catch (err) {
      alert('加载示例失败：' + String(err));
    }
  }

  async function handleImport() {
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
    input.value = ''; // 清空以允许重复选择同一文件
  }
</script>

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
    <button class="btn btn-primary" onclick={handleNewEntity}>
      + 新建实体
    </button>
    <button class="btn btn-outline" onclick={handlePreview}>
      预览
    </button>
    <button
      class="btn btn-outline"
      onclick={handleExport}
      disabled={store.entities.length === 0}
    >
      导出 JSON
    </button>
    <button class="btn btn-outline" onclick={handleImport}>
      导入
    </button>
    <button class="btn btn-outline" onclick={handleLoadDemo}>
      示例场景
    </button>
    <button
      class="btn btn-outline"
      onclick={handleExportStore}
      disabled={store.entities.length === 0}
    >
      导出 Store
    </button>
    <button class="btn btn-ghost" onclick={handleReset}>
      重置
    </button>
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
    gap: $spacing-sm;
  }

  .btn {
    padding: $spacing-sm $spacing-lg;
    border-radius: $border-radius;
    font-size: $font-size-sm;
    font-weight: 600;
    transition: all 0.15s;
    cursor: pointer;
  }

  .btn-primary {
    background: $color-primary;
    color: white;

    &:hover {
      background: $color-primary-hover;
    }
  }

  .btn-outline {
    border: 1px solid rgba(255, 255, 255, 0.4);
    color: white;
    background: transparent;

    &:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }

  .btn-ghost {
    color: rgba(255, 255, 255, 0.7);
    background: transparent;

    &:hover {
      color: white;
      background: rgba(255, 255, 255, 0.1);
    }
  }
</style>
