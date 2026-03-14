// ============================================================
// 确定性模板生成器
//
// 替换 LLM 调用，将 projectSchema() 的输出直接映射为
// listing_html / detail_html，格式与 LLM API 相同，
// 可直接喂给 parseEntityContents()。
// ============================================================

export type ProjectedField = {
  name: string;
  type: string;
  subtype?: string;
  cardinality?: string;
  target?: string;
  subFields?: ProjectedField[];
};

export type ProjectedEntity = {
  name: string;
  fields: ProjectedField[];
};

type TemplateResult = {
  pages: { entity_name: string; listing_html: string; detail_html: string }[];
};

// === 字段分类 ===

function isImage(f: ProjectedField): boolean {
  return f.type === 'image' || f.type === 'gallery';
}

function isLink(f: ProjectedField): boolean {
  return f.type === 'email' || f.type === 'url' || f.type === 'page_link' || f.type === 'file';
}

function isToggle(f: ProjectedField): boolean {
  return f.type === 'true_false';
}

function isColor(f: ProjectedField): boolean {
  return f.type === 'color_picker';
}

function isOembed(f: ProjectedField): boolean {
  return f.type === 'oembed';
}

function isPreformatted(f: ProjectedField): boolean {
  return f.type === 'textarea';
}

function isRef(f: ProjectedField): boolean {
  return f.type === 'ref';
}

function isRepeat(f: ProjectedField): boolean {
  return f.type === 'repeat';
}

/** 适合作为标题/标签的字段：纯文本类 atom，排除 image/wysiwyg/oembed 等非文本类型 */
function isLabelCandidate(f: ProjectedField): boolean {
  return !isRef(f) && !isRepeat(f) && !isImage(f) && !isOembed(f) && f.type !== 'wysiwyg';
}

// === Atom 渲染 ===

function atomCellHtml(f: ProjectedField, key?: string): string {
  const p = `{{${key ?? f.name}}}`;
  if (isImage(f)) return `<img src="${p}" alt="${f.name}" class="w-10 h-10 rounded-sm object-cover border-2 border-[#383838]">`;
  if (isOembed(f)) return `<span class="text-[#0073aa] text-sm" data-oembed="${p}">▶ ${f.name}</span>`;
  if (f.type === 'email') return `<a href="mailto:${p}" class="text-[#0073aa] hover:underline">${p}</a>`;
  if (isLink(f)) return `<a href="${p}" target="_blank" class="text-[#0073aa] hover:underline">${p}</a>`;
  if (isToggle(f)) return `<span class="px-2 py-0.5 rounded-sm border border-current text-xs font-mono">${p}</span>`;
  if (isColor(f)) return `<span class="inline-flex items-center gap-1"><span class="w-4 h-4 rounded-sm border border-[#383838]" style="background:${p}"></span>${p}</span>`;
  return p;
}

function atomDetailHtml(f: ProjectedField): string {
  const p = `{{${f.name}}}`;
  if (isImage(f)) return `<img src="${p}" alt="${f.name}" class="max-w-sm rounded-sm border-2 border-[#383838]">`;
  if (isOembed(f)) return `<div data-oembed="${p}" class="relative w-full" style="padding-bottom:56.25%"><iframe class="absolute inset-0 w-full h-full border-0 rounded-sm" allowfullscreen></iframe></div>`;
  if (f.type === 'email') return `<a href="mailto:${p}" class="text-[#0073aa] hover:underline">${p}</a>`;
  if (isLink(f)) return `<a href="${p}" target="_blank" class="text-[#0073aa] hover:underline">${p}</a>`;
  if (isToggle(f)) return `<span class="px-2 py-0.5 rounded-sm border border-current text-xs font-mono">${p}</span>`;
  if (isColor(f)) return `<span class="inline-flex items-center gap-2"><span class="w-6 h-6 rounded-sm border-2 border-[#383838]" style="background:${p}"></span><code class="text-sm">${p}</code></span>`;
  if (f.type === 'wysiwyg') return `<div class="prose max-w-none">{{{${f.name}}}}</div>`;
  if (isPreformatted(f)) return `<span class="whitespace-pre-wrap">${p}</span>`;
  return `<span>${p}</span>`;
}

// === Ref 渲染 ===

function refCellHtml(f: ProjectedField): string {
  return `<a href="#entity-${f.target}" class="text-[#6FC2FF] hover:text-[#2BA5FF] hover:underline">{{${f.name}}}</a>`;
}

function refDetailHtml(f: ProjectedField, allEntities: ProjectedEntity[]): string {
  if (f.cardinality === '1') {
    // ref(1): 链接 + 穿透第一个 atom 字段
    const target = allEntities.find(e => e.name === f.target);
    const penetrate = target?.fields.find(tf => isLabelCandidate(tf) && tf.name !== f.name);
    const dot = penetrate ? ` <span class="text-[#646970] text-sm">({{${f.name}.${penetrate.name}}})</span>` : '';
    return `<a href="#entity-${f.target}" class="text-[#6FC2FF] hover:text-[#2BA5FF] hover:underline">{{${f.name}}}</a>${dot}`;
  }
  // ref(n) / taxonomy: badge list via ref-repeat
  const target = allEntities.find(e => e.name === f.target);
  const labelField = target?.fields.find(tf => isLabelCandidate(tf));
  const label = labelField ? `{{${labelField.name}}}` : `{{${f.name}}}`;
  return `<template data-acf-ref-repeat="${f.name}"><a href="#entity-${f.target}" class="inline-block px-3 py-1 mr-1 mb-1 rounded-sm border-2 border-[#383838] text-sm font-mono text-[#6FC2FF] hover:text-[#2BA5FF] hover:underline">${label}</a> </template>`;
}

// === Repeater 渲染 (detail only) ===

function repeaterDetailHtml(f: ProjectedField, _allEntities: ProjectedEntity[]): string {
  const subs = f.subFields ?? [];
  if (subs.length === 0) return `<span class="text-[#646970]">（空 Repeater）</span>`;

  const ths = subs.map(sf => `<th class="px-3 py-2 text-left text-xs font-mono uppercase tracking-wide">${sf.name}</th>`).join('');
  const tds = subs.map((sf, idx) => {
    const key = `__sf_${idx}__`;
    let cell: string;
    if (isRef(sf)) {
      cell = `<a href="#entity-${sf.target}" class="text-[#6FC2FF] hover:underline">{{${key}}}</a>`;
    } else {
      cell = atomCellHtml(sf, key);
    }
    return `<td class="px-3 py-2 border-t border-[#e0dbd5]">${cell}</td>`;
  }).join('');

  return `<table class="w-full border-2 border-[#383838] rounded-sm text-sm">
  <thead class="bg-[#383838] text-[#F4EFEA]"><tr>${ths}</tr></thead>
  <tbody><template data-acf-field-repeat="${f.name}"><tr class="even:bg-[#F4EFEA]">${tds}</tr></template></tbody>
</table>`;
}

// === Listing 卡片字段选取 ===

type CardSlots = {
  cover: ProjectedField | null;   // image → 封面
  title: ProjectedField | null;   // 第一个 text 类 → 标题
  metas: ProjectedField[];        // 最多 3 个摘要字段（ref 优先）
};

function pickCardSlots(fields: ProjectedField[]): CardSlots {
  const visible = fields.filter(f => !isRepeat(f));
  const cover = visible.find(f => isImage(f)) ?? null;
  const title = visible.find(f => isLabelCandidate(f) && !isImage(f)) ?? null;
  const rest = visible.filter(f => f !== cover && f !== title && f.type !== 'wysiwyg');
  // Prioritize ref fields (relationships/taxonomy) — they add the most context on cards
  const refs = rest.filter(f => isRef(f));
  const others = rest.filter(f => !isRef(f));
  const metas = [...refs, ...others].slice(0, 3);
  return { cover, title, metas };
}

// === Taxonomy 检测 ===

function isTaxEntity(entity: ProjectedEntity): boolean {
  // Taxonomy entity 有一个自引用 ref 字段（parent）
  return entity.fields.some(f => isRef(f) && f.target === entity.name);
}

// === Taxonomy 模板 ===

function generateTaxonomyTemplates(
  entity: ProjectedEntity,
  _allEntities: ProjectedEntity[],
): { entity_name: string; listing_html: string; detail_html: string } {
  // 找 taxonomy 的显示字段（排除自引用 parent）
  const labelField = entity.fields.find(f => !isRef(f) && !isRepeat(f));
  const label = labelField ? `{{${labelField.name}}}` : `{{__index__}}`;

  // Taxonomy 不需要 listing 页面 — 导航通过 nav 下拉菜单
  const listing_html = '';

  // Detail: term archive（无返回按钮，taxonomy 通过下拉菜单导航）
  const detail_html = `<div class="bg-white border-2 border-[#383838] rounded-sm p-6 mb-6">
  <h2 class="text-2xl font-bold">${label} <span class="text-sm font-mono text-[#646970] uppercase">${entity.name}</span></h2>
</div>
<div data-acf-term-archive></div>`;

  return { entity_name: entity.name, listing_html, detail_html };
}

// === 生成单个 Entity ===

function generateEntityTemplates(
  entity: ProjectedEntity,
  allEntities: ProjectedEntity[],
): { entity_name: string; listing_html: string; detail_html: string } {
  const { cover, title, metas } = pickCardSlots(entity.fields);

  // --- Listing: card grid ---
  const coverHtml = cover
    ? `<div class="aspect-[4/3] overflow-hidden bg-[#e0dbd5]"><img src="{{${cover.name}}}" alt="${cover.name}" class="w-full h-full object-cover"></div>`
    : '';

  const titleHtml = title
    ? `<h3 class="font-bold text-lg truncate">${atomCellHtml(title)}</h3>`
    : `<h3 class="font-bold text-lg text-[#646970]">${entity.name} #{{__index__}}</h3>`;

  const metaLines = metas.map(f => {
    const val = isRef(f) ? refCellHtml(f) : atomCellHtml(f);
    return `<div class="flex items-center gap-2 text-sm text-[#646970] truncate"><span class="font-mono text-xs uppercase opacity-60">${f.name}</span> ${val}</div>`;
  }).join('\n        ');

  const listing_html = `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  <template data-acf-repeat="${entity.name}">
    <div class="bg-white border-2 border-[#383838] rounded-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer" data-detail-index="{{__index__}}">
      ${coverHtml}
      <div class="p-4 flex flex-col gap-2">
        ${titleHtml}
        ${metaLines}
      </div>
    </div>
  </template>
</div>`;

  // --- Detail: label/value rows ---
  const firstAtom = entity.fields.find(f => isLabelCandidate(f));
  const titlePlaceholder = firstAtom ? `{{${firstAtom.name}}}` : entity.name;

  const fieldRows = entity.fields.map(f => {
    let value: string;
    if (isRef(f)) {
      value = refDetailHtml(f, allEntities);
    } else if (isRepeat(f)) {
      value = repeaterDetailHtml(f, allEntities);
    } else {
      value = atomDetailHtml(f);
    }
    return `  <div class="flex flex-col sm:flex-row gap-1 sm:gap-4 py-3 border-b border-[#e0dbd5]">
    <div class="w-40 shrink-0 text-[#646970] font-mono text-xs uppercase tracking-wide pt-1">${f.name}</div>
    <div class="flex-1 min-w-0">${value}</div>
  </div>`;
  }).join('\n');

  const detail_html = `<a href="#" data-back-to-listing class="inline-flex items-center gap-1 text-[#0073aa] hover:underline font-mono text-sm mb-4">← 返回列表</a>
<div class="bg-white border-2 border-[#383838] rounded-sm p-6">
  <h2 class="text-2xl font-bold mb-6">${titlePlaceholder} <span class="text-sm font-mono text-[#646970] uppercase">${entity.name}</span></h2>
${fieldRows}
</div>`;

  return { entity_name: entity.name, listing_html, detail_html };
}

// === 公开接口 ===

export function generateAllTemplates(
  schema: { entities: ProjectedEntity[] },
): TemplateResult {
  return {
    pages: schema.entities.map(e =>
      isTaxEntity(e)
        ? generateTaxonomyTemplates(e, schema.entities)
        : generateEntityTemplates(e, schema.entities),
    ),
  };
}
