/**
 * Sentry init for the workspace SPA. Mirror of `apps/portal/src/bootstrap/
 * sentry.ts` — the two files diverge only on `Sentry.setTag("app", ...)`.
 * Logic kept in the shared `sanitizeSentryEvent` helper (`@sdm/api-client`)
 * to keep the two app bootstraps trivially-comparable on review.
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

  Sentry.setTag("app", "workspace");
  initialised = true;
  return true;
}

/** Test-only — reset internal flag so multiple init calls in tests don't no-op. */
export function __resetSentryForTests(): void {
  initialised = false;
}
