import { ErrorBoundary } from "./shell/error-boundary";
import { SessionProvider, useSession } from "./shell/session-context";
import { AppShell } from "./shell/app-shell";
import "./shell/styles.css";

function WorkspaceHome() {
  const { session } = useSession();
  if (!session) return null;
  return (
    <section data-testid="workspace-home">
      <h1>SDM Workspace</h1>
      <p>
        Active tenant: <strong data-testid="active-tenant">{session.tenantId}</strong>
      </p>
      <p>
        Mocks: <strong>{import.meta.env.VITE_USE_MOCKS === "true" ? "on" : "off"}</strong>
      </p>
      <p className="sdm-skeleton-hint">
        Queue, ticket detail a ostatné feature moduly dorazia v Phase H. E.3 dodáva len skeleton.
      </p>
    </section>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SessionProvider>
        <AppShell appName="Service Desk Workspace">
          <WorkspaceHome />
        </AppShell>
      </SessionProvider>
    </ErrorBoundary>
  );
}
