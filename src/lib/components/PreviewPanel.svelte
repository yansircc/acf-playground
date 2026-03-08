<script lang="ts">
  import { store } from '$lib/store.svelte';
  import type { Field } from '$lib/types';

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
    const data = buildClientData();
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

  // === Schema 投影：去掉 UUID，只保留语义 ===

  function projectField(f: Field): Record<string, unknown> {
    if (f.type.kind === 'atom') {
      return { name: f.name, type: f.type.subtype };
    }
    if (f.type.kind === 'repeat') {
      return {
        name: f.name,
        type: 'repeat',
        subFields: f.type.fields.map((sf) => projectField(sf)),
      };
    }
    // ref
    const target = store.entities.find((e) => e.id === (f.type as { target: string }).target);
    return {
      name: f.name,
      type: 'ref',
      cardinality: (f.type as { cardinality: string }).cardinality,
      target: target?.name ?? '',
    };
  }

  function projectSchema() {
    return {
      entities: store.entities.map((e) => ({
        name: e.name,
        fields: e.fields.map(projectField),
      })),
    };
  }

  function schemaKey(): string {
    return JSON.stringify(projectSchema());
  }

  // === 从 LLM 结构化输出解析实体内容 ===

  function parseEntityContents(json: { pages: { entity_name: string; listing_html: string; detail_html: string }[] }): Record<string, { listing: string; detail: string }> {
    const contents: Record<string, { listing: string; detail: string }> = {};
    for (const page of json.pages ?? []) {
      contents[page.entity_name] = {
        listing: page.listing_html,
        detail: page.detail_html,
      };
    }
    return contents;
  }

  // === 构建注入 iframe 的 schema 和 data ===

  function buildClientSchema() {
    return store.entities.map((e) => ({
      id: e.id,
      name: e.name,
      fields: e.fields.map((f) => {
        const base: Record<string, unknown> = { id: f.id, name: f.name, kind: f.type.kind };
        if (f.type.kind === 'ref') {
          base.target = f.type.target;
          base.cardinality = f.type.cardinality;
        }
        if (f.type.kind === 'repeat') {
          base.fields = f.type.fields.map((sf) => {
            const sub: Record<string, unknown> = { id: sf.id, name: sf.name, kind: sf.type.kind };
            if (sf.type.kind === 'ref') {
              sub.target = sf.type.target;
              sub.cardinality = sf.type.cardinality;
            }
            return sub;
          });
        }
        return base;
      }),
    }));
  }

  function buildClientData(): Record<string, Record<string, unknown>[]> {
    const out: Record<string, Record<string, unknown>[]> = {};
    for (const entity of store.entities) {
      out[entity.id] = (store.data[entity.id] ?? [{}]).map((row) => ({ ...row }));
    }
    return out;
  }

  // === HTML Shell：客户端确定性生成 ===

  function buildShell(entityContents: Record<string, { listing: string; detail: string }>): string {
    const names = store.entities.map((e) => e.name);

    const navItems = names.map((name) =>
      `<a href="#entity-${name}" data-nav="entity-${name}" class="nav-tab">${name}</a>`
    ).join('\n      ');

    const pages = names.map((name) =>
      `<div class="entity-page" id="entity-${name}" style="display:none">
  <div class="listing-view"></div>
  <div class="detail-view" style="display:none"></div>
</div>`
    ).join('\n\n    ');

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
    const schemaJson = esc(JSON.stringify(buildClientSchema()));
    const dataJson = esc(JSON.stringify(buildClientData()));

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"><\/script>
  <style>
    body { background: #F4EFEA; font-family: Inter, system-ui, sans-serif; }
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

    // === Error infrastructure ===
    function reportWarning(msg) {
      window.__warnings.push(msg);
      console.warn('[preview]', msg);
    }
    function reportError(context, err) {
      var msg = context + ': ' + (err && err.message || String(err));
      window.__warnings.push('ERROR ' + msg);
      console.error('[preview]', msg, err);
    }
    function flushWarnings() {
      if (window.__warnings.length === 0) return;
      // 上报给父窗口
      try { parent.postMessage({ type: 'iframe-warnings', warnings: window.__warnings }, '*'); } catch(e) {}
      // 在 iframe 底部显示
      var existing = document.querySelector('.__debug-banner');
      if (existing) existing.remove();
      var banner = document.createElement('div');
      banner.className = '__debug-banner';
      banner.innerHTML = window.__warnings.map(function(w) {
        var cls = w.indexOf('ERROR') === 0 ? 'err' : 'warn';
        return '\\u003cspan class="' + cls + '"\\u003e' + w.replace(/</g, '&lt;') + '\\u003c/span\\u003e';
      }).join('\\u003cbr\\u003e');
      document.body.appendChild(banner);
    }
    window.onerror = function(msg, src, line, col, err) {
      reportError('uncaught@' + line + ':' + col, err || msg);
      flushWarnings();
    };

    // === 工具函数 ===
    function escapeHtml(s) {
      if (s == null) return '';
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function escapeRegex(s) {
      return s.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
    }

    function getEntityByName(name) {
      return window.__schema.find(function(e) { return e.name === name; });
    }

    function getRecordLabel(entityId, rowIndex) {
      var entity = window.__schema.find(function(e) { return e.id === entityId; });
      if (!entity) return '#' + (rowIndex + 1);
      var textField = entity.fields.find(function(f) { return f.kind === 'atom'; });
      if (!textField) return entity.name + ' #' + (rowIndex + 1);
      var rows = window.__data[entityId] || [];
      if (rowIndex < 0 || rowIndex >= rows.length) return entity.name + ' #' + (rowIndex + 1);
      var val = rows[rowIndex] && rows[rowIndex][textField.id];
      return val ? String(val) : entity.name + ' #' + (rowIndex + 1);
    }

    function resolveRef(fieldSchema, rawValue) {
      if (!fieldSchema || fieldSchema.kind !== 'ref') return '';
      var targetId = fieldSchema.target;
      if (!targetId) return '';
      if (fieldSchema.cardinality === 'n' || fieldSchema.cardinality === 'taxonomy') {
        var arr = Array.isArray(rawValue) ? rawValue : [];
        return arr.map(function(idx) { return getRecordLabel(targetId, idx); }).join(', ');
      }
      if (typeof rawValue === 'number') return getRecordLabel(targetId, rawValue);
      return '';
    }

    function resolveRefDots(text, entitySchema, row) {
      return text.replace(/\\{\\{([^{}.]+)\\.([^{}.]+)\\}\\}/g, function(match, refName, targetFieldName) {
        var refField = entitySchema.fields.find(function(f) { return f.name === refName && f.kind === 'ref'; });
        if (!refField) return match;
        var targetEntity = window.__schema.find(function(e) { return e.id === refField.target; });
        if (!targetEntity) return match;
        var refVal = row[refField.id];
        if (typeof refVal !== 'number') return match;
        var targetRows = window.__data[refField.target] || [];
        if (refVal < 0 || refVal >= targetRows.length) return match;
        var targetRow = targetRows[refVal];
        var tf = targetEntity.fields.find(function(f) { return f.name === targetFieldName; });
        if (!tf) return match;
        if (tf.kind === 'atom') return escapeHtml(targetRow[tf.id]);
        if (tf.kind === 'ref') return escapeHtml(resolveRef(tf, targetRow[tf.id]));
        return match;
      });
    }

    function expandRefRepeat(refFieldSchema, row, itemTemplate) {
      if (!refFieldSchema || refFieldSchema.kind !== 'ref') return '';
      var targetEntity = window.__schema.find(function(e) { return e.id === refFieldSchema.target; });
      if (!targetEntity) return '';
      var targetRows = window.__data[refFieldSchema.target] || [];
      var rawVal = row[refFieldSchema.id];
      var indices;
      if (refFieldSchema.cardinality === 'n' || refFieldSchema.cardinality === 'taxonomy') {
        indices = Array.isArray(rawVal) ? rawVal : [];
      } else {
        indices = typeof rawVal === 'number' ? [rawVal] : [];
      }
      return indices.filter(function(idx) { return idx >= 0 && idx < targetRows.length; })
        .map(function(idx) {
          var filled = itemTemplate;
          var targetRow = targetRows[idx];
          targetEntity.fields.forEach(function(tf) {
            if (tf.kind === 'atom') {
              filled = filled.split('{{' + tf.name + '}}').join(escapeHtml(targetRow[tf.id]));
            } else if (tf.kind === 'ref') {
              filled = filled.split('{{' + tf.name + '}}').join(escapeHtml(resolveRef(tf, targetRow[tf.id])));
            }
          });
          filled = resolveRefDots(filled, targetEntity, targetRow);
          return filled;
        }).join('');
    }

    // === 共享核心：填充单条记录模板 ===
    function fillRecord(template, entitySchema, row, rowIndex) {
      var filled = template;
      if (rowIndex !== undefined) {
        filled = filled.split('{{__index__}}').join(String(rowIndex));
      }
      // 1. repeat 块（空格容错）
      entitySchema.fields.forEach(function(field) {
        if (field.kind !== 'repeat' || !field.fields) return;
        var regex = new RegExp('<!--\\\\s*repeat:\\\\s*' + escapeRegex(field.name) + '\\\\s*-->([\\\\s\\\\S]*?)<!--\\\\s*/repeat:\\\\s*' + escapeRegex(field.name) + '\\\\s*-->', 'g');
        filled = filled.replace(regex, function(_m, rowTemplate) {
          var repeatRows = Array.isArray(row[field.id]) ? row[field.id] : [];
          if (repeatRows.length === 0) return '';
          return repeatRows.map(function(rr) {
            var filledRow = rowTemplate;
            field.fields.forEach(function(sf) {
              if (sf.kind === 'ref') {
                filledRow = filledRow.split('{{' + sf.name + '}}').join(escapeHtml(resolveRef(sf, rr[sf.id])));
              } else {
                filledRow = filledRow.split('{{' + sf.name + '}}').join(escapeHtml(rr[sf.id]));
              }
            });
            return filledRow;
          }).join('');
        });
      });
      // 2. ref-repeat 块（空格容错）
      entitySchema.fields.forEach(function(field) {
        if (field.kind !== 'ref') return;
        var regex = new RegExp('<!--\\\\s*ref-repeat:\\\\s*' + escapeRegex(field.name) + '\\\\s*-->([\\\\s\\\\S]*?)<!--\\\\s*/ref-repeat:\\\\s*' + escapeRegex(field.name) + '\\\\s*-->', 'g');
        filled = filled.replace(regex, function(_m, itemTpl) {
          return expandRefRepeat(field, row, itemTpl);
        });
      });
      // 3. atom + ref 字段
      entitySchema.fields.forEach(function(field) {
        if (field.kind === 'atom') {
          filled = filled.split('{{' + field.name + '}}').join(escapeHtml(row[field.id]));
        } else if (field.kind === 'ref') {
          filled = filled.split('{{' + field.name + '}}').join(escapeHtml(resolveRef(field, row[field.id])));
        }
      });
      // 4. ref 穿透 {{X.Y}}
      filled = resolveRefDots(filled, entitySchema, row);
      return filled;
    }

    // === Listing 模板填充 ===
    function fillListingTemplate(entityName) {
      var tpl = window.__listingTemplates[entityName];
      var entity = getEntityByName(entityName);
      if (!tpl || !entity) {
        reportWarning('[' + entityName + '] listing template or schema not found (tpl=' + (tpl ? 'yes' : 'empty') + ', entity=' + (entity ? 'yes' : 'null') + ')');
        return '\\u003cdiv class="p-8 text-gray-400 text-xl"\\u003e暂无内容\\u003c/div\\u003e';
      }
      var rows = window.__data[entity.id] || [{}];
      // 空格容错的 entity-repeat 正则
      var regex = new RegExp(
        '<!--\\\\s*entity-repeat:\\\\s*' + escapeRegex(entityName) + '\\\\s*-->([\\\\s\\\\S]*?)<!--\\\\s*/entity-repeat:\\\\s*' + escapeRegex(entityName) + '\\\\s*-->'
      );
      var matched = regex.test(tpl);
      if (!matched) {
        reportWarning('[' + entityName + '] entity-repeat tag not found in listing template. First 200 chars: ' + tpl.substring(0, 200));
        return tpl;
      }
      return tpl.replace(regex, function(_m, recordTpl) {
        return rows.map(function(row, i) {
          return fillRecord(recordTpl, entity, row, i);
        }).join('');
      });
    }

    // === Detail 模板填充 ===
    function fillDetailTemplate(entityName, rowIndex) {
      var tpl = window.__detailTemplates[entityName];
      var entity = getEntityByName(entityName);
      if (!tpl || !entity) return '\\u003cdiv class="p-8 text-gray-400"\\u003e无详情模板\\u003c/div\\u003e';
      var rows = window.__data[entity.id] || [];
      if (rowIndex < 0 || rowIndex >= rows.length) return '\\u003cdiv class="p-8 text-gray-400"\\u003e记录不存在\\u003c/div\\u003e';
      return fillRecord(tpl, entity, rows[rowIndex]);
    }

    // === 渲染入口 ===
    function renderAllListings() {
      window.__schema.forEach(function(entity) {
        try {
          var page = document.getElementById('entity-' + entity.name);
          if (!page) return;
          var lv = page.querySelector('.listing-view');
          if (lv) lv.innerHTML = fillListingTemplate(entity.name);
        } catch (err) {
          reportError('renderAllListings[' + entity.name + ']', err);
        }
      });
    }

    function renderCurrentView() {
      try {
        var activePage = null;
        document.querySelectorAll('.entity-page').forEach(function(p) {
          if (p.style.display !== 'none') activePage = p;
        });
        if (!activePage) return;
        var entityName = activePage.id.replace('entity-', '');
        var lv = activePage.querySelector('.listing-view');
        var dv = activePage.querySelector('.detail-view');
        if (dv && dv.style.display !== 'none') {
          var en = dv.dataset.entityName;
          var ri = dv.dataset.rowIndex;
          if (en && ri !== undefined) {
            dv.innerHTML = fillDetailTemplate(en, parseInt(ri, 10));
          }
        } else if (lv) {
          lv.innerHTML = fillListingTemplate(entityName);
        }
      } catch (err) {
        reportError('renderCurrentView', err);
      }
    }

    // === postMessage 监听 ===
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'data-update') {
        window.__data = e.data.data;
        renderCurrentView();
      }
    });

    // === 导航 ===
    function navigateTo(id) {
      document.querySelectorAll('.entity-page').forEach(function(p) { p.style.display = 'none'; });
      var t = document.getElementById(id);
      if (t) {
        t.style.display = 'block';
        var entityName = id.replace('entity-', '');
        var listing = t.querySelector('.listing-view');
        var detail = t.querySelector('.detail-view');
        if (listing) {
          listing.innerHTML = fillListingTemplate(entityName);
          listing.style.display = 'block';
        }
        if (detail) detail.style.display = 'none';
        window.scrollTo(0, 0);
      }
      document.querySelectorAll('[data-nav]').forEach(function(n) { n.classList.remove('active'); });
      var a = document.querySelector('[data-nav="' + id + '"]');
      if (a) a.classList.add('active');
    }

    function showDetail(entityName, rowIndex) {
      var page = document.getElementById('entity-' + entityName);
      if (!page) return;
      var listing = page.querySelector('.listing-view');
      var detail = page.querySelector('.detail-view');
      if (!listing || !detail) return;
      detail.dataset.entityName = entityName;
      detail.dataset.rowIndex = String(rowIndex);
      detail.innerHTML = fillDetailTemplate(entityName, rowIndex);
      listing.style.display = 'none';
      detail.style.display = 'block';
      window.scrollTo(0, 0);
    }

    function showListing(entityName) {
      var page = document.getElementById('entity-' + entityName);
      if (!page) return;
      var listing = page.querySelector('.listing-view');
      var detail = page.querySelector('.detail-view');
      if (!listing || !detail) return;
      listing.innerHTML = fillListingTemplate(entityName);
      listing.style.display = 'block';
      detail.style.display = 'none';
      window.scrollTo(0, 0);
    }

    document.addEventListener('click', function(e) {
      var detailLink = e.target.closest('[data-detail-index]');
      if (detailLink) {
        e.preventDefault();
        var entityPage = detailLink.closest('.entity-page');
        if (entityPage) {
          var entityName = entityPage.id.replace('entity-', '');
          var rowIndex = parseInt(detailLink.getAttribute('data-detail-index'), 10);
          showDetail(entityName, rowIndex);
        }
        return;
      }
      var backLink = e.target.closest('[data-back-to-listing]');
      if (backLink) {
        e.preventDefault();
        var entityPage2 = backLink.closest('.entity-page');
        if (entityPage2) {
          var entityName2 = entityPage2.id.replace('entity-', '');
          showListing(entityName2);
        }
        return;
      }
      var navLink = e.target.closest('a[href^="#entity-"]');
      if (navLink) {
        e.preventDefault();
        var targetId = navLink.getAttribute('href').slice(1);
        var targetEntityName = targetId.replace('entity-', '');
        var targetEntity = getEntityByName(targetEntityName);
        // 尝试用链接文本匹配目标实体的具体记录 → 直接跳 detail
        if (targetEntity) {
          var linkText = (navLink.textContent || '').trim();
          var targetRows = window.__data[targetEntity.id] || [];
          var matchedIndex = -1;
          for (var ri = 0; ri < targetRows.length; ri++) {
            if (getRecordLabel(targetEntity.id, ri) === linkText) {
              matchedIndex = ri; break;
            }
          }
          if (matchedIndex >= 0) {
            navigateTo(targetId);
            showDetail(targetEntityName, matchedIndex);
            return;
          }
        }
        navigateTo(targetId);
      }
    });

    document.addEventListener('DOMContentLoaded', function() {
      try {
        renderAllListings();
      } catch (err) {
        reportError('DOMContentLoaded', err);
      }
      flushWarnings();
      var pages = document.querySelectorAll('.entity-page');
      if (pages.length > 0) {
        pages[0].style.display = 'block';
        var a = document.querySelector('[data-nav="' + pages[0].id + '"]');
        if (a) a.classList.add('active');
      }
    });
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
        body: JSON.stringify(projectSchema()),
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
