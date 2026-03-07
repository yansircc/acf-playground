# ACF Playground — 设计圣经

## 一句话

一个课堂演示用的 ACF 交互式沙盒，让不懂技术的外贸老板在拖拽中理解数据结构。

## 设计哲学

### 三原语生成一切

ACF 的全部复杂性由三条规则递归组合产生，没有第四条：

```
τ = Atom        -- 一个值（text, number, image... 全是 Atom 的投影）
  | τ*          -- 重复（Repeater）
  | &Entity     -- 引用（Relationship / Post Object）
```

所有字段类型都必须归约到这三个原语之一。如果你发现需要第四种，说明你的抽象出了问题。

### SSOT：单一真相源

整个应用只有一个 Store，所有 UI 都是它的单向投射：

```
Store = Schema + Data + Layout

Store (SSOT) ──→ Canvas    (拓扑：什么连着什么)
              ──→ Form      (内部：选中的里面有什么)
              ──→ Preview   (输出：用户看到什么)
              ──→ ACF JSON  (导出：导入 WordPress)
```

**绝对禁止**：
- 在 Store 之外存储任何可从 Store 派生的数据
- edges（连线）不存储，从 `kind: 'ref'` 字段自动 `$derived`
- 引入 DSL 或任何双向同步机制

### 核心数据模型

```typescript
type FieldType =
  | { kind: 'atom'; subtype: 'text' | 'number' | 'image' | 'url' | 'email' | 'textarea' }
  | { kind: 'repeat'; fields: Field[] }
  | { kind: 'ref'; target: string; cardinality: '1' | 'n' }

type Field = { id: string; name: string; type: FieldType }
type Entity = { id: string; name: string; fields: Field[] }

type Store = {
  entities: Entity[]
  data: Record<EntityID, Record<string, any>[]>
  positions: Record<EntityID, { x: number; y: number }>
  selected: EntityID | null
}

// 派生，不存储
edges = entities.flatMap(e =>
  e.fields.filter(f => f.type.kind === 'ref')
    .map(f => ({ from: e.id, fromField: f.id, to: f.type.target })))
```

## 技术栈

- **Svelte 5** + **Sass** — `$state` 是 SSOT，`$derived` 是投射
- **@xyflow/svelte** — 画布节点图
- **LLM API** — 右栏 Preview 动态生成 UI

## 布局

三栏并排，实时联动：

```
┌──────────────────────────────────────────────────┐
│  Canvas (画布)  │  Form (WP表单)  │  Preview (预览)  │
│  拖拽建模        │  填入数据         │  LLM 动态生成    │
└──────────────────────────────────────────────────┘
```

## 教学路径 = 类型构造顺序

```
Atom   →  "一个格子装一个值"         -- 理解字段
τ*     →  "格子可以重复"             -- 理解 Repeater
&E     →  "格子可以指向别的框框"      -- 理解 Relationship
```

这三步不可约。不可能有更短的路径。

## 支持的字段类型

### Atom 的六种渲染（本质是一种）
Text, Textarea, Number, Email, URL, Image

### 高阶类型
Repeater (τ*), Relationship (&E, cardinality='n'), Post Object (&E, cardinality='1'), Taxonomy (&E, 特殊引用)

## 受众

完全不懂技术的 B2B 外贸老板。一切设计以"大屏可读、拖拽可用、零学习成本"为原则。

## 使用场景

讲师课堂演示工具。讲师在台上操作，学员看大屏。不是自学工具。

## 导出

ACF 原生 JSON 格式，可直接在 WordPress 后台 ACF > Tools > Import 导入。

## 编码原则

- 不过度工程。三个原语够用就不加第四个
- Store 里不存派生数据。能 `$derived` 的就不 `$state`
- 组件边界对齐投射边界：Canvas 组件、Form 组件、Preview 组件
- 文件名用英文，注释可中英混用
