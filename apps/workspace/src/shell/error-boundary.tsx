import { Component, type ErrorInfo, type ReactNode } from "react";
import { useTranslation } from "@sdm/i18n";
import { captureException } from "../bootstrap/sentry-bridge";

/**
 * Top-level render error boundary.
 *
 * `@sentry/react` is intentionally NOT imported statically — its 41 KB gzip
 * footprint would push the initial JS over budget post-H.0 (per G.4 deferred
 * trade-off). Instead, we use a plain React class boundary and forward the
 * error to the lazy `sentry-bridge` which dynamically loads the SDK on idle.
 * Errors caught before Sentry is ready are queued and drained once the
 * bridge initialises.
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

interface State {
  readonly hasError: boolean;
}

interface Props {
  readonly children: ReactNode;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = { hasError: false };

  public static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  public override componentDidCatch(error: Error, info: ErrorInfo): void {
    captureException(error);
    if (import.meta.env.DEV) {
      console.error("[workspace] render error", error, info);
    }
  }

  public override render(): ReactNode {
    if (this.state.hasError) return <ErrorFallback />;
    return this.props.children;
  }
}
