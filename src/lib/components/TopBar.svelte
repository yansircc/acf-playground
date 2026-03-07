<script lang="ts">
  import { store } from '$lib/store.svelte';
  import { exportToACF, downloadJSON } from '$lib/acf-export';

  function handleExport() {
    const acfData = exportToACF(store.entities);
    downloadJSON(acfData, 'acf-export.json');
  }

  function handleReset() {
    if (store.entities.length === 0 || confirm('Reset all entities and data?')) {
      store.reset();
    }
  }

  function handleNewEntity() {
    const name = prompt('Entity name:', 'New Entity');
    if (name) {
      store.addEntity(name);
    }
  }
</script>

<header class="topbar">
  <div class="brand">
    <strong>ACF Playground</strong>
  </div>

  <nav class="actions">
    <button class="btn btn-primary" onclick={handleNewEntity}>
      + New Entity
    </button>
    <button
      class="btn btn-outline"
      onclick={handleExport}
      disabled={store.entities.length === 0}
    >
      Export JSON
    </button>
    <button class="btn btn-ghost" onclick={handleReset}>
      Reset
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
