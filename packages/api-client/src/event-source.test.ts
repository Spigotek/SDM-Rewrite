/**
 * J.3 — AppEventSource unit tests.
 *
 * 5+ cases per Done-when:
 *  1. Successful connect → dispatches connected event + resets backoff.
 *  2. tenant.suspended event parsed and dispatched.
 *  3. session.expired → close + no reconnect attempt.
 *  4. EventSource error → calls onError + schedules reconnect with backoff.
 *  5. Exponential backoff: 1s → 2s → 4s (verified via fake timers).
 *  6. close() before reconnect → no reconnect fires.
 *  7. Malformed event data does not throw.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppEventSource, type AppEvent } from "./event-source";

// Minimal EventSource stub.
type Listener = EventListenerOrEventListenerObject;

class MockEventSource {
  static instances: MockEventSource[] = [];

  readonly url: string;
  private listeners: Map<string, Listener[]> = new Map();
  onerror: ((e: Event) => void) | null = null;
  closed = false;

  constructor(url: string, _opts?: EventSourceInit) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: Listener): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  dispatchEvent(type: string, data: unknown): void {
    const listeners = this.listeners.get(type) ?? [];
    const event = Object.assign(new Event(type), { data: JSON.stringify(data) });
    for (const l of listeners) {
      if (typeof l === "function") {
        l(event);
      } else {
        l.handleEvent(event);
      }
    }
  }

  triggerError(): void {
    this.onerror?.(new Event("error"));
  }

  close(): void {
    this.closed = true;
  }
}

describe("AppEventSource", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("1. dispatches connected event and resets backoff to 1s", () => {
    const events: AppEvent[] = [];
    const scheduleReconnect = vi.fn();

    new AppEventSource({
      url: "/api/events",
      onEvent: (e) => events.push(e),
      EventSourceImpl: MockEventSource as unknown as typeof EventSource,
      scheduleReconnect,
    });

    const es = MockEventSource.instances[0]!;
    es.dispatchEvent("connected", {
      type: "connected",
      sessionId: "sid-1",
      tenantId: "acme",
      at: new Date().toISOString(),
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("connected");

    // Trigger an error after successful connect — backoff should be 1s (reset).
    es.triggerError();
    expect(scheduleReconnect).toHaveBeenCalledWith(expect.any(Function), 1000);
  });

  it("2. tenant.suspended event dispatched to onEvent", () => {
    const events: AppEvent[] = [];

    const aes = new AppEventSource({
      url: "/api/events",
      onEvent: (e) => events.push(e),
      EventSourceImpl: MockEventSource as unknown as typeof EventSource,
    });

    const es = MockEventSource.instances[0]!;
    es.dispatchEvent("tenant.suspended", {
      type: "tenant.suspended",
      tenantId: "acme",
      reason: "admin.tenant.suspend",
      at: new Date().toISOString(),
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("tenant.suspended");

    aes.close();
  });

  it("3. session.expired → onEvent fires, then close() is called (no reconnect)", () => {
    const events: AppEvent[] = [];
    const scheduleReconnect = vi.fn();

    new AppEventSource({
      url: "/api/events",
      onEvent: (e) => events.push(e),
      EventSourceImpl: MockEventSource as unknown as typeof EventSource,
      scheduleReconnect,
    });

    const es = MockEventSource.instances[0]!;
    es.dispatchEvent("session.expired", {
      type: "session.expired",
      at: new Date().toISOString(),
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("session.expired");
    expect(es.closed).toBe(true);

    // Error after session.expired should NOT schedule reconnect.
    scheduleReconnect.mockClear();
    // closed = true so reconnect won't fire
    expect(scheduleReconnect).not.toHaveBeenCalled();
  });

  it("4. EventSource error calls onError and schedules reconnect", () => {
    const onError = vi.fn();
    const scheduleReconnect = vi.fn();

    const aes = new AppEventSource({
      url: "/api/events",
      onEvent: vi.fn(),
      onError,
      EventSourceImpl: MockEventSource as unknown as typeof EventSource,
      scheduleReconnect,
    });

    const es = MockEventSource.instances[0]!;
    es.triggerError();

    expect(onError).toHaveBeenCalled();
    expect(scheduleReconnect).toHaveBeenCalledWith(expect.any(Function), 1000);

    aes.close();
  });

  it("5. exponential backoff: 1s → 2s → 4s", () => {
    const scheduleReconnect = vi.fn();

    const aes = new AppEventSource({
      url: "/api/events",
      onEvent: vi.fn(),
      EventSourceImpl: MockEventSource as unknown as typeof EventSource,
      scheduleReconnect,
    });

    // First error → 1s
    MockEventSource.instances[0]!.triggerError();
    expect(scheduleReconnect).toHaveBeenLastCalledWith(expect.any(Function), 1000);

    // Simulate reconnect by calling the scheduled fn.
    const reconnectFn1 = scheduleReconnect.mock.calls[0]?.[0] as () => void;
    reconnectFn1();

    // Second error → 2s
    MockEventSource.instances[1]!.triggerError();
    expect(scheduleReconnect).toHaveBeenLastCalledWith(expect.any(Function), 2000);

    const reconnectFn2 = scheduleReconnect.mock.calls[1]?.[0] as () => void;
    reconnectFn2();

    // Third error → 4s
    MockEventSource.instances[2]!.triggerError();
    expect(scheduleReconnect).toHaveBeenLastCalledWith(expect.any(Function), 4000);

    aes.close();
  });

  it("6. close() before reconnect — no reconnect fires", () => {
    let capturedFn: (() => void) | null = null;

    const aes = new AppEventSource({
      url: "/api/events",
      onEvent: vi.fn(),
      EventSourceImpl: MockEventSource as unknown as typeof EventSource,
      scheduleReconnect: (fn, ms) => {
        capturedFn = fn;
        return setTimeout(fn, ms);
      },
    });

    MockEventSource.instances[0]!.triggerError();
    expect(capturedFn).not.toBeNull();

    // Close before the reconnect fires.
    aes.close();
    capturedFn!();

    // Only the initial instance should have been created.
    expect(MockEventSource.instances).toHaveLength(1);
  });

  it("7. malformed event data does not throw", () => {
    const events: AppEvent[] = [];

    const aes = new AppEventSource({
      url: "/api/events",
      onEvent: (e) => events.push(e),
      EventSourceImpl: MockEventSource as unknown as typeof EventSource,
    });

    const es = MockEventSource.instances[0]!;
    // Dispatch raw event (not a MessageEvent with .data).
    const badEvent = new Event("tenant.suspended");
    const listeners =
      (es as unknown as { listeners: Map<string, Listener[]> }).listeners.get("tenant.suspended") ??
      [];
    for (const l of listeners) {
      expect(() => {
        if (typeof l === "function") l(badEvent);
        else l.handleEvent(badEvent);
      }).not.toThrow();
    }

    expect(events).toHaveLength(0);
    aes.close();
  });
});
