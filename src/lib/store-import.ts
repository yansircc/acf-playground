import type { StoreState } from './types';
import { isACFFormat, importACF } from './acf-import';

function validateStoreState(raw: unknown): StoreState {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid JSON');
  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.entities)) throw new Error('entities must be an array');
  if (typeof obj.data !== 'object' || obj.data === null) throw new Error('data must be an object');
  if (typeof obj.positions !== 'object' || obj.positions === null) throw new Error('positions must be an object');

  for (const entity of obj.entities) {
    if (!entity || typeof entity !== 'object') throw new Error('Each entity must be an object');
    const e = entity as Record<string, unknown>;
    if (typeof e.id !== 'string') throw new Error('Entity must have string id');
    if (typeof e.name !== 'string') throw new Error('Entity must have string name');
    if (!Array.isArray(e.fields)) throw new Error('Entity must have fields array');
  }

  return raw as StoreState;
}

export async function readStoreFile(file: File): Promise<StoreState> {
  const text = await file.text();
  const raw = JSON.parse(text);

  // Auto-detect ACF format vs Store format
  if (isACFFormat(raw)) {
    return importACF(raw);
  }

  return validateStoreState(raw);
}

export async function fetchPendingState(): Promise<StoreState | null> {
  try {
    const res = await fetch('/api/store');
    if (!res.ok) return null;
    const data = await res.json();
    if (!data) return null;
    return validateStoreState(data);
  } catch {
    return null;
  }
}
