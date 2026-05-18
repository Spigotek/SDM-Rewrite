import type { ReactNode } from "react";
import { useSession } from "./session-context";
import { TopBar } from "./top-bar";

export function AppShell({ appName, children }: { appName: string; children: ReactNode }) {
  const { status, error } = useSession();
  return (
    <div className="sdm-app-shell">
      <TopBar appName={appName} />
      <main className="sdm-content" data-testid="shell-content">
        {status === "loading" && <p data-testid="session-loading">Loading session…</p>}
        {status === "error" && (
          <p role="alert" data-testid="session-error">
            Failed to load session: {error}
          </p>
        )}
        {status === "ready" && children}
      </main>
    </div>
  );
}
