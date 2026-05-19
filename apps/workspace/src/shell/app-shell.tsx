import type { ReactNode } from "react";
import { Heartbeat } from "./heartbeat";
import { IdleModal } from "./idle-modal";
import { LoginPage } from "./login-page";
import { useSession } from "./session-context";
import { TopBar } from "./top-bar";

export function AppShell({ appName, children }: { appName: string; children: ReactNode }) {
  const { status, session, error, login } = useSession();
  return (
    <div className="sdm-app-shell">
      <TopBar appName={appName} />
      <main className="sdm-content" data-testid="shell-content">
        {status === "loading" && <p data-testid="session-loading">Loading session…</p>}
        {status === "anonymous" && <LoginPage appName={appName} onSubmit={login} />}
        {status === "error" && (
          <p role="alert" data-testid="session-error">
            Failed to load session: {error}
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
  );
}
