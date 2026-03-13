export const REORDER_MIME = 'application/acf-field-reorder';

export function isReorderDrag(e: DragEvent): boolean {
  return e.dataTransfer?.types.includes(REORDER_MIME) ?? false;
}

/**
 * 计算 moveField 所需的 toIndex（移除 fromIndex 后的插入位置）。
 * 返回 -1 表示无需移动。
 */
export function computeMoveIndex(
  fromIndex: number, targetIndex: number,
  position: 'above' | 'below', totalFields: number
): number {
  if (fromIndex < 0 || targetIndex < 0) return -1;
  if (fromIndex >= totalFields || targetIndex >= totalFields) return -1;
  let insertBefore = position === 'above' ? targetIndex : targetIndex + 1;
  if (fromIndex < insertBefore) insertBefore--;
  const toIndex = Math.max(0, Math.min(totalFields - 1, insertBefore));
  if (toIndex === fromIndex) return -1;
  return toIndex;
}
