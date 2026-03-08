import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

// === Motherduck Design Language — 固定 design tokens ===

const DESIGN_TOKENS = `## Design Tokens（必须严格遵守）

### 色彩
- 主色 Primary: #6FC2FF（品牌蓝，主要动作与链接）
- 辅助色 Secondary: #FFDE00（品牌黄，强调与趣味点）
- 强调色 Accent: #53DBC9（品牌青）
- 警告红: #FF7169
- 文本/描边 Ink: #383838（主文本与边框）
- 背景 Base: #F4EFEA（温暖米白）
- Hover 背景: #F1F1F1
- Focus 蓝: #2BA5FF
- Success: #068475
- Error: #E23F35

### 结构
- 所有组件 2px 描边，颜色 #383838
- 圆角统一 2px
- 阴影极少，靠边线区分层级
- 基于 8px 网格，留白 8 → 16 → 24 → 32

### 字体
- 标题: font-mono（等宽），uppercase，letter-spacing: 0.02em
- 正文: font-sans（Inter），行高 1.6
- 层级: H1 2.5rem, H2 1.5rem, H3 1.25rem, body 1rem

### 交互
- Hover: 背景 #F1F1F1 或浮起效果
- 卡片: 白底 + 2px 描边 #383838，圆角 2px
- 表格: 斑马纹 even 行浅灰底，表头 #383838 描边
- 徽章/标签: px-3 py-1 rounded-sm border-2 border-current
- 图片: rounded-sm object-cover，头像 rounded-full + 2px 边框
- ref 链接: text-[#6FC2FF] hover:text-[#2BA5FF] hover:underline

### 整体风格
工业感线框 + 温暖底色。"看起来像一个懂设计的工程师做的产品。"
Flat · Framed · Minimal · Warm · Rational · Playful`;

const SYSTEM_PROMPT = `你是一个 UI 设计师。你会收到一组实体的完整 schema，但你只负责为【指定的那一个实体】生成两段 HTML：listing（列表页）和 detail（详情页）。

${DESIGN_TOKENS}

运行环境已提供 Tailwind CSS 4、导航栏和页面切换逻辑。你只需要输出页面内容区的 HTML。

## 两个模板的职责

### listing_html（列表页）
- 用 <template data-acf-repeat="实体名"> 包裹，展示**部分关键字段**（通常 2–4 个最重要的字段）
- 每行必须包含一个详情链接：<a href="#" data-detail-index="{{__index__}}">详情</a>
- 适合表格或卡片列表形式
- {{__index__}} 是内置占位符，会被替换为当前行号（0, 1, 2...）

### detail_html（详情页）
- **不要**用 entity-repeat 包裹（系统用 JS 为单条记录填充）
- 展示该实体的**全部字段**
- 必须包含返回链接：<a href="#" data-back-to-listing>← 返回列表</a>

## 数据占位符语法（只有以下语法有效，不要发明其他语法）

### 基础
- Atom 字段：{{字段名}}（image 字段用作 src，url 用作 href，email 用作 mailto:）
- Ref(1) 字段：{{字段名}} → 解析为目标记录的标签文本
- Ref(n) 字段：{{字段名}} → 解析为逗号分隔的标签列表

### ref 字段渲染为链接（重要！）
- **所有 ref 字段都应该渲染为可点击的跨页链接**，而不是纯文本
- Ref(1) 简单链接：<a href="#entity-{目标实体名}">{{ref字段名}}</a>
- Ref(n) 逐条链接（推荐）：用 ref-repeat 迭代，每条加链接：
  <template data-acf-ref-repeat="ref字段名"><a href="#entity-{目标实体名}" class="..."}>{{目标字段名}}</a> </template>
- Ref(n) 简单链接（备选）：<a href="#entity-{目标实体名}">{{ref字段名}}</a>（整体一个链接，逗号分隔）

### ref 穿透（访问引用目标的字段）
- {{ref字段名.目标字段名}} → 跟随 ref(1) 引用，取目标记录的某个字段值
- 仅适用于 ref(1)，不适用于 ref(n)

### 多条记录迭代（仅 listing）
- 当前实体的全部记录：<template data-acf-repeat="实体名">...单条模板...</template>
- 每个 data-acf-repeat 块内可用该实体的所有字段占位符
- {{__index__}} 在 data-acf-repeat 块内可用，替换为当前行的索引号

### ref(n) 作用域迭代（只遍历当前记录引用的那几条）
- <template data-acf-ref-repeat="ref字段名">...item...</template>
- 块内使用目标实体的字段名作为占位符

### Repeater 子字段
- <template data-acf-field-repeat="字段名">...{{子字段名}}...</template>

### 页面跳转
- <a href="#entity-{目标实体名}">链接文本</a>

## 禁止事项（以下语法不存在，不要使用）
- ❌ {{@index}}、{{@count}} 等内置变量 — 不存在（用 {{__index__}} 代替行号）
- ❌ count()、avg()、sum() 等聚合函数 — 不存在
- ❌ 同一实体名的 entity-repeat 在一个页面出现多次 — 会导致数据重复
- ❌ 自创占位符语法（如 \${xxx}、{%xxx%}）— 只有 {{}} 和 <template data-acf-*> 语法有效
- ❌ 统计数字（如"共 N 条"） — 用 "—" 占位或直接省略
- ❌ detail_html 中使用 data-acf-repeat — detail 是单条记录模板，不需要迭代`;

const RENDER_TOOL = {
  name: 'render_page',
  description: 'Output the listing and detail HTML templates for the specified entity page',
  input_schema: {
    type: 'object' as const,
    properties: {
      listing_html: {
        type: 'string' as const,
        description: '列表页 HTML：用 <template data-acf-repeat="实体名"> 包裹，展示部分关键字段，每行含 <a href="#" data-detail-index="{{__index__}}">详情</a>',
      },
      detail_html: {
        type: 'string' as const,
        description: '详情页 HTML：单条记录全字段模板，不包裹 entity-repeat，含 <a href="#" data-back-to-listing>← 返回列表</a>',
      },
    },
    required: ['listing_html', 'detail_html'],
  },
};

type EntitySchema = { name: string; fields: FieldSchema[] };
type FieldSchema = {
  name: string;
  type: string;
  subtype?: string;
  cardinality?: string;
  target?: string;
  subFields?: FieldSchema[];
};

/** Build context-specific examples from the schema for the user message */
function buildFieldExamples(entityName: string, schema: { entities: EntitySchema[] }): string {
  const entity = schema.entities.find((e) => e.name === entityName);
  if (!entity || entity.fields.length === 0) return '';

  const lines: string[] = ['', '## 该实体的字段速查'];
  const atomFields: string[] = [];
  const refFields: string[] = [];
  const repeatFields: string[] = [];

  for (const f of entity.fields) {
    if (f.type === 'ref' && f.target) {
      const card = f.cardinality === '1' ? 'ref(1)' : f.cardinality === 'n' ? 'ref(n)' : `ref(${f.cardinality})`;
      refFields.push(`- {{${f.name}}} — ${card}，指向「${f.target}」`);
      refFields.push(`  - 链接写法: <a href="#entity-${f.target}">{{${f.name}}}</a>`);
      // ref(1) dot examples
      if (f.cardinality === '1') {
        const targetEntity = schema.entities.find((e) => e.name === f.target);
        if (targetEntity) {
          const targetAtoms = targetEntity.fields.filter((tf) => tf.type !== 'ref' && tf.type !== 'repeat');
          for (const ta of targetAtoms.slice(0, 2)) {
            refFields.push(`  - 穿透示例: {{${f.name}.${ta.name}}}`);
          }
        }
      }
      // ref(n) ref-repeat example
      if (f.cardinality === 'n' || f.cardinality === 'taxonomy') {
        const targetEntity = schema.entities.find((e) => e.name === f.target);
        if (targetEntity) {
          const labelField = targetEntity.fields.find((tf) => tf.type !== 'ref' && tf.type !== 'repeat');
          const labelPlaceholder = labelField ? `{{${labelField.name}}}` : `{{${f.name}}}`;
          refFields.push(`  - 逐条迭代: <template data-acf-ref-repeat="${f.name}"><a href="#entity-${f.target}">${labelPlaceholder}</a> </template>`);
        }
      }
    } else if (f.type === 'repeat' && f.subFields) {
      const subParts: string[] = [];
      for (const sf of f.subFields) {
        subParts.push(`{{${sf.name}}}`);
        if (sf.type === 'ref' && sf.cardinality === '1' && sf.target) {
          const targetEntity = schema.entities.find((e) => e.name === sf.target);
          if (targetEntity) {
            const targetAtoms = targetEntity.fields.filter((tf) => tf.type !== 'ref' && tf.type !== 'repeat');
            for (const ta of targetAtoms.slice(0, 2)) {
              subParts.push(`穿透: {{${sf.name}.${ta.name}}}`);
            }
          }
        }
      }
      repeatFields.push(`- <template data-acf-field-repeat="${f.name}">${subParts.join(', ')}</template>`);
    } else {
      atomFields.push(`- {{${f.name}}} — ${f.type ?? f.subtype ?? 'text'}`);
    }
  }

  if (atomFields.length) { lines.push('### Atom 字段'); lines.push(...atomFields); }
  if (refFields.length) { lines.push('### Ref 字段'); lines.push(...refFields); }
  if (repeatFields.length) { lines.push('### Repeater 字段'); lines.push(...repeatFields); }

  return lines.join('\n');
}

async function generateEntityPage(
  entityName: string,
  schema: { entities: EntitySchema[] },
  headers: Record<string, string>,
  baseUrl: string,
): Promise<{ entity_name: string; listing_html: string; detail_html: string }> {
  const fieldExamples = buildFieldExamples(entityName, schema);

  const apiRes = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [RENDER_TOOL],
      tool_choice: { type: 'tool', name: 'render_page' },
      messages: [{
        role: 'user',
        content: `完整 schema（理解上下文用）：\n${JSON.stringify(schema, null, 2)}\n\n请为实体「${entityName}」生成 listing_html 和 detail_html。${fieldExamples}`,
      }],
    }),
  });

  if (!apiRes.ok) {
    const body = await apiRes.text();
    throw new Error(`LLM API ${apiRes.status}: ${body}`);
  }

  const result = await apiRes.json();
  const toolUse = result.content?.find((b: { type: string }) => b.type === 'tool_use');
  if (!toolUse?.input?.listing_html || !toolUse?.input?.detail_html) {
    throw new Error(`No tool_use output for ${entityName}`);
  }

  return {
    entity_name: entityName,
    listing_html: toolUse.input.listing_html,
    detail_html: toolUse.input.detail_html,
  };
}

export const POST: RequestHandler = async ({ request }) => {
  const apiKey = env.ANTHROPIC_API_KEY;
  const authToken = env.ANTHROPIC_AUTH_TOKEN;
  const baseUrl = env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';

  if (!apiKey && !authToken) {
    return new Response('ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN not set', { status: 500 });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
  };
  // Auth token 优先（代理模式），避免同时发送两种认证导致冲突
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  } else if (apiKey) {
    headers['x-api-key'] = apiKey;
  }

  const schema = await request.json() as { entities: EntitySchema[] };
  const entityNames = schema.entities.map((e) => e.name);

  // 并行调用，每个实体一个 LLM
  const results = await Promise.allSettled(
    entityNames.map((name) => generateEntityPage(name, schema, headers, baseUrl))
  );

  const pages: { entity_name: string; listing_html: string; detail_html: string }[] = [];
  const errors: string[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') {
      pages.push(r.value);
    } else {
      errors.push(r.reason?.message ?? String(r.reason));
    }
  }

  if (pages.length === 0 && errors.length > 0) {
    return new Response(JSON.stringify({ error: errors[0], details: errors }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body: { pages: typeof pages; errors?: string[] } = { pages };
  if (errors.length > 0) body.errors = errors;
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
  });
};
