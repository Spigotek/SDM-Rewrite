/**
 * J.3 — Typed EventSource wrapper with exponential backoff reconnect.
 *
 * Backoff: 1 s, 2 s, 4 s, 8 s, ..., capped at 30 s. Reset to 1 s on
 * successful connect (i.e. when a `connected` event arrives).
 *
 * Terminal state: on `session.expired` event, close without reconnect.
 * Caller must re-login before opening a new connection.
 *
 * On `onerror`: silently fall back to I.3 next-API-call detection — no
 * toast, no retry storm. The natural browser EventSource retry is disabled
 * by setting `retry: 0` is not standard, so we close + reopen after backoff.
 *
 * EventSource's built-in auto-reconnect uses `retry:` field from the server.
 * We override it by explicitly closing on error and scheduling our own
 * timed reopen.
 */

export type AppEvent =
  | {
      readonly type: "connected";
      readonly sessionId: string;
      readonly tenantId: string | null;
      readonly at: string;
    }
  | {
      readonly type: "tenant.suspended";
      readonly tenantId: string;
      readonly reason: string;
      readonly at: string;
    }
  | { readonly type: "session.expired"; readonly at: string };

export interface AppEventSourceOptions {
  readonly url: string;
  readonly onEvent: (event: AppEvent) => void;
  readonly onError?: (err: Error) => void;
  /** Override for testing — replace global EventSource. */
  readonly EventSourceImpl?: typeof EventSource;
  /** Override clock for testing. */
  readonly now?: () => number;
  /** Override setTimeout for testing. */
  readonly scheduleReconnect?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
}

const BACKOFF_INITIAL_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;

export class AppEventSource {
  private readonly opts: AppEventSourceOptions;
  private es: EventSource | null = null;
  private backoffMs = BACKOFF_INITIAL_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  constructor(opts: AppEventSourceOptions) {
    this.opts = opts;
    this.connect();
  }

  private connect(): void {
    if (this.closed) return;

    const EventSourceCtor = this.opts.EventSourceImpl ?? EventSource;
    const es = new EventSourceCtor(this.opts.url, { withCredentials: true });
    this.es = es;

    es.addEventListener("connected", (e: Event) => {
      // Reset backoff on successful connection.
      this.backoffMs = BACKOFF_INITIAL_MS;
      const data = this.parseEventData(e);
      if (data && data.type === "connected") {
        this.opts.onEvent(data as AppEvent);
      }
    });

    es.addEventListener("tenant.suspended", (e: Event) => {
      const data = this.parseEventData(e);
      if (data && data.type === "tenant.suspended") {
        this.opts.onEvent(data as AppEvent);
      }
    });

    es.addEventListener("session.expired", (e: Event) => {
      const data = this.parseEventData(e);
      if (data && data.type === "session.expired") {
        this.opts.onEvent(data as AppEvent);
        // Terminal — close without reconnect.
        this.close();
      }
    });

    es.onerror = () => {
      // Close the broken connection and schedule a reconnect with backoff.
      es.close();
      this.es = null;
      if (this.closed) return;
      this.opts.onError?.(new Error("EventSource error"));
      this.scheduleReconnect();
    };
  }

  private parseEventData(e: Event): Record<string, unknown> | null {
    try {
      // Cast to MessageEvent-like — EventSource always fires MessageEvents but
      // some test stubs extend plain Event with a .data property.
      const data = (e as unknown as { data?: string }).data;
      if (typeof data !== "string") return null;
      return JSON.parse(data) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private scheduleReconnect(): void {
    if (this.closed) return;
    const delay = this.backoffMs;
    // Exponential backoff, capped at max.
    this.backoffMs = Math.min(this.backoffMs * 2, BACKOFF_MAX_MS);

    const schedule = this.opts.scheduleReconnect ?? setTimeout;
    this.reconnectTimer = schedule(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  close(): void {
    this.closed = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.es) {
      this.es.close();
      this.es = null;
    }
  }
}
