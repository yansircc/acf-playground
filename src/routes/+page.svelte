<script lang="ts">
  import { onMount } from 'svelte';
  import TopBar from '$lib/components/TopBar.svelte';
  import Canvas from '$lib/components/Canvas.svelte';
  import FieldToolbox from '$lib/components/FieldToolbox.svelte';
  import FormPanel from '$lib/components/FormPanel.svelte';
  import { store } from '$lib/store.svelte';
  import { startBroadcasting } from '$lib/store-sync';
  import { fetchPendingState } from '$lib/store-import';

  onMount(() => {
    // 先检查是否有通过 API 注入的 pending state
    fetchPendingState().then((state) => {
      if (state) store.hydrate(state);
    });

    const broadcast = startBroadcasting(store);
    // 用 $effect 监听 store 变化并广播
    const stop = $effect.root(() => {
      $effect(() => {
        store.serialize(); // 触发依赖追踪
        broadcast();
      });
    });
    return stop;
  });
</script>

<div class="app-layout">
  <TopBar />
  <FieldToolbox />
  <div class="main-content">
    <Canvas />
    <FormPanel />
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
</style>
