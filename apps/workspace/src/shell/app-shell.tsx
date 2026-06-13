import type { ReactNode } from "react";
import { useTranslation } from "@sdm/i18n";
import { Breadcrumbs } from "./breadcrumbs";
import { CommandPaletteMount } from "./command-palette-mount";
import { Heartbeat } from "./heartbeat";
import { IdleModal } from "./idle-modal";
import { LeftRail } from "./left-rail";
import { LoginPage } from "./login-page";
import { PendingChangesProvider } from "./pending-changes";
import { PendingChangesTestBridge } from "./pending-changes-test-bridge";
import { useSession } from "./session-context";
import { TopBar } from "./top-bar";
import "./left-rail.css";

export function AppShell({ appName, children }: { appName: string; children: ReactNode }) {
  const { t } = useTranslation();
  const { status, session, error, login } = useSession();
  const ready = status === "ready";
  return (
    <PendingChangesProvider>
      {import.meta.env.DEV && <PendingChangesTestBridge />}
      <div className="sdm-app-shell" data-rail-ready={ready ? "true" : "false"}>
        {/* K.3.F — skip-link MUST be the first focusable element. Hidden off-screen
         * until focused. Targets `<main id="main">`. */}
        <a href="#main" className="sdm-skip-link">
          {t("a11y.skipToMain")}
        </a>
        {ready && <LeftRail />}
        <div className="sdm-app-shell-main">
          <TopBar appName={appName} />
          {ready && <Breadcrumbs />}
          <main className="sdm-content" id="main" tabIndex={-1} data-testid="shell-content">
            {status === "loading" && <p data-testid="session-loading">{t("meta.loading")}</p>}
            {status === "anonymous" && <LoginPage appName={appName} onSubmit={login} />}
            {status === "error" && (
              <p role="alert" data-testid="session-error">
                {t("errors.sessionLoadFailed", { detail: error ?? "" })}
              </p>
            )}
            {ready && (
              <>
                <Heartbeat />
                <IdleModal idleTimeoutSec={session?.idleTimeoutSec ?? 30 * 60} />
                <CommandPaletteMount />
                {children}
              </>
            )}
          </main>
        </div>
      </div>
    </PendingChangesProvider>
  );
}
