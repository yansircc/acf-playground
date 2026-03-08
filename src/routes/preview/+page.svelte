<script lang="ts">
  import { onMount } from 'svelte';
  import PreviewPanel from '$lib/components/PreviewPanel.svelte';
  import { store } from '$lib/store.svelte';
  import { startListening } from '$lib/store-sync';

  onMount(() => {
    return startListening(store);
  });
</script>

<div class="preview-page">
  <PreviewPanel />
</div>

<style lang="scss">
  .preview-page {
    height: 100vh;
    display: flex;
    background: $color-bg;
  }
</style>
