<script lang="ts">
  import '$lib/styles/global.scss';
  import favicon from '$lib/assets/favicon.svg';

  let { children } = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <title>ACF Playground</title>
</svelte:head>

{@render children()}
