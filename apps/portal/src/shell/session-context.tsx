import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@sdm/auth";
import type { TenantId } from "@sdm/domain";
import { loadSession, switchActiveTenant } from "../bootstrap/session";

interface TenantOption {
  readonly id: TenantId;
  readonly name: string;
  readonly code: string | null;
}

interface SessionContextValue {
  readonly status: "loading" | "ready" | "error";
  readonly session: Session | null;
  readonly tenants: readonly TenantOption[];
  readonly error: string | null;
  readonly switchTenant: (tenantId: TenantId) => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [tenants, setTenants] = useState<readonly TenantOption[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const result = await loadSession();
      setSession(result.session);
      setTenants(result.tenants);
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "session load failed");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const switchTenant = useCallback(
    async (tenantId: TenantId) => {
      await switchActiveTenant(tenantId);
      await refresh();
    },
    [refresh],
  );

  const value = useMemo<SessionContextValue>(
    () => ({ status, session, tenants, error, switchTenant }),
    [status, session, tenants, error, switchTenant],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession() must be called inside <SessionProvider>");
  }
  return ctx;
}
