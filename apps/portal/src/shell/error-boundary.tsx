import type { ReactNode } from "react";
import * as Sentry from "@sentry/react";
import { useTranslation } from "@sdm/i18n";

/**
 * Top-level render error boundary wired to Sentry.
 *
 * `Sentry.ErrorBoundary` swallows the throw, fires `captureException` (with
 * the deep PII strip applied via `initSentry`'s `beforeSend`), and renders
 * the fallback element. When Sentry isn't initialised (mock mode / missing
 * DSN) the boundary still works — Sentry.ErrorBoundary degrades to a plain
 * React error boundary that logs to console.
 */

function ErrorFallback() {
  const { t } = useTranslation();
  return (
    <div role="alert" data-testid="error-boundary" className="sdm-error-screen">
      <h1>{t("errors.boundaryTitle")}</h1>
      <p>{t("errors.boundaryBody")}</p>
      <button type="button" onClick={() => window.location.reload()}>
        {t("errors.boundaryRefresh")}
      </button>
    </div>
  );
}

export function ErrorBoundary({ children }: { readonly children: ReactNode }) {
  return (
    <Sentry.ErrorBoundary fallback={<ErrorFallback />} showDialog={false}>
      {children}
    </Sentry.ErrorBoundary>
  );
}
