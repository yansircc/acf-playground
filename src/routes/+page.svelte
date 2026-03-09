<script lang="ts">
  import { onMount } from 'svelte';
  import TopBar from '$lib/components/TopBar.svelte';
  import Canvas from '$lib/components/Canvas.svelte';
  import FieldToolbox from '$lib/components/FieldToolbox.svelte';
  import FormPanel from '$lib/components/FormPanel.svelte';
  import { store } from '$lib/store.svelte';
  import { startBroadcasting } from '$lib/store-sync';
  import { fetchPendingState } from '$lib/store-import';

  let panelWidth = $state(340);
  let isDragging = $state(false);
  let startX = 0;
  let startWidth = 0;

  function onResizeStart(e: MouseEvent) {
    isDragging = true;
    startX = e.clientX;
    startWidth = panelWidth;
    e.preventDefault();
  }

  function onResizeMove(e: MouseEvent) {
    if (!isDragging) return;
    const delta = startX - e.clientX; // 左移 = 增大面板宽
    panelWidth = Math.min(600, Math.max(280, startWidth + delta));
  }

  function onResizeEnd() {
    isDragging = false;
  }

  onMount(() => {
    // 先从 localStorage 恢复状态（防止页面刷新后丢失）
    try {
      const saved = localStorage.getItem('acf-store-state');
      if (saved && store.entities.length === 0) {
        store.hydrate(JSON.parse(saved));
      }
    } catch { /* parse 失败就忽略 */ }

    // 再检查是否有通过 API 注入的 pending state（优先级更高）
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

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="app-layout"
  class:resizing={isDragging}
  onmousemove={onResizeMove}
  onmouseup={onResizeEnd}
  onmouseleave={onResizeEnd}
>
  <TopBar />
  <FieldToolbox />
  <div class="main-content">
    <Canvas />
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="resize-handle" onmousedown={onResizeStart}></div>
    <FormPanel width={panelWidth} />
  </div>
</div>

<style lang="scss">
  .app-layout {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;

    &.resizing {
      cursor: col-resize;
      user-select: none;
    }
  }

  .main-content {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .resize-handle {
    width: 5px;
    cursor: col-resize;
    background: transparent;
    flex-shrink: 0;
    position: relative;
    z-index: 10;

    &:hover,
    &:active {
      background: $color-primary;
      opacity: 0.3;
    }
  }
</style>
