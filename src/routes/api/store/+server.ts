import type { RequestHandler } from './$types';
import type { StoreState } from '$lib/types';

// Module-level pending state (dev server 重启清零)
let pendingState: StoreState | null = null;

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

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    pendingState = validateStoreState(body);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }
};

export const GET: RequestHandler = async () => {
  if (!pendingState) {
    return new Response(JSON.stringify(null), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const state = pendingState;
  pendingState = null; // one-shot 消费
  return new Response(JSON.stringify(state), {
    headers: { 'Content-Type': 'application/json' },
  });
};
