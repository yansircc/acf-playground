import type { StoreState } from './types';

const CHANNEL_NAME = 'acf-store';
const STORAGE_KEY = 'acf-store-state';

type Storelike = {
  serialize(): StoreState;
  hydrate(state: StoreState): void;
};

/**
 * 主窗口调用：监听 store 变化 → 广播 + 持久化
 */
export function startBroadcasting(store: Storelike): () => void {
  const channel = new BroadcastChannel(CHANNEL_NAME);

  const broadcast = () => {
    const state = store.serialize();
    channel.postMessage(state);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // localStorage 满了就忽略
    }
  };

  broadcast();
  return broadcast;
}

/**
 * 预览窗口调用：先从 localStorage 恢复初始状态，再监听实时广播
 */
export function startListening(store: Storelike): () => void {
  // 立即从 localStorage 恢复
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      store.hydrate(JSON.parse(saved));
    }
  } catch {
    // parse 失败就忽略
  }

  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (event: MessageEvent<StoreState>) => {
    store.hydrate(event.data);
  };

  return () => channel.close();
}
