/**
 * Sentry init for the portal SPA — DSN sourced from runtime config (BFF
 * `/config` → `observability.sentryDsn`). Per ADR-09 §1 the FE is the
 * client-error tracking surface; BFF logs ride pino + audit taxonomy.
 *
 * No-op when DSN is missing (mock mode, local dev without DSN) — verified
 * by `bootstrap/sentry.test.ts`. PII strip happens in `beforeSend` via the
 * Sentry-agnostic helper in `@sdm/api-client`.
 */

import * as Sentry from "@sentry/react";
import { sanitizeSentryEvent, type SanitizableEvent } from "@sdm/api-client";
import type { ObservabilityConfig } from "./config";

export interface InitSentryOptions {
  readonly observability: ObservabilityConfig;
  readonly appVersion: string;
}

let initialised = false;

export function initSentry({ observability, appVersion }: InitSentryOptions): boolean {
  if (initialised) return true;
  const dsn = observability.sentryDsn;
  if (!dsn) return false;

  Sentry.init({
    dsn,
    release: import.meta.env.VITE_GIT_SHA ?? appVersion,
    environment: observability.sentryEnvironment ?? import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: observability.sentrySampleRate ?? 0.1,
    // Errors are always captured (sampling = 1.0); `tracesSampleRate` only
    // affects performance spans. PII strip runs synchronously inline so the
    // event never leaves the page with sensitive content.
    beforeSend(event) {
      // Sentry's `ErrorEvent` shape is a strict superset of `SanitizableEvent`.
      // The cast keeps the helper free of `@sentry/react` runtime imports.
      return sanitizeSentryEvent(event as unknown as SanitizableEvent) as unknown as typeof event;
    },
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.data) {
        const cleaned = sanitizeSentryEvent({ extra: breadcrumb.data }).extra;
        breadcrumb.data = cleaned as typeof breadcrumb.data;
      }
      return breadcrumb;
    },
  });

  Sentry.setTag("app", "portal");
  initialised = true;
  return true;
}

/** Test-only — reset internal flag so multiple init calls in tests don't no-op. */
export function __resetSentryForTests(): void {
  initialised = false;
}
