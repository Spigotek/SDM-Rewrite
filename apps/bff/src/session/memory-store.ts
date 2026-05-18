import type { SessionPayload, SessionStore } from "./types";

interface Entry {
  payload: SessionPayload;
  timer: NodeJS.Timeout;
}

export class MemorySessionStore implements SessionStore {
  private readonly entries = new Map<string, Entry>();

  async create(id: string, payload: SessionPayload, ttlSec: number): Promise<void> {
    const existing = this.entries.get(id);
    if (existing) {
      clearTimeout(existing.timer);
    }
    const timer = setTimeout(() => {
      void this.destroy(id);
    }, ttlSec * 1000);
    timer.unref();
    this.entries.set(id, { payload, timer });
  }

  async get(id: string): Promise<SessionPayload | null> {
    const entry = this.entries.get(id);
    if (!entry) return null;
    return { ...entry.payload };
  }

  async touch(id: string, lastSeenAt: number): Promise<void> {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.payload.lastSeenAt = lastSeenAt;
  }

  async update(
    id: string,
    partial: Partial<Omit<SessionPayload, "sid" | "createdAt" | "absoluteExpiresAt">>,
  ): Promise<void> {
    const entry = this.entries.get(id);
    if (!entry) return;
    Object.assign(entry.payload, partial);
  }

  async destroy(id: string): Promise<void> {
    const entry = this.entries.get(id);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.entries.delete(id);
  }

  async close(): Promise<void> {
    for (const entry of this.entries.values()) {
      clearTimeout(entry.timer);
    }
    this.entries.clear();
  }
}
