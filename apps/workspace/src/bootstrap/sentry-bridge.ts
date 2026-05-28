/**
 * Lazy Sentry bridge — keeps `@sentry/react` out of the initial bundle.
 *
 * Initial render must not block on Sentry: the SDK chunk is ~41 KB gzip and
 * G.4 deferred the trade-off of moving it off the critical path. After H.0
 * wires React Router + TanStack Query the eager-load budget is exhausted, so
 * this bridge defers the entire Sentry graph behind a dynamic import
 * scheduled in `requestIdleCallback`.
 *
 * Trade-off (per G.4 §Open questions): errors thrown in the first ~50-200 ms
 * of the page are missed by Sentry, but covered by the top-level
 * `<ErrorBoundary>` fallback so the user still sees a useful screen.
 */

import { sanitizeSentryEvent } from "@sdm/api-client";
import type * as SentryReact from "@sentry/react";
import type { ObservabilityConfig } from "./config";

type SentryNamespace = typeof SentryReact;
type SentryUser = Parameters<SentryNamespace["setUser"]>[0];

let modulePromise: Promise<SentryNamespace> | null = null;
let initialised = false;
let initialiseStarted = false;

interface QueuedCall {
  readonly kind: "capture" | "setUser" | "setTag";
  readonly args: unknown[];
}

const queue: QueuedCall[] = [];

async function loadModule(): Promise<SentryNamespace> {
  if (!modulePromise) {
    modulePromise = import("@sentry/react");
  }
  return modulePromise;
}

export function isSentryReady(): boolean {
  return initialised;
}

export interface InitSentryOptions {
  readonly observability: ObservabilityConfig;
  readonly appVersion: string;
}

export function scheduleSentryInit(opts: InitSentryOptions): void {
  if (initialiseStarted) return;
  initialiseStarted = true;

  const run = async (): Promise<void> => {
    const dsn = opts.observability.sentryDsn;
    if (!dsn) return;

    const Sentry = await loadModule();
    Sentry.init({
      dsn,
      release: import.meta.env.VITE_GIT_SHA ?? opts.appVersion,
      environment: opts.observability.sentryEnvironment ?? import.meta.env.MODE,
      integrations: [Sentry.browserTracingIntegration()],
      tracesSampleRate: opts.observability.sentrySampleRate ?? 0.1,
      beforeSend(event) {
        return sanitizeSentryEvent(event as never) as never;
      },
      beforeBreadcrumb(breadcrumb) {
        if (breadcrumb.data) {
          const cleaned = sanitizeSentryEvent({ extra: breadcrumb.data }).extra;
          breadcrumb.data = cleaned as typeof breadcrumb.data;
        }
        return breadcrumb;
      },
    });
    Sentry.setTag("app", "workspace");
    initialised = true;
    drainQueue(Sentry);
  };

  const idle = (cb: () => void): void => {
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      (
        window as typeof window & {
          requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number;
        }
      ).requestIdleCallback(cb, { timeout: 2000 });
    } else {
      setTimeout(cb, 1000);
    }
  };

  idle(() => {
    void run();
  });
}

function drainQueue(Sentry: SentryNamespace): void {
  while (queue.length > 0) {
    const call = queue.shift();
    if (!call) continue;
    try {
      if (call.kind === "capture") Sentry.captureException(...(call.args as [unknown]));
      else if (call.kind === "setUser") Sentry.setUser(...(call.args as [SentryUser]));
      else if (call.kind === "setTag")
        Sentry.setTag(...(call.args as [string, string | undefined]));
    } catch {
      // intentionally swallow — bridge must never throw into render path
    }
  }
}

export function captureException(error: unknown): void {
  if (initialised) {
    void loadModule().then((Sentry) => Sentry.captureException(error));
    return;
  }
  queue.push({ kind: "capture", args: [error] });
}

export function setSentryUser(user: { id: string } | null): void {
  if (initialised) {
    void loadModule().then((Sentry) => Sentry.setUser(user));
    return;
  }
  queue.push({ kind: "setUser", args: [user] });
}

export function setSentryTag(key: string, value: string | undefined): void {
  if (initialised) {
    void loadModule().then((Sentry) => Sentry.setTag(key, value));
    return;
  }
  queue.push({ kind: "setTag", args: [key, value] });
}

/** Test-only — reset internal state so multiple bootstraps don't leak. */
export function __resetSentryBridgeForTests(): void {
  initialised = false;
  initialiseStarted = false;
  modulePromise = null;
  queue.length = 0;
}
