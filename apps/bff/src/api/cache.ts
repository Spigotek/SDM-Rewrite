/**
 * Tiny in-memory TTL cache for the reference-data proxy.
 *
 * Single-instance MVP — same scope as F.1's in-memory session store
 * (cross-chunk D2: Redis is post-MVP). A native Map + monotonic timestamp is
 * enough for the only consumer (reference factories with a 15-minute TTL).
 * Switching to LRU + multi-instance backing comes with the same horizontal-
 * scaling chunk that introduces Redis sessions.
 */

export interface CacheEntry<T> {
  readonly value: T;
  readonly expiresAtMs: number;
}

export interface NowFn {
  (): number;
}

export class TtlCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly now: NowFn;
  private readonly maxEntries: number;

  constructor(opts?: { now?: NowFn; maxEntries?: number }) {
    this.now = opts?.now ?? (() => Date.now());
    this.maxEntries = opts?.maxEntries ?? 256;
  }

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (this.now() >= entry.expiresAtMs) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlSec: number): void {
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expiresAtMs: this.now() + ttlSec * 1000 });
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}
