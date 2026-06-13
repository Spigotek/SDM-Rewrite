import type { ReactNode } from "react";
import { useTranslation } from "@sdm/i18n";
import { Breadcrumbs } from "./breadcrumbs";
import { Heartbeat } from "./heartbeat";
import { IdleModal } from "./idle-modal";
import { LoginPage } from "./login-page";
import { NavRow } from "./nav-row";
import { PendingChangesProvider } from "./pending-changes";
import { PendingChangesTestBridge } from "./pending-changes-test-bridge";
import { useSession } from "./session-context";
import { TopBar } from "./top-bar";

export function AppShell({ appName, children }: { appName: string; children: ReactNode }) {
  const { t } = useTranslation();
  const { status, session, error, login } = useSession();
  return (
    <PendingChangesProvider>
      {import.meta.env.DEV && <PendingChangesTestBridge />}
      <div className="sdm-app-shell">
        <TopBar appName={appName} />
        {status === "ready" && (
          <>
            <NavRow />
            <Breadcrumbs />
          </>
        )}
        <main className="sdm-content" data-testid="shell-content">
          {status === "loading" && <p data-testid="session-loading">{t("meta.loading")}</p>}
          {status === "anonymous" && <LoginPage appName={appName} onSubmit={login} />}
          {status === "error" && (
            <p role="alert" data-testid="session-error">
              {t("errors.sessionLoadFailed", { detail: error ?? "" })}
            </p>
          )}
          {status === "ready" && (
            <>
              <Heartbeat />
              <IdleModal idleTimeoutSec={session?.idleTimeoutSec ?? 30 * 60} />
              {children}
            </>
          )}
        </main>
      </div>
    </PendingChangesProvider>
  );
}
