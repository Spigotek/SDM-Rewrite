/**
 * Cross-tab synchronization channel for SPA session events (tenant switch, logout).
 *
 * Per auth-flow.md §2.6: portal/workspace tabs must coordinate session state so a
 * tenant switch or logout in one tab propagates to all others without polling /me.
 * Uses BroadcastChannel where available, falls back to localStorage `storage`
 * event for Safari iOS < 15.4 (auth-flow.md §0 open dependency).
 */

export type CrossTabMessage =
  | { type: "tenant-changed"; tenantId: string; ts: number; sourceTabId: string }
  | { type: "logout"; ts: number; sourceTabId: string };

export interface CrossTabChannel {
  post(msg: CrossTabMessage): void;
  subscribe(handler: (msg: CrossTabMessage) => void): () => void;
  close(): void;
}

export interface CrossTabChannelOptions {
  readonly channelName?: string;
}

const DEFAULT_CHANNEL_NAME = "sdm-session";
const STORAGE_KEY_PREFIX = "sdm-cross-tab:";

const generateTabId = (): string =>
  typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `tab-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const isCrossTabMessage = (value: unknown): value is CrossTabMessage => {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  if (typeof m["sourceTabId"] !== "string" || typeof m["ts"] !== "number") return false;
  if (m["type"] === "logout") return true;
  if (m["type"] === "tenant-changed" && typeof m["tenantId"] === "string") return true;
  return false;
};

/**
 * Creates a cross-tab broadcast channel. Prefers the BroadcastChannel API and
 * transparently falls back to a localStorage write + `storage` event when the
 * API is missing. Self-echo is filtered via a per-instance tab id so a tab
 * never receives its own messages on either transport.
 */
export const createCrossTabChannel = (opts: CrossTabChannelOptions = {}): CrossTabChannel => {
  const channelName = opts.channelName ?? DEFAULT_CHANNEL_NAME;
  const sourceTabId = generateTabId();
  const handlers = new Set<(msg: CrossTabMessage) => void>();

  const dispatch = (msg: CrossTabMessage): void => {
    if (msg.sourceTabId === sourceTabId) return;
    for (const handler of handlers) {
      try {
        handler(msg);
      } catch (err) {
        console.warn("[cross-tab] handler threw", err);
      }
    }
  };

  const bcCtor: typeof BroadcastChannel | undefined =
    typeof BroadcastChannel === "undefined" ? undefined : BroadcastChannel;

  if (bcCtor !== undefined) {
    let bc: BroadcastChannel | null;
    try {
      bc = new bcCtor(channelName);
    } catch (err) {
      console.warn("[cross-tab] BroadcastChannel construction failed, falling back", err);
      bc = null;
    }

    if (bc !== null) {
      const onMessage = (ev: MessageEvent): void => {
        if (isCrossTabMessage(ev.data)) dispatch(ev.data);
      };
      bc.addEventListener("message", onMessage);

      return {
        post(msg: CrossTabMessage): void {
          try {
            bc.postMessage({ ...msg, sourceTabId });
          } catch (err) {
            console.warn("[cross-tab] postMessage failed", err);
          }
        },
        subscribe(handler: (msg: CrossTabMessage) => void): () => void {
          handlers.add(handler);
          return () => {
            handlers.delete(handler);
          };
        },
        close(): void {
          handlers.clear();
          try {
            bc.removeEventListener("message", onMessage);
            bc.close();
          } catch (err) {
            console.warn("[cross-tab] close failed", err);
          }
        },
      };
    }
  }

  const storageKey = `${STORAGE_KEY_PREFIX}${channelName}`;
  const onStorage = (ev: StorageEvent): void => {
    if (ev.key !== storageKey || ev.newValue === null) return;
    try {
      const parsed: unknown = JSON.parse(ev.newValue);
      if (isCrossTabMessage(parsed)) dispatch(parsed);
    } catch (err) {
      console.warn("[cross-tab] storage parse failed", err);
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }

  return {
    post(msg: CrossTabMessage): void {
      try {
        const payload = JSON.stringify({ ...msg, sourceTabId, _w: Date.now() });
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(storageKey, payload);
        }
      } catch (err) {
        console.warn("[cross-tab] storage write failed", err);
      }
    },
    subscribe(handler: (msg: CrossTabMessage) => void): () => void {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
    close(): void {
      handlers.clear();
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", onStorage);
      }
    },
  };
};
