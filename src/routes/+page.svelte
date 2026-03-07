<script lang="ts">
  import TopBar from '$lib/components/TopBar.svelte';
  import Canvas from '$lib/components/Canvas.svelte';
  import FieldToolbox from '$lib/components/FieldToolbox.svelte';
  import FormPanel from '$lib/components/FormPanel.svelte';
  import PreviewPanel from '$lib/components/PreviewPanel.svelte';
</script>

<div class="app-layout">
  <TopBar />
  <div class="main-content">
    <div class="left-panel">
      <FieldToolbox />
      <Canvas />
    </div>
    <div class="right-panels">
      <FormPanel />
      <PreviewPanel />
    </div>
  </div>
</div>

<style lang="scss">
  .app-layout {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  .main-content {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .left-panel {
    display: flex;
    flex: 1;
    min-width: 0;
  }

  .right-panels {
    display: flex;
    flex-shrink: 0;
    border-left: 1px solid $color-border;
  }
</style>
