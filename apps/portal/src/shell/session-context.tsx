import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { Session } from "@sdm/auth";
import type { TenantId } from "@sdm/domain";
import { createCrossTabChannel, type CrossTabChannel } from "@sdm/api-client";
import {
  loadSession,
  login as doLogin,
  logout as doLogout,
  switchActiveTenant,
  UnauthorizedError,
} from "../bootstrap/session";

interface TenantOption {
  readonly id: TenantId;
  readonly name: string;
}

type Status = "loading" | "ready" | "anonymous" | "error";

interface SessionContextValue {
  readonly status: Status;
  readonly session: Session | null;
  readonly tenants: readonly TenantOption[];
  readonly error: string | null;
  readonly switchTenant: (tenantId: TenantId) => Promise<void>;
  readonly login: (username: string, password: string) => Promise<void>;
  readonly logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [tenants, setTenants] = useState<readonly TenantOption[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<CrossTabChannel | null>(null);

  const refresh = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const result = await loadSession();
      setSession(result.session);
      setTenants(result.tenants);
      setStatus("ready");
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        setSession(null);
        setTenants([]);
        setStatus("anonymous");
        return;
      }
      setError(e instanceof Error ? e.message : "session load failed");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Cross-tab sync (auth-flow.md §2.6): tenant-changed → refetch; logout → drop to anonymous.
  useEffect(() => {
    const channel = createCrossTabChannel();
    channelRef.current = channel;
    const unsubscribe = channel.subscribe((msg) => {
      if (msg.type === "tenant-changed") {
        void refresh();
      } else if (msg.type === "logout") {
        setSession(null);
        setTenants([]);
        setStatus("anonymous");
      }
    });
    return () => {
      unsubscribe();
      channel.close();
      channelRef.current = null;
    };
  }, [refresh]);

  // Heartbeat 401 → drop to anonymous (auth-flow.md §2.4 idle path).
  useEffect(() => {
    function onSessionLost() {
      setSession(null);
      setTenants([]);
      setStatus("anonymous");
    }
    window.addEventListener("sdm:session-lost", onSessionLost);
    return () => window.removeEventListener("sdm:session-lost", onSessionLost);
  }, []);

  const switchTenant = useCallback(
    async (tenantId: TenantId) => {
      await switchActiveTenant(tenantId);
      await refresh();
      channelRef.current?.post({
        type: "tenant-changed",
        tenantId,
        ts: Date.now(),
        sourceTabId: "",
      });
    },
    [refresh],
  );

  const login = useCallback(
    async (username: string, password: string) => {
      await doLogin(username, password);
      await refresh();
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    await doLogout();
    channelRef.current?.post({ type: "logout", ts: Date.now(), sourceTabId: "" });
    setSession(null);
    setTenants([]);
    setStatus("anonymous");
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ status, session, tenants, error, switchTenant, login, logout }),
    [status, session, tenants, error, switchTenant, login, logout],
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
