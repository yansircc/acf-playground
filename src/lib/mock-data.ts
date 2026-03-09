import type { Entity, Field, EntityData } from './types';

// 中文词库
const NAMES = ['张伟', '李娜', '王芳', '刘洋', '陈明', '杨静', '赵磊', '黄丽', '周强', '吴秀英'];
const CITIES = ['深圳', '广州', '上海', '北京', '杭州', '成都', '武汉', '南京', '苏州', '东莞'];
const COMPANIES = ['华贸科技', '鑫达贸易', '瑞丰电子', '中联实业', '恒信国际', '诚远物流', '优品制造', '嘉和进出口'];
const PRODUCTS = ['多功能电动螺丝刀套装', '不锈钢保温杯', 'LED太阳能庭院灯', '蓝牙无线耳机', '便携式移动电源', '硅胶厨具五件套', '智能体重秤', '折叠式手推车'];
const DESCRIPTIONS = ['品质卓越，深受客户好评', '畅销欧美市场，年出口量持续增长', '采用优质原材料，通过CE认证', '性价比极高，适合批量采购'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randPrice(): string {
  return (randInt(10, 9999) + Math.random()).toFixed(2);
}

function generateAtomValue(
  fieldName: string,
  subtype: string,
  entityName: string,
  n: number
): unknown {
  const lowerName = fieldName.toLowerCase();

  switch (subtype) {
    case 'text': {
      if (lowerName.includes('名称') || lowerName.includes('name') || lowerName.includes('标题') || lowerName.includes('title')) {
        // 根据实体名猜测内容
        const lowerEntity = entityName.toLowerCase();
        if (lowerEntity.includes('产品') || lowerEntity.includes('product')) return pick(PRODUCTS);
        if (lowerEntity.includes('客户') || lowerEntity.includes('customer') || lowerEntity.includes('联系')) return pick(NAMES);
        if (lowerEntity.includes('公司') || lowerEntity.includes('company') || lowerEntity.includes('供应商')) return pick(COMPANIES);
        return `${entityName} #${n}`;
      }
      if (lowerName.includes('地区') || lowerName.includes('城市') || lowerName.includes('city') || lowerName.includes('region')) return pick(CITIES);
      if (lowerName.includes('公司') || lowerName.includes('company')) return pick(COMPANIES);
      if (lowerName.includes('人') || lowerName.includes('联系') || lowerName.includes('contact')) return pick(NAMES);
      return `${entityName} #${n}`;
    }
    case 'password':
      return '••••••';
    case 'number': {
      if (lowerName.includes('价格') || lowerName.includes('price') || lowerName.includes('金额') || lowerName.includes('amount')) {
        return randPrice();
      }
      return String(randInt(10, 9999));
    }
    case 'range':
      return String(randInt(0, 100));
    case 'email':
      return `user${n}@example.com`;
    case 'url':
    case 'oembed':
    case 'page_link':
    case 'link':
      return `https://example.com/${entityName.toLowerCase().replace(/\s+/g, '-')}/${n}`;
    case 'image':
    case 'file':
      return `https://picsum.photos/seed/${Math.random().toString(36).slice(2, 8)}/400/300`;
    case 'gallery':
      return [1, 2, 3].map(() => `https://picsum.photos/seed/${Math.random().toString(36).slice(2, 8)}/400/300`).join('\n');
    case 'textarea':
    case 'wysiwyg':
      return `${entityName}的${fieldName}：${pick(DESCRIPTIONS)}`;
    case 'select':
    case 'radio':
      return '';
    case 'checkbox':
      return [];
    case 'true_false':
      return Math.random() > 0.5;
    case 'date_picker':
      return `2026-${String(randInt(1, 12)).padStart(2, '0')}-${String(randInt(1, 28)).padStart(2, '0')}`;
    case 'date_time_picker':
      return `2026-${String(randInt(1, 12)).padStart(2, '0')}-${String(randInt(1, 28)).padStart(2, '0')}T${String(randInt(8, 18)).padStart(2, '0')}:${String(randInt(0, 59)).padStart(2, '0')}`;
    case 'time_picker':
      return `${String(randInt(8, 18)).padStart(2, '0')}:${String(randInt(0, 59)).padStart(2, '0')}`;
    case 'color_picker':
      return `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`;
    case 'google_map':
      return pick(CITIES);
    case 'user':
      return pick(NAMES);
    default:
      return '';
  }
}

function generateRefValue(
  field: Field,
  allData: Record<string, EntityData>
): unknown {
  if (field.type.kind !== 'ref') return '';
  const targetId = field.type.target;
  if (!targetId) return '';
  const targetRows = allData[targetId] ?? [];
  if (targetRows.length === 0) return field.type.cardinality === 'n' ? [] : '';

  if (field.type.cardinality === 'n') {
    // Pick 1-3 random indices
    const count = Math.min(randInt(1, 3), targetRows.length);
    const indices = Array.from({ length: targetRows.length }, (_, i) => i);
    // Shuffle and take count
    for (let i = indices.length - 1; i > 0; i--) {
      const j = randInt(0, i);
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices.slice(0, count).sort((a, b) => a - b);
  }

  // cardinality '1' or 'taxonomy'
  return randInt(0, targetRows.length - 1);
}

function generateFieldValue(
  field: Field,
  entityName: string,
  n: number,
  allData: Record<string, EntityData>
): unknown {
  const ft = field.type;

  if (ft.kind === 'atom') {
    return generateAtomValue(field.name, ft.subtype, entityName, n);
  }

  if (ft.kind === 'repeat') {
    // 生成 2 行子字段数据
    return [1, 2].map((ri) => {
      const row: Record<string, unknown> = {};
      for (const sf of ft.fields) {
        if (sf.type.kind === 'atom') {
          row[sf.id] = generateAtomValue(sf.name, sf.type.subtype, entityName, ri);
        } else if (sf.type.kind === 'ref') {
          row[sf.id] = generateRefValue(sf, allData);
        }
      }
      return row;
    });
  }

  if (ft.kind === 'ref') {
    return generateRefValue(field, allData);
  }

  return undefined;
}

export function generateMockRow(
  entity: Entity,
  existingRows: number,
  allData: Record<string, EntityData> = {}
): Record<string, unknown> {
  const n = existingRows + 1;
  const row: Record<string, unknown> = {};

  for (const field of entity.fields) {
    const val = generateFieldValue(field, entity.name, n, allData);
    if (val !== undefined) {
      row[field.id] = val;
    }
  }

  return row;
}
