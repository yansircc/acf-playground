import type { FieldType } from './types';

// === Config property definition for UI rendering + export ===

export type ConfigPropertyDef = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'toggle' | 'select' | 'textarea';
  default: unknown;
  options?: { value: string | number; label: string }[];
  group?: string;
  nested?: string; // e.g. 'wrapper' means this belongs to config.wrapper.{key}
};

// === Universal config (applies to ALL field types) ===

const UNIVERSAL_CONFIG: ConfigPropertyDef[] = [
  { key: 'required', label: '必填', type: 'toggle', default: 0 },
  { key: 'instructions', label: '说明', type: 'textarea', default: '' },
  { key: 'width', label: '宽度', type: 'text', default: '', group: '布局', nested: 'wrapper' },
  { key: 'class', label: 'CSS 类', type: 'text', default: '', group: '布局', nested: 'wrapper' },
  { key: 'id', label: 'CSS ID', type: 'text', default: '', group: '布局', nested: 'wrapper' },
];

// === Per-type config schemas ===

const TEXT_CONFIG: ConfigPropertyDef[] = [
  { key: 'default_value', label: '默认值', type: 'text', default: '' },
  { key: 'placeholder', label: '占位符', type: 'text', default: '' },
  { key: 'prepend', label: '前缀', type: 'text', default: '' },
  { key: 'append', label: '后缀', type: 'text', default: '' },
  { key: 'maxlength', label: '最大长度', type: 'text', default: '' },
];

const TEXTAREA_CONFIG: ConfigPropertyDef[] = [
  { key: 'default_value', label: '默认值', type: 'textarea', default: '' },
  { key: 'placeholder', label: '占位符', type: 'text', default: '' },
  { key: 'maxlength', label: '最大长度', type: 'text', default: '' },
  { key: 'new_lines', label: '换行处理', type: 'select', default: '', options: [
    { value: '', label: '无格式' },
    { value: 'wpautop', label: '自动段落' },
    { value: 'br', label: '自动换行 <br>' },
  ]},
  { key: 'rows', label: '行数', type: 'text', default: '' },
];

const NUMBER_CONFIG: ConfigPropertyDef[] = [
  { key: 'default_value', label: '默认值', type: 'text', default: '' },
  { key: 'placeholder', label: '占位符', type: 'text', default: '' },
  { key: 'prepend', label: '前缀', type: 'text', default: '' },
  { key: 'append', label: '后缀', type: 'text', default: '' },
  { key: 'min', label: '最小值', type: 'text', default: '' },
  { key: 'max', label: '最大值', type: 'text', default: '' },
  { key: 'step', label: '步长', type: 'text', default: '' },
];

const RANGE_CONFIG: ConfigPropertyDef[] = [
  { key: 'default_value', label: '默认值', type: 'text', default: '' },
  { key: 'prepend', label: '前缀', type: 'text', default: '' },
  { key: 'append', label: '后缀', type: 'text', default: '' },
  { key: 'min', label: '最小值', type: 'number', default: 0 },
  { key: 'max', label: '最大值', type: 'number', default: 100 },
  { key: 'step', label: '步长', type: 'number', default: 1 },
];

const EMAIL_CONFIG: ConfigPropertyDef[] = [
  { key: 'default_value', label: '默认值', type: 'text', default: '' },
  { key: 'placeholder', label: '占位符', type: 'text', default: '' },
  { key: 'prepend', label: '前缀', type: 'text', default: '' },
  { key: 'append', label: '后缀', type: 'text', default: '' },
  { key: 'maxlength', label: '最大长度', type: 'text', default: '' },
];

const URL_CONFIG: ConfigPropertyDef[] = [
  { key: 'default_value', label: '默认值', type: 'text', default: '' },
  { key: 'placeholder', label: '占位符', type: 'text', default: '' },
  { key: 'prepend', label: '前缀', type: 'text', default: '' },
  { key: 'append', label: '后缀', type: 'text', default: '' },
  { key: 'maxlength', label: '最大长度', type: 'text', default: '' },
];

const PASSWORD_CONFIG: ConfigPropertyDef[] = [
  { key: 'default_value', label: '默认值', type: 'text', default: '' },
  { key: 'placeholder', label: '占位符', type: 'text', default: '' },
  { key: 'prepend', label: '前缀', type: 'text', default: '' },
  { key: 'append', label: '后缀', type: 'text', default: '' },
  { key: 'maxlength', label: '最大长度', type: 'text', default: '' },
];

const IMAGE_CONFIG: ConfigPropertyDef[] = [
  { key: 'return_format', label: '返回格式', type: 'select', default: 'url', options: [
    { value: 'array', label: '数组' },
    { value: 'url', label: 'URL' },
    { value: 'id', label: 'ID' },
  ]},
  { key: 'preview_size', label: '预览大小', type: 'select', default: 'medium', options: [
    { value: 'thumbnail', label: '缩略图' },
    { value: 'medium', label: '中等' },
    { value: 'large', label: '大' },
    { value: 'full', label: '完整' },
  ]},
  { key: 'library', label: '媒体库', type: 'select', default: 'all', options: [
    { value: 'all', label: '全部' },
    { value: 'uploadedTo', label: '仅本文上传' },
  ]},
  { key: 'mime_types', label: 'MIME 类型', type: 'text', default: '' },
  { key: 'min_width', label: '最小宽度', type: 'number', default: 0, group: '限制' },
  { key: 'min_height', label: '最小高度', type: 'number', default: 0, group: '限制' },
  { key: 'min_size', label: '最小文件大小', type: 'number', default: 0, group: '限制' },
  { key: 'max_width', label: '最大宽度', type: 'number', default: 0, group: '限制' },
  { key: 'max_height', label: '最大高度', type: 'number', default: 0, group: '限制' },
  { key: 'max_size', label: '最大文件大小', type: 'number', default: 0, group: '限制' },
];

const FILE_CONFIG: ConfigPropertyDef[] = [
  { key: 'return_format', label: '返回格式', type: 'select', default: 'url', options: [
    { value: 'array', label: '数组' },
    { value: 'url', label: 'URL' },
    { value: 'id', label: 'ID' },
  ]},
  { key: 'library', label: '媒体库', type: 'select', default: 'all', options: [
    { value: 'all', label: '全部' },
    { value: 'uploadedTo', label: '仅本文上传' },
  ]},
  { key: 'mime_types', label: 'MIME 类型', type: 'text', default: '' },
  { key: 'min_size', label: '最小文件大小', type: 'number', default: 0 },
  { key: 'max_size', label: '最大文件大小', type: 'number', default: 0 },
];

const WYSIWYG_CONFIG: ConfigPropertyDef[] = [
  { key: 'default_value', label: '默认值', type: 'textarea', default: '' },
  { key: 'tabs', label: '标签页', type: 'select', default: 'all', options: [
    { value: 'all', label: '全部' },
    { value: 'visual', label: '可视化' },
    { value: 'text', label: '文本' },
  ]},
  { key: 'toolbar', label: '工具栏', type: 'select', default: 'full', options: [
    { value: 'full', label: '完整' },
    { value: 'basic', label: '基础' },
  ]},
  { key: 'media_upload', label: '媒体上传', type: 'toggle', default: 1 },
  { key: 'delay', label: '延迟初始化', type: 'toggle', default: 0 },
];

const OEMBED_CONFIG: ConfigPropertyDef[] = [
  { key: 'width', label: '宽度', type: 'text', default: '' },
  { key: 'height', label: '高度', type: 'text', default: '' },
];

const GALLERY_CONFIG: ConfigPropertyDef[] = [
  { key: 'return_format', label: '返回格式', type: 'select', default: 'array', options: [
    { value: 'array', label: '数组' },
    { value: 'url', label: 'URL' },
    { value: 'id', label: 'ID' },
  ]},
  { key: 'preview_size', label: '预览大小', type: 'select', default: 'medium', options: [
    { value: 'thumbnail', label: '缩略图' },
    { value: 'medium', label: '中等' },
    { value: 'large', label: '大' },
    { value: 'full', label: '完整' },
  ]},
  { key: 'library', label: '媒体库', type: 'select', default: 'all', options: [
    { value: 'all', label: '全部' },
    { value: 'uploadedTo', label: '仅本文上传' },
  ]},
  { key: 'mime_types', label: 'MIME 类型', type: 'text', default: '' },
  { key: 'min', label: '最少数量', type: 'number', default: 0 },
  { key: 'max', label: '最多数量', type: 'number', default: 0 },
  { key: 'insert', label: '插入位置', type: 'select', default: 'append', options: [
    { value: 'append', label: '末尾' },
    { value: 'prepend', label: '开头' },
  ]},
  { key: 'min_width', label: '最小宽度', type: 'number', default: 0, group: '限制' },
  { key: 'min_height', label: '最小高度', type: 'number', default: 0, group: '限制' },
  { key: 'min_size', label: '最小文件大小', type: 'number', default: 0, group: '限制' },
  { key: 'max_width', label: '最大宽度', type: 'number', default: 0, group: '限制' },
  { key: 'max_height', label: '最大高度', type: 'number', default: 0, group: '限制' },
  { key: 'max_size', label: '最大文件大小', type: 'number', default: 0, group: '限制' },
];

const SELECT_CONFIG: ConfigPropertyDef[] = [
  { key: 'choices', label: '选项', type: 'text', default: [] }, // rendered by ChoicesEditor
  { key: 'default_value', label: '默认值', type: 'text', default: '' },
  { key: 'placeholder', label: '占位符', type: 'text', default: '' },
  { key: 'allow_null', label: '允许空值', type: 'toggle', default: 0 },
  { key: 'multiple', label: '多选', type: 'toggle', default: 0 },
  { key: 'ui', label: '增强 UI', type: 'toggle', default: 0 },
  { key: 'ajax', label: 'AJAX 加载', type: 'toggle', default: 0 },
  { key: 'return_format', label: '返回格式', type: 'select', default: 'value', options: [
    { value: 'value', label: '值' },
    { value: 'label', label: '标签' },
    { value: 'array', label: '值+标签' },
  ]},
];

const CHECKBOX_CONFIG: ConfigPropertyDef[] = [
  { key: 'choices', label: '选项', type: 'text', default: [] },
  { key: 'default_value', label: '默认值', type: 'text', default: '' },
  { key: 'allow_custom', label: '允许自定义', type: 'toggle', default: 0 },
  { key: 'save_custom', label: '保存自定义', type: 'toggle', default: 0 },
  { key: 'toggle', label: '全选开关', type: 'toggle', default: 0 },
  { key: 'return_format', label: '返回格式', type: 'select', default: 'value', options: [
    { value: 'value', label: '值' },
    { value: 'label', label: '标签' },
    { value: 'array', label: '值+标签' },
  ]},
  { key: 'layout', label: '布局', type: 'select', default: 'vertical', options: [
    { value: 'vertical', label: '垂直' },
    { value: 'horizontal', label: '水平' },
  ]},
];

const RADIO_CONFIG: ConfigPropertyDef[] = [
  { key: 'choices', label: '选项', type: 'text', default: [] },
  { key: 'default_value', label: '默认值', type: 'text', default: '' },
  { key: 'allow_null', label: '允许空值', type: 'toggle', default: 0 },
  { key: 'other_choice', label: '其他选项', type: 'toggle', default: 0 },
  { key: 'save_other_choice', label: '保存其他选项', type: 'toggle', default: 0 },
  { key: 'return_format', label: '返回格式', type: 'select', default: 'value', options: [
    { value: 'value', label: '值' },
    { value: 'label', label: '标签' },
    { value: 'array', label: '值+标签' },
  ]},
  { key: 'layout', label: '布局', type: 'select', default: 'vertical', options: [
    { value: 'vertical', label: '垂直' },
    { value: 'horizontal', label: '水平' },
  ]},
];

const TRUE_FALSE_CONFIG: ConfigPropertyDef[] = [
  { key: 'default_value', label: '默认值', type: 'toggle', default: 0 },
  { key: 'ui', label: '增强 UI', type: 'toggle', default: 0 },
  { key: 'ui_on_text', label: '开启文本', type: 'text', default: '' },
  { key: 'ui_off_text', label: '关闭文本', type: 'text', default: '' },
];

const DATE_PICKER_CONFIG: ConfigPropertyDef[] = [
  { key: 'display_format', label: '显示格式', type: 'text', default: 'Y/m/d' },
  { key: 'return_format', label: '返回格式', type: 'text', default: 'Y-m-d' },
  { key: 'first_day', label: '每周起始日', type: 'select', default: 1, options: [
    { value: 0, label: '周日' },
    { value: 1, label: '周一' },
  ]},
];

const DATE_TIME_PICKER_CONFIG: ConfigPropertyDef[] = [
  { key: 'display_format', label: '显示格式', type: 'text', default: 'Y/m/d H:i' },
  { key: 'return_format', label: '返回格式', type: 'text', default: 'Y-m-d H:i:s' },
  { key: 'first_day', label: '每周起始日', type: 'select', default: 1, options: [
    { value: 0, label: '周日' },
    { value: 1, label: '周一' },
  ]},
];

const TIME_PICKER_CONFIG: ConfigPropertyDef[] = [
  { key: 'display_format', label: '显示格式', type: 'text', default: 'H:i' },
  { key: 'return_format', label: '返回格式', type: 'text', default: 'H:i:s' },
];

const COLOR_PICKER_CONFIG: ConfigPropertyDef[] = [
  { key: 'default_value', label: '默认值', type: 'text', default: '' },
  { key: 'enable_opacity', label: '启用透明度', type: 'toggle', default: 0 },
  { key: 'return_format', label: '返回格式', type: 'select', default: 'string', options: [
    { value: 'string', label: '字符串' },
    { value: 'array', label: '数组' },
  ]},
];

const PAGE_LINK_CONFIG: ConfigPropertyDef[] = [
  { key: 'post_type', label: '文章类型', type: 'text', default: [] },
  { key: 'allow_null', label: '允许空值', type: 'toggle', default: 0 },
  { key: 'multiple', label: '多选', type: 'toggle', default: 0 },
  { key: 'allow_archives', label: '允许归档', type: 'toggle', default: 1 },
];

const GOOGLE_MAP_CONFIG: ConfigPropertyDef[] = [
  { key: 'center_lat', label: '中心纬度', type: 'text', default: '' },
  { key: 'center_lng', label: '中心经度', type: 'text', default: '' },
  { key: 'zoom', label: '缩放级别', type: 'text', default: '' },
  { key: 'height', label: '高度', type: 'text', default: '' },
];

const USER_CONFIG: ConfigPropertyDef[] = [
  { key: 'role', label: '角色', type: 'text', default: [] },
  { key: 'return_format', label: '返回格式', type: 'select', default: 'array', options: [
    { value: 'array', label: '数组' },
    { value: 'object', label: '对象' },
    { value: 'id', label: 'ID' },
  ]},
  { key: 'multiple', label: '多选', type: 'toggle', default: 0 },
  { key: 'allow_null', label: '允许空值', type: 'toggle', default: 0 },
];

const REPEATER_CONFIG: ConfigPropertyDef[] = [
  { key: 'min', label: '最少行数', type: 'number', default: 0 },
  { key: 'max', label: '最多行数', type: 'number', default: 0 },
  { key: 'layout', label: '布局', type: 'select', default: 'table', options: [
    { value: 'table', label: '表格' },
    { value: 'block', label: '区块' },
    { value: 'row', label: '行' },
  ]},
  { key: 'button_label', label: '按钮文本', type: 'text', default: '' },
  { key: 'collapsed', label: '折叠字段', type: 'text', default: '' },
  { key: 'rows_per_page', label: '每页行数', type: 'number', default: 20 },
];

const POST_OBJECT_CONFIG: ConfigPropertyDef[] = [
  { key: 'return_format', label: '返回格式', type: 'select', default: 'object', options: [
    { value: 'object', label: '对象' },
    { value: 'id', label: 'ID' },
  ]},
  { key: 'allow_null', label: '允许空值', type: 'toggle', default: 0 },
  { key: 'multiple', label: '多选', type: 'toggle', default: 0 },
];

const RELATIONSHIP_CONFIG: ConfigPropertyDef[] = [
  { key: 'return_format', label: '返回格式', type: 'select', default: 'object', options: [
    { value: 'object', label: '对象' },
    { value: 'id', label: 'ID' },
  ]},
  { key: 'min', label: '最少数量', type: 'number', default: 0 },
  { key: 'max', label: '最多数量', type: 'number', default: 0 },
  { key: 'filters', label: '筛选器', type: 'text', default: ['search', 'post_type', 'taxonomy'] },
  { key: 'elements', label: '元素', type: 'text', default: '' },
  { key: 'allow_null', label: '允许空值', type: 'toggle', default: 0 },
];

const TAXONOMY_REF_CONFIG: ConfigPropertyDef[] = [
  { key: 'return_format', label: '返回格式', type: 'select', default: 'id', options: [
    { value: 'id', label: 'ID' },
    { value: 'object', label: '对象' },
  ]},
  { key: 'field_type', label: '字段类型', type: 'select', default: 'checkbox', options: [
    { value: 'checkbox', label: '复选框' },
    { value: 'multi_select', label: '多选' },
    { value: 'radio', label: '单选' },
    { value: 'select', label: '选择' },
  ]},
  { key: 'allow_null', label: '允许空值', type: 'toggle', default: 0 },
  { key: 'add_term', label: '允许新增', type: 'toggle', default: 1 },
  { key: 'save_terms', label: '保存分类', type: 'toggle', default: 0 },
  { key: 'load_terms', label: '加载分类', type: 'toggle', default: 0 },
  { key: 'multiple', label: '多选', type: 'toggle', default: 0 },
];

// === Type → schema mapping ===

const ATOM_TYPE_CONFIG: Record<string, ConfigPropertyDef[]> = {
  text: TEXT_CONFIG,
  textarea: TEXTAREA_CONFIG,
  number: NUMBER_CONFIG,
  range: RANGE_CONFIG,
  email: EMAIL_CONFIG,
  url: URL_CONFIG,
  password: PASSWORD_CONFIG,
  image: IMAGE_CONFIG,
  file: FILE_CONFIG,
  wysiwyg: WYSIWYG_CONFIG,
  oembed: OEMBED_CONFIG,
  gallery: GALLERY_CONFIG,
  select: SELECT_CONFIG,
  checkbox: CHECKBOX_CONFIG,
  radio: RADIO_CONFIG,
  true_false: TRUE_FALSE_CONFIG,
  date_picker: DATE_PICKER_CONFIG,
  date_time_picker: DATE_TIME_PICKER_CONFIG,
  time_picker: TIME_PICKER_CONFIG,
  color_picker: COLOR_PICKER_CONFIG,
  page_link: PAGE_LINK_CONFIG,
  google_map: GOOGLE_MAP_CONFIG,
  user: USER_CONFIG,
};

// === Field Group config schema ===

export const FIELD_GROUP_SCHEMA: ConfigPropertyDef[] = [
  { key: 'position', label: '位置', type: 'select', default: 'normal', options: [
    { value: 'normal', label: '正常 (内容下方)' },
    { value: 'acf_after_title', label: '标题后' },
    { value: 'side', label: '侧栏' },
  ]},
  { key: 'style', label: '样式', type: 'select', default: 'default', options: [
    { value: 'default', label: '默认' },
    { value: 'seamless', label: '无缝' },
  ]},
  { key: 'label_placement', label: '标签位置', type: 'select', default: 'top', options: [
    { value: 'top', label: '上方' },
    { value: 'left', label: '左侧' },
  ]},
  { key: 'instruction_placement', label: '说明位置', type: 'select', default: 'label', options: [
    { value: 'label', label: '标签下方' },
    { value: 'field', label: '字段下方' },
  ]},
  { key: 'description', label: '描述', type: 'textarea', default: '' },
  { key: 'show_in_rest', label: 'REST API', type: 'toggle', default: 0 },
];

export const HIDE_ON_SCREEN_OPTIONS = [
  { value: 'permalink', label: '固定链接' },
  { value: 'the_content', label: '内容编辑器' },
  { value: 'excerpt', label: '摘要' },
  { value: 'custom_fields', label: '自定义字段' },
  { value: 'discussion', label: '讨论' },
  { value: 'comments', label: '评论' },
  { value: 'slug', label: '别名' },
  { value: 'author', label: '作者' },
  { value: 'format', label: '格式' },
  { value: 'featured_image', label: '特色图片' },
  { value: 'categories', label: '分类目录' },
  { value: 'tags', label: '标签' },
  { value: 'send-trackbacks', label: 'Trackbacks' },
];

// === Public API ===

export function getSchemaForField(field: { type: FieldType }): ConfigPropertyDef[] {
  const ft = field.type;
  let typeSpecific: ConfigPropertyDef[] = [];

  switch (ft.kind) {
    case 'atom':
      typeSpecific = ATOM_TYPE_CONFIG[ft.subtype] ?? [];
      break;
    case 'repeat':
      typeSpecific = REPEATER_CONFIG;
      break;
    case 'ref':
      switch (ft.cardinality) {
        case '1': typeSpecific = POST_OBJECT_CONFIG; break;
        case 'n': typeSpecific = RELATIONSHIP_CONFIG; break;
        case 'taxonomy': typeSpecific = TAXONOMY_REF_CONFIG; break;
      }
      break;
  }

  return [...UNIVERSAL_CONFIG, ...typeSpecific];
}

export function getDefaultConfig(field: { type: FieldType }): Record<string, unknown> {
  const schema = getSchemaForField(field);
  const config: Record<string, unknown> = {
    wrapper: { width: '', class: '', id: '' },
  };
  for (const prop of schema) {
    if (prop.nested) {
      // nested props are initialized by the parent object above
      if (!config[prop.nested]) config[prop.nested] = {};
      (config[prop.nested] as Record<string, unknown>)[prop.key] = prop.default;
    } else {
      config[prop.key] = prop.default;
    }
  }
  return config;
}

export function getDefaultGroupConfig(): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  for (const prop of FIELD_GROUP_SCHEMA) {
    config[prop.key] = prop.default;
  }
  config.hide_on_screen = [];
  return config;
}

/** Helper: set a config value respecting nested paths */
export function setConfigValue(
  config: Record<string, unknown>,
  propDef: ConfigPropertyDef,
  value: unknown,
): Record<string, unknown> {
  const next = { ...config };
  if (propDef.nested) {
    const parent = { ...(next[propDef.nested] as Record<string, unknown> ?? {}) };
    parent[propDef.key] = value;
    next[propDef.nested] = parent;
  } else {
    next[propDef.key] = value;
  }
  return next;
}
