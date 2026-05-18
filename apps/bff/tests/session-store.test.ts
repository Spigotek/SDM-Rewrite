import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contactId, roleId, tenantId, userId } from "@sdm/domain";
import { MemorySessionStore } from "../src/session/memory-store";
import type { SessionPayload } from "../src/session/types";

function buildPayload(overrides: Partial<SessionPayload> = {}): SessionPayload {
  const now = Date.now();
  const base: SessionPayload = {
    sid: "sid-abc",
    userId: userId("user-1"),
    contactId: contactId("contact-1"),
    displayName: "Jane Doe",
    email: "jane@example.com",
    activeTenantId: tenantId("tenant-1"),
    tenants: [
      {
        id: tenantId("tenant-1"),
        name: "Tenant One",
        roles: [{ id: roleId("role-1"), sym: "Analyst Level 1", uiRole: "agent_l1" }],
      },
    ],
    accessKey: "ak-1",
    accessKeyId: "ak-id-1",
    accessKeyExpiresAt: now + 60_000,
    createdAt: now,
    lastSeenAt: now,
    absoluteExpiresAt: now + 8 * 60 * 60 * 1000,
    cookieVersion: 1,
  };
  return { ...base, ...overrides };
}

describe("MemorySessionStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("create + get returns the payload", async () => {
    const store = new MemorySessionStore();
    const payload = buildPayload();
    await store.create("sid-1", payload, 60);
    const got = await store.get("sid-1");
    expect(got).not.toBeNull();
    expect(got?.userId).toBe(payload.userId);
    expect(got?.email).toBe("jane@example.com");
  });

  it("get returns a shallow clone, not the live reference", async () => {
    const store = new MemorySessionStore();
    await store.create("sid-1", buildPayload(), 60);
    const got = await store.get("sid-1");
    expect(got).not.toBeNull();
    if (!got) return;
    got.accessKey = "MUTATED";
    const got2 = await store.get("sid-1");
    expect(got2?.accessKey).toBe("ak-1");
  });

  it("get absent returns null", async () => {
    const store = new MemorySessionStore();
    expect(await store.get("missing")).toBeNull();
  });

  it("TTL expiry: entry is destroyed after ttlSec", async () => {
    const store = new MemorySessionStore();
    await store.create("sid-1", buildPayload(), 10);
    expect(await store.get("sid-1")).not.toBeNull();
    vi.advanceTimersByTime(10_000);
    expect(await store.get("sid-1")).toBeNull();
  });

  it("touch updates lastSeenAt without resetting TTL", async () => {
    const store = new MemorySessionStore();
    const payload = buildPayload({ lastSeenAt: 1000 });
    await store.create("sid-1", payload, 10);

    vi.advanceTimersByTime(5_000);
    await store.touch("sid-1", 6000);
    const mid = await store.get("sid-1");
    expect(mid?.lastSeenAt).toBe(6000);

    vi.advanceTimersByTime(5_000);
    expect(await store.get("sid-1")).toBeNull();
  });

  it("touch on absent id is a no-op", async () => {
    const store = new MemorySessionStore();
    await expect(store.touch("missing", 123)).resolves.toBeUndefined();
  });

  it("update merges partial fields", async () => {
    const store = new MemorySessionStore();
    await store.create("sid-1", buildPayload(), 60);
    await store.update("sid-1", {
      activeTenantId: tenantId("tenant-2"),
      cookieVersion: 2,
      accessKey: "ak-rotated",
    });
    const got = await store.get("sid-1");
    expect(got?.activeTenantId).toBe("tenant-2");
    expect(got?.cookieVersion).toBe(2);
    expect(got?.accessKey).toBe("ak-rotated");
    expect(got?.email).toBe("jane@example.com");
  });

  it("update on absent id is a no-op", async () => {
    const store = new MemorySessionStore();
    await expect(store.update("missing", { cookieVersion: 9 })).resolves.toBeUndefined();
    expect(await store.get("missing")).toBeNull();
  });

  it("create on existing id clears the previous timer", async () => {
    const store = new MemorySessionStore();
    await store.create("sid-1", buildPayload(), 10);
    await store.create("sid-1", buildPayload({ accessKey: "ak-2" }), 30);

    vi.advanceTimersByTime(10_000);
    const got = await store.get("sid-1");
    expect(got?.accessKey).toBe("ak-2");

    vi.advanceTimersByTime(20_000);
    expect(await store.get("sid-1")).toBeNull();
  });

  it("destroy removes the entry and clears its timer", async () => {
    const store = new MemorySessionStore();
    await store.create("sid-1", buildPayload(), 10);
    await store.destroy("sid-1");
    expect(await store.get("sid-1")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("close clears all entries and timers", async () => {
    const store = new MemorySessionStore();
    await store.create("sid-1", buildPayload(), 10);
    await store.create("sid-2", buildPayload({ sid: "sid-2" }), 10);
    await store.close();
    expect(await store.get("sid-1")).toBeNull();
    expect(await store.get("sid-2")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(20_000);
  });
});
