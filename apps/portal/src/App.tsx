import { ErrorBoundary } from "./shell/error-boundary";
import { SessionProvider, useSession } from "./shell/session-context";
import { AppShell } from "./shell/app-shell";
import "./shell/styles.css";

function PortalHome() {
  const { session } = useSession();
  if (!session) return null;
  return (
    <section data-testid="portal-home">
      <h1>SDM Portal</h1>
      <p>
        Active tenant: <strong data-testid="active-tenant">{session.tenantId}</strong>
      </p>
      <p>
        Mocks: <strong>{import.meta.env.VITE_USE_MOCKS === "true" ? "on" : "off"}</strong>
      </p>
      <p className="sdm-skeleton-hint">Feature obsah dorazí v Phase H. E.3 dodáva len skeleton.</p>
    </section>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SessionProvider>
        <AppShell appName="Service Desk Portal">
          <PortalHome />
        </AppShell>
      </SessionProvider>
    </ErrorBoundary>
  );
}
