// @ts-nocheck
// ============================================================
// iframe 内运行时 — 模板引擎 · 导航 · 事件处理
//
// 本文件通过 Vite ?raw import 注入 iframe 的 <script> 标签。
// 运行时依赖 window.__listingTemplates / __detailTemplates /
// __schema / __data / __warnings 由 buildShell 在此文件之前赋值。
// ============================================================

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
  try { parent.postMessage({ type: 'iframe-warnings', warnings: window.__warnings }, '*'); } catch(e) {}
  var existing = document.querySelector('.__debug-banner');
  if (existing) existing.remove();
  var banner = document.createElement('div');
  banner.className = '__debug-banner';
  banner.innerHTML = window.__warnings.map(function(w) {
    var cls = w.indexOf('ERROR') === 0 ? 'err' : 'warn';
    return '<span class="' + cls + '">' + w.replace(/</g, '&lt;') + '<\/span>';
  }).join('<br>');
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

function toEmbedUrl(url) {
  if (!url) return null;
  try {
    var m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
    if (m) return 'https://www.youtube.com/embed/' + m[1];
    m = url.match(/vimeo\.com\/(\d+)/);
    if (m) return 'https://player.vimeo.com/video/' + m[1];
  } catch(e) {}
  return null;
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
  return (val != null && val !== '') ? String(val) : entity.name + ' #' + (rowIndex + 1);
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
  return text.replace(/\{\{([^{}.]+)\.([^{}.]+)\}\}/g, function(match, refName, targetFieldName) {
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

  // 检查是否需要 DOM 处理（无 <template 标签则跳过，纯字符串替换）
  if (filled.indexOf('<template ') !== -1) {
    var doc = new DOMParser().parseFromString('<div>' + filled + '</div>', 'text/html');
    var root = doc.body.firstElementChild;

    // 1. repeat 块 — 处理所有匹配的 <template data-acf-field-repeat>
    entitySchema.fields.forEach(function(field) {
      if (field.kind !== 'repeat' || !field.fields) return;
      root.querySelectorAll('template[data-acf-field-repeat]').forEach(function(tpl) {
        if (tpl.getAttribute('data-acf-field-repeat') !== field.name) return;
        var repeatRows = Array.isArray(row[field.id]) ? row[field.id] : [];
        if (repeatRows.length === 0) { tpl.remove(); return; }
        var html = repeatRows.map(function(rr) {
          var filledRow = tpl.innerHTML;
          field.fields.forEach(function(sf) {
            if (sf.kind === 'ref') {
              filledRow = filledRow.split('{{' + sf.name + '}}').join(escapeHtml(resolveRef(sf, rr[sf.id])));
            } else {
              filledRow = filledRow.split('{{' + sf.name + '}}').join(escapeHtml(rr[sf.id]));
            }
          });
          // repeater 内 ref 穿透
          filledRow = resolveRefDots(filledRow, { fields: field.fields }, rr);
          return filledRow;
        }).join('');
        var wrap = doc.createElement('template');
        wrap.innerHTML = html;
        while (wrap.content.firstChild) tpl.parentNode.insertBefore(wrap.content.firstChild, tpl);
        tpl.remove();
      });
    });

    // 2. ref-repeat 块 — 同理
    entitySchema.fields.forEach(function(field) {
      if (field.kind !== 'ref') return;
      root.querySelectorAll('template[data-acf-ref-repeat]').forEach(function(tpl) {
        if (tpl.getAttribute('data-acf-ref-repeat') !== field.name) return;
        var expanded = expandRefRepeat(field, row, tpl.innerHTML);
        var wrap = doc.createElement('template');
        wrap.innerHTML = expanded;
        while (wrap.content.firstChild) tpl.parentNode.insertBefore(wrap.content.firstChild, tpl);
        tpl.remove();
      });
    });

    filled = root.innerHTML;
  }

  // 3. atom + ref 字段（字符串替换，不需要 DOM）
  entitySchema.fields.forEach(function(field) {
    if (field.kind === 'atom') {
      // wysiwyg: triple-brace → raw HTML (unescaped)
      filled = filled.split('{{{' + field.name + '}}}').join(row[field.id] != null ? String(row[field.id]) : '');
      // normal: double-brace → escaped
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
    if (!tpl) reportWarning('[' + entityName + '] LLM 未生成 listing 模板（API 调用可能失败）');
    if (!entity) reportWarning('[' + entityName + '] schema 中找不到该实体');
    return '<div class="p-8 text-gray-400 text-xl">暂无内容<\/div>';
  }
  var rows = window.__data[entity.id] || [{}];

  var doc = new DOMParser().parseFromString('<div>' + tpl + '</div>', 'text/html');
  var root = doc.body.firstElementChild;
  var found = false;
  root.querySelectorAll('template[data-acf-repeat]').forEach(function(t) {
    if (t.getAttribute('data-acf-repeat') !== entityName) return;
    found = true;
    var expanded = rows.map(function(row, i) {
      return fillRecord(t.innerHTML, entity, row, i);
    }).join('');
    var wrap = doc.createElement('template');
    wrap.innerHTML = expanded;
    while (wrap.content.firstChild) t.parentNode.insertBefore(wrap.content.firstChild, t);
    t.remove();
  });

  if (!found) {
    reportWarning('[' + entityName + '] <template data-acf-repeat> not found. First 200: ' + tpl.substring(0, 200));
    return tpl;
  }
  return root.innerHTML;
}

// === Detail 模板填充 ===

function fillDetailTemplate(entityName, rowIndex) {
  var tpl = window.__detailTemplates[entityName];
  var entity = getEntityByName(entityName);
  if (!tpl || !entity) return '<div class="p-8 text-gray-400">无详情模板<\/div>';
  var rows = window.__data[entity.id] || [];
  if (rowIndex < 0 || rowIndex >= rows.length) return '<div class="p-8 text-gray-400">记录不存在<\/div>';
  return fillRecord(tpl, entity, rows[rowIndex]);
}

// === 残留占位符检测 ===

function checkResidualPlaceholders(html, context) {
  var residual = html.match(/\{\{[^}]+\}\}/g);
  if (!residual) return;
  var unique = residual.filter(function(v, i, a) { return a.indexOf(v) === i; });
  if (unique.length > 5) unique = unique.slice(0, 5).concat(['... +' + (residual.length - 5) + ' more']);
  reportWarning('[' + context + '] unresolved placeholders: ' + unique.join(', '));
}

// === oEmbed 后处理 ===

function processOembedElements(container) {
  if (!container) return;
  container.querySelectorAll('[data-oembed]').forEach(function(el) {
    var url = el.getAttribute('data-oembed');
    var embedUrl = toEmbedUrl(url);
    var iframe = el.querySelector('iframe');
    if (iframe && embedUrl) {
      iframe.src = embedUrl;
    } else if (!iframe && embedUrl) {
      // listing card: just show play icon, no iframe
    }
  });
}

// === 渲染入口 ===

function renderAllListings() {
  window.__schema.forEach(function(entity) {
    try {
      var page = document.getElementById('entity-' + entity.name);
      if (!page) return;
      var lv = page.querySelector('.listing-view');
      if (lv) {
        var filled = fillListingTemplate(entity.name);
        checkResidualPlaceholders(filled, entity.name);
        lv.innerHTML = filled;
        processOembedElements(lv);
      }
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
        var detailHtml = fillDetailTemplate(en, parseInt(ri, 10));
        checkResidualPlaceholders(detailHtml, en + ' detail');
        dv.innerHTML = detailHtml;
        processOembedElements(dv);
      }
    } else if (lv) {
      var listingHtml = fillListingTemplate(entityName);
      checkResidualPlaceholders(listingHtml, entityName);
      lv.innerHTML = listingHtml;
      processOembedElements(lv);
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

function findByAttr(attr, value) {
  var result = null;
  document.querySelectorAll('[' + attr + ']').forEach(function(el) {
    if (el.getAttribute(attr) === value) result = el;
  });
  return result;
}

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
      processOembedElements(listing);
      listing.style.display = 'block';
    }
    if (detail) detail.style.display = 'none';
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('[data-nav]').forEach(function(n) { n.classList.remove('active'); });
  var a = findByAttr('data-nav', id);
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
  processOembedElements(detail);
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
  processOembedElements(listing);
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
    var a = findByAttr('data-nav', pages[0].id);
    if (a) a.classList.add('active');
  }
});
