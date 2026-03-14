import type { AtomSubtype, FieldType } from './types';

export type AtomOption = {
  value: AtomSubtype;
  label: string;
  icon: string;
  defaultFieldType: () => FieldType;
};

export type AtomGroup = {
  label: string;
  options: AtomOption[];
};

function atom(value: AtomSubtype, label: string, icon: string): AtomOption {
  return { value, label, icon, defaultFieldType: () => ({ kind: 'atom', subtype: value }) };
}

function atomWithChoices(value: AtomSubtype, label: string, icon: string, choices: string[]): AtomOption {
  return { value, label, icon, defaultFieldType: () => ({ kind: 'atom', subtype: value, choices: [...choices] }) };
}

export const ATOM_GROUPS: AtomGroup[] = [
  {
    label: '基础',
    options: [
      atom('text', '文本', 'Aa'),
      atom('textarea', '多行', '¶'),
      atom('number', '数字', '#'),
      atom('range', '范围', '↔'),
      atom('email', '邮箱', '@'),
      atom('url', '链接', '🔗'),
      atom('password', '密码', '🔒'),
    ],
  },
  {
    label: '内容',
    options: [
      atom('image', '图片', '🖼'),
      atom('file', '文件', '📎'),
      atom('wysiwyg', '编辑器', '📝'),
      atom('oembed', 'oEmbed', '▶'),
      atom('gallery', '图库', '🖼️'),
    ],
  },
  {
    label: '选择',
    options: [
      atomWithChoices('select', '选择', '▼', ['选项 1', '选项 2', '选项 3']),
      atomWithChoices('checkbox', '复选', '☑', ['选项 A', '选项 B', '选项 C']),
      atomWithChoices('radio', '单选', '⊙', ['选项 A', '选项 B', '选项 C']),
      atom('true_false', '是/否', '✓'),
    ],
  },
  {
    label: '其他',
    options: [
      atom('date_picker', '日期', '📅'),
      atom('date_time_picker', '日期时间', '📅'),
      atom('time_picker', '时间', '⏰'),
      atom('color_picker', '颜色', '🎨'),
      atom('page_link', '页面链接', '📄'),
      atom('google_map', '地图', '📍'),
      atom('user', '用户', '👤'),
    ],
  },
];

/** Flat list of all atom options */
export const ALL_ATOM_OPTIONS: AtomOption[] = ATOM_GROUPS.flatMap((g) => g.options);

/** Look up an atom option by subtype */
export function findAtomOption(subtype: AtomSubtype): AtomOption | undefined {
  return ALL_ATOM_OPTIONS.find((o) => o.value === subtype);
}
