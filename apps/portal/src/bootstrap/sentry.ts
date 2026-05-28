/**
 * Sentry init entry point — defers to the lazy bridge.
 *
 * Previously this file statically imported `@sentry/react` and called
 * `Sentry.init()` synchronously before React render. After H.0 the portal's
 * eager-load JS budget can't accommodate the 41 KB Sentry chunk on the
 * critical path, so init is scheduled in `requestIdleCallback` via
 * `scheduleSentryInit()` in `sentry-bridge.ts`. The bridge dynamically
 * imports `@sentry/react` only at idle time, keeping it out of the initial
 * bundle.
 *
 * Trade-off (per G.4 §Open questions): errors thrown in the first 50-200 ms
 * before idle are missed by Sentry. The top-level `<ErrorBoundary>` still
 * renders a fallback so users see something useful; the missed Sentry events
 * are an acceptable loss per `audit-and-compliance.md §3 sampling`.
 */

import { scheduleSentryInit, __resetSentryBridgeForTests } from "./sentry-bridge";
import type { ObservabilityConfig } from "./config";

export interface InitSentryOptions {
  readonly observability: ObservabilityConfig;
  readonly appVersion: string;
}

export function initSentry(opts: InitSentryOptions): boolean {
  scheduleSentryInit(opts);
  return Boolean(opts.observability.sentryDsn);
}

/** Test-only — reset internal flag so multiple init calls in tests don't no-op. */
export function __resetSentryForTests(): void {
  __resetSentryBridgeForTests();
}
