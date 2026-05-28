/**
 * Route-level error + not-found + loading fallbacks.
 *
 * `RootErrorBoundary` wraps every route via `errorElement` on the root route.
 * It reports the error to Sentry exactly once per error instance (a WeakSet
 * guard prevents double-reporting under React's StrictMode double render) and
 * renders a translated fallback. The i18n keys live in the `shared` catalog
 * (`errors.boundaryTitle/Body/Refresh`) so the same copy is reused by the
 * top-level `<Sentry.ErrorBoundary>` from `shell/error-boundary.tsx`.
 *
 * `NotFoundElement` is rendered when React Router throws a 404 (no route
 * matched the URL). `ForbiddenElement` is rendered by `routeGuard()` when a
 * permission check fails — separate component because the copy must hint at
 * the tenant + admin path per `microcopy.md §13.1`.
 */

import { useRouteError, isRouteErrorResponse, Link, useNavigate } from "react-router-dom";
import { Suspense, useEffect, type ReactNode } from "react";
import { useTranslation } from "@sdm/i18n";
import { captureException } from "../bootstrap/sentry-bridge";

const reported = new WeakSet<object>();

function reportOnce(error: unknown): void {
  if (typeof error !== "object" || error === null) return;
  if (reported.has(error)) return;
  reported.add(error);
  captureException(error);
}

export function RootErrorBoundary() {
  const error = useRouteError();
  const { t } = useTranslation();

  useEffect(() => {
    if (isRouteErrorResponse(error) && error.status === 404) return;
    reportOnce(error);
  }, [error]);

  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFoundElement />;
  }

  return (
    <div role="alert" data-testid="route-error-boundary" className="sdm-error-screen">
      <h1>{t("errors.boundaryTitle")}</h1>
      <p>{t("errors.boundaryBody")}</p>
      <button type="button" onClick={() => window.location.reload()}>
        {t("errors.boundaryRefresh")}
      </button>
    </div>
  );
}

export function NotFoundElement() {
  const { t } = useTranslation();
  return (
    <main role="alert" data-testid="route-not-found" className="sdm-error-screen">
      <h1>{t("errors.notFoundTitle")}</h1>
      <p>{t("errors.notFoundBody")}</p>
      <Link to="/">{t("errors.notFoundHome")}</Link>
    </main>
  );
}

export function ForbiddenElement() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <main role="alert" data-testid="route-forbidden" className="sdm-error-screen">
      <h1>{t("errors.forbiddenTitle")}</h1>
      <p>{t("errors.forbiddenBody")}</p>
      <button type="button" onClick={() => navigate("/")}>
        {t("errors.notFoundHome")}
      </button>
    </main>
  );
}

export function RouteSuspenseFallback({ children }: { readonly children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <div role="status" data-testid="route-loading" className="sdm-route-loading">
          {t("meta.loading")}
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
