<script lang="ts">
  import { store } from '$lib/store.svelte';
  import iframeRuntime from '$lib/preview-runtime.js?raw';
  import {
    projectSchema,
    parseEntityContents,
    buildClientSchema,
    buildClientData,
    escapeAttr,
  } from '$lib/preview-schema';

  let html = $state('');
  let template = $state('');
  let status: 'empty' | 'loading' | 'done' | 'error' = $state('empty');
  let errorMsg = $state('');
  let iframeWarnings: string[] = $state([]);
  let abortController: AbortController | null = null;
  let lastSchemaKey = '';

  // === iframe 通信 ===

  let iframeEl: HTMLIFrameElement = $state(undefined as unknown as HTMLIFrameElement);
  let iframeReady = false;
  let pendingData: Record<string, Record<string, unknown>[]> | null = null;

  function onIframeLoad() {
    iframeReady = true;
    if (pendingData) {
      iframeEl.contentWindow?.postMessage({ type: 'data-update', data: pendingData }, '*');
      pendingData = null;
    }
  }

  function sendDataUpdate() {
    const data = buildClientData(store.entities, store.data);
    if (iframeReady && iframeEl?.contentWindow) {
      iframeEl.contentWindow.postMessage({ type: 'data-update', data }, '*');
    } else {
      pendingData = data;
    }
  }

  // 接收 iframe 错误/警告
  if (typeof window !== 'undefined') {
    window.addEventListener('message', (e) => {
      if (e.data?.type === 'iframe-error') {
        iframeWarnings = [...iframeWarnings, e.data.message];
      } else if (e.data?.type === 'iframe-warnings') {
        iframeWarnings = e.data.warnings;
      }
    });
  }

  // === Schema key（用于 effect 变更检测） ===

  function schemaKey(): string {
    return JSON.stringify(projectSchema(store.entities));
  }

  // === HTML Shell：客户端确定性生成 ===

  function buildShell(entityContents: Record<string, { listing: string; detail: string }>): string {
    const names = store.entities.map((e) => e.name);

    const navItems = names.map((name) => {
      const safe = escapeAttr(name);
      return `<a href="#entity-${safe}" data-nav="entity-${safe}" class="nav-tab">${safe}</a>`;
    }).join('\n      ');

    const pages = names.map((name) => {
      const safe = escapeAttr(name);
      return `<div class="entity-page" id="entity-${safe}" style="display:none">
  <div class="listing-view"></div>
  <div class="detail-view" style="display:none"></div>
</div>`;
    }).join('\n\n    ');

    // Build template maps
    const listingTemplates: Record<string, string> = {};
    const detailTemplates: Record<string, string> = {};
    for (const name of names) {
      listingTemplates[name] = entityContents[name]?.listing ?? '';
      detailTemplates[name] = entityContents[name]?.detail ?? '';
    }

    const esc = (s: string) => s.replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
    const listingJson = esc(JSON.stringify(listingTemplates));
    const detailJson = esc(JSON.stringify(detailTemplates));
    const schemaJson = esc(JSON.stringify(buildClientSchema(store.entities)));
    const dataJson = esc(JSON.stringify(buildClientData(store.entities, store.data)));

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"><\/script>
  <style>
    body { background: #F4EFEA; font-family: Inter, system-ui, sans-serif; }
    .entity-page { max-width: 1000px; margin: 24px auto 0; padding: 0 24px; }
    .nav-tab {
      padding: 0.5rem 1.25rem;
      border: 2px solid transparent;
      border-radius: 2px;
      font-family: ui-monospace, monospace;
      font-size: 0.875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      color: #383838;
      text-decoration: none;
      transition: all 0.15s;
      white-space: nowrap;
    }
    .nav-tab:hover { background: #F1F1F1; }
    .nav-tab.active { background: #383838; color: #F4EFEA; border-color: #383838; }
    .__debug-banner {
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 9999;
      background: #FFF3CD; border-top: 2px solid #FFDE00; color: #383838;
      font-family: ui-monospace, monospace; font-size: 12px;
      padding: 8px 16px; max-height: 30vh; overflow-y: auto;
    }
    .__debug-banner .err { color: #E23F35; }
    .__debug-banner .warn { color: #B8860B; }
  </style>
  <script>
    window.__listingTemplates = ${listingJson};
    window.__detailTemplates = ${detailJson};
    window.__schema = ${schemaJson};
    window.__data = ${dataJson};
    window.__warnings = [];

    ${iframeRuntime}
  <\/script>
</head>
<body>
  <nav class="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b-2 border-[#383838] flex items-center gap-1 px-6 py-3 overflow-x-auto">
      ${navItems}
  </nav>

    ${pages}
</body>
</html>`;
  }

  // === 主 effect：schema 变 → 请求 LLM；数据变 → postMessage ===

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    const entities = store.entities;
    const data = store.data;

    if (entities.length === 0) {
      status = 'empty';
      html = '';
      template = '';
      lastSchemaKey = '';
      return;
    }

    const currentKey = schemaKey();

    if (currentKey !== lastSchemaKey) {
      lastSchemaKey = currentKey;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchTemplate(), 800);
    } else if (template) {
      // schema 没变，数据变了 → postMessage 给 iframe
      sendDataUpdate();
    }
  });

  async function fetchTemplate() {
    if (abortController) abortController.abort();
    abortController = new AbortController();

    status = 'loading';
    errorMsg = '';
    iframeWarnings = [];

    try {
      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectSchema(store.entities)),
        signal: abortController.signal,
      });

      if (!res.ok) {
        status = 'error';
        try {
          const err = await res.json();
          errorMsg = err.error ?? `HTTP ${res.status}`;
        } catch {
          errorMsg = `HTTP ${res.status}: ${await res.text()}`;
        }
        return;
      }

      const raw = await res.json();
      const entityContents = parseEntityContents(raw);
      if (raw.errors?.length) {
        iframeWarnings = raw.errors.map((e: string) => 'LLM error: ' + e);
      }

      if (Object.keys(entityContents).length === 0) {
        status = 'error';
        errorMsg = 'LLM 未返回任何页面内容，请检查 API 配置';
        return;
      }

      iframeReady = false;
      template = buildShell(entityContents);
      html = template;
      status = 'done';
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      status = 'error';
      errorMsg = String(err);
    }
  }
</script>

<div class="preview-panel">
  {#if status === 'empty'}
    <div class="empty-state">
      <p>添加实体后自动生成预览</p>
    </div>
  {:else if status === 'error'}
    <div class="error-state">
      <p>预览生成失败</p>
      <p class="error-detail">{errorMsg}</p>
    </div>
  {:else if status === 'loading' && !html}
    <div class="loading-state">
      <div class="pulse"></div>
      <p>AI 正在生成模板...</p>
    </div>
  {:else}
    {#if status === 'loading'}
      <div class="loading-bar"></div>
    {/if}
    {#if iframeWarnings.length > 0}
      <div class="warning-bar">
        {#each iframeWarnings as w}
          <p>{w}</p>
        {/each}
      </div>
    {/if}
    <iframe bind:this={iframeEl} onload={onIframeLoad} srcdoc={html} title="LLM 预览"></iframe>
  {/if}
</div>

<style lang="scss">
  .preview-panel {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: $color-surface;
    position: relative;
  }

  iframe {
    width: 100%;
    height: 100%;
    border: none;
    flex: 1;
  }

  .loading-bar {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 3px;
    background: linear-gradient(90deg, $color-primary, $color-accent, $color-primary);
    background-size: 200% 100%;
    animation: shimmer 1.5s ease-in-out infinite;
    z-index: 1;
  }

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  .warning-bar {
    background: #FFF3CD;
    border-bottom: 2px solid #FFDE00;
    padding: 4px 12px;
    font-size: 11px;
    font-family: ui-monospace, monospace;
    color: #856404;
    max-height: 80px;
    overflow-y: auto;
    flex-shrink: 0;

    p {
      margin: 2px 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .empty-state,
  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: $color-text-muted;
    font-style: italic;
    gap: $spacing-md;
  }

  .error-state {
    color: #d63638;
  }

  .error-detail {
    font-size: $font-size-xs;
    max-width: 300px;
    text-align: center;
    word-break: break-all;
  }

  .pulse {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: $color-primary;
    animation: pulse 1.2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      transform: scale(0.8);
      opacity: 0.5;
    }
    50% {
      transform: scale(1.2);
      opacity: 1;
    }
  }
</style>
