import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CrossTabMessage } from "./cross-tab";
import { createCrossTabChannel } from "./cross-tab";

describe("createCrossTabChannel — BroadcastChannel transport", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("delivers a message from one tab to another", async () => {
    const a = createCrossTabChannel();
    const b = createCrossTabChannel();
    const received: CrossTabMessage[] = [];
    b.subscribe((msg) => received.push(msg));

    a.post({ type: "tenant-changed", tenantId: "t-1", ts: 100, sourceTabId: "src-a" });
    await new Promise((r) => setTimeout(r, 0));

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ type: "tenant-changed", tenantId: "t-1" });

    a.close();
    b.close();
  });

  it("filters self-echo via sourceTabId", async () => {
    const a = createCrossTabChannel();
    const b = createCrossTabChannel();
    const receivedA: CrossTabMessage[] = [];
    const receivedB: CrossTabMessage[] = [];
    a.subscribe((msg) => receivedA.push(msg));
    b.subscribe((msg) => receivedB.push(msg));

    a.post({ type: "logout", ts: 1, sourceTabId: "ignored" });
    await new Promise((r) => setTimeout(r, 0));

    expect(receivedA).toHaveLength(0);
    expect(receivedB).toHaveLength(1);

    a.close();
    b.close();
  });

  it("subscribe returns a working unsubscribe function", async () => {
    const a = createCrossTabChannel();
    const b = createCrossTabChannel();
    const received: CrossTabMessage[] = [];
    const unsubscribe = b.subscribe((msg) => received.push(msg));

    a.post({ type: "logout", ts: 1, sourceTabId: "x" });
    await new Promise((r) => setTimeout(r, 0));
    expect(received).toHaveLength(1);

    unsubscribe();
    a.post({ type: "logout", ts: 2, sourceTabId: "x" });
    await new Promise((r) => setTimeout(r, 0));
    expect(received).toHaveLength(1);

    a.close();
    b.close();
  });

  it("close detaches the channel", async () => {
    const a = createCrossTabChannel();
    const b = createCrossTabChannel();
    const received: CrossTabMessage[] = [];
    b.subscribe((msg) => received.push(msg));

    b.close();
    a.post({ type: "logout", ts: 1, sourceTabId: "x" });
    await new Promise((r) => setTimeout(r, 0));
    expect(received).toHaveLength(0);

    a.close();
  });
});

describe("createCrossTabChannel — localStorage fallback", () => {
  const originalBC = globalThis.BroadcastChannel;

  beforeEach(() => {
    localStorage.clear();
    // Remove BroadcastChannel to force fallback path.
    delete (globalThis as { BroadcastChannel?: typeof BroadcastChannel }).BroadcastChannel;
  });

  afterEach(() => {
    (globalThis as { BroadcastChannel: typeof BroadcastChannel }).BroadcastChannel = originalBC;
  });

  it("writes to localStorage on post and receives via storage event", async () => {
    const a = createCrossTabChannel({ channelName: "test-fb" });
    const b = createCrossTabChannel({ channelName: "test-fb" });
    const received: CrossTabMessage[] = [];
    b.subscribe((msg) => received.push(msg));

    const setSpy = vi.spyOn(Storage.prototype, "setItem");
    a.post({ type: "tenant-changed", tenantId: "t-9", ts: 42, sourceTabId: "other" });

    expect(setSpy).toHaveBeenCalledWith(
      "sdm-cross-tab:test-fb",
      expect.stringContaining('"tenantId":"t-9"'),
    );

    // Same-tab `storage` events are not fired by the browser, so simulate one.
    const newValue = JSON.stringify({
      type: "tenant-changed",
      tenantId: "t-9",
      ts: 42,
      sourceTabId: "other",
      _w: Date.now(),
    });
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "sdm-cross-tab:test-fb",
        newValue,
        storageArea: localStorage,
      }),
    );

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ type: "tenant-changed", tenantId: "t-9" });

    setSpy.mockRestore();
    a.close();
    b.close();
  });

  it("close removes the storage listener", () => {
    const b = createCrossTabChannel({ channelName: "test-fb-2" });
    const received: CrossTabMessage[] = [];
    b.subscribe((msg) => received.push(msg));

    b.close();

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "sdm-cross-tab:test-fb-2",
        newValue: JSON.stringify({
          type: "logout",
          ts: 1,
          sourceTabId: "other",
        }),
        storageArea: localStorage,
      }),
    );

    expect(received).toHaveLength(0);
  });
});
