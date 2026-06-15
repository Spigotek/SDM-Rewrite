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
import { setSentryUser, setSentryTag } from "../bootstrap/sentry-bridge";
import { getConfig } from "../bootstrap/config";
import { resolvePortalOrigin } from "./portal-redirect";
import type { Session } from "@sdm/auth";
import type { TenantId } from "@sdm/domain";
import { createCrossTabChannel, pseudonymize, type CrossTabChannel } from "@sdm/api-client";
import {
  loadSession,
  login as doLogin,
  logout as doLogout,
  type SessionLoadResult,
  type TenantEnvironment,
  type TenantStatus,
  UnauthorizedError,
} from "../bootstrap/session";

interface TenantOption {
  readonly id: TenantId;
  readonly name: string;
  readonly environment?: TenantEnvironment;
  readonly status?: TenantStatus;
}

type Status = "loading" | "ready" | "anonymous" | "error";

interface SessionContextValue {
  readonly status: Status;
  readonly session: Session | null;
  readonly tenants: readonly TenantOption[];
  readonly error: string | null;
  /**
   * H.1: callers (the `useActiveTenant()` mutation hook) hand in the freshly-
   * fetched session payload after `POST /me/active-tenant`. The context just
   * mirrors it into local state + broadcasts the cross-tab event. The previous
   * `(tenantId) => Promise<void>` signature triggered an extra `/me` round-trip
   * on top of the switch — now we use the response of the switch directly.
   */
  readonly applySwitchedSession: (next: SessionLoadResult) => void;
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

  // Requester sessions (`app: "portal"`) don't belong in the workspace SPA —
  // bounce them to the portal app. Explicit `portalOrigin` from /config wins;
  // otherwise derive :88 from the current origin (workspace runs on :89).
  useEffect(() => {
    if (status !== "ready" || session?.app !== "portal") return;
    if (typeof window === "undefined") return;
    window.location.assign(
      resolvePortalOrigin(getConfig().portalOrigin, {
        protocol: window.location.protocol,
        hostname: window.location.hostname,
        port: window.location.port,
      }),
    );
  }, [status, session?.app]);

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

  // I.3 — tenant suspension drops the SPA to anonymous (re-auth required to
  // pick a different tenant). The toast itself is dispatched by the same
  // event so the global toast layer can pick it up; the session-context just
  // wipes its own state so guarded routes don't keep rendering with the now-
  // invalid tenant.
  useEffect(() => {
    function onTenantSuspended() {
      setSession(null);
      setTenants([]);
      setStatus("anonymous");
    }
    window.addEventListener("sdm:tenant-suspended", onTenantSuspended);
    return () => window.removeEventListener("sdm:tenant-suspended", onTenantSuspended);
  }, []);

  // Sentry user context per ADR-09 §1 — never raw userId / email / displayName.
  // Salt = active tenant ID so the same person across tenants does NOT collide
  // (resists cross-tenant correlation). When the session drops we clear the
  // user so subsequent anonymous errors aren't tagged with the last identity.
  useEffect(() => {
    if (!session) {
      setSentryUser(null);
      setSentryTag("tenantId", undefined);
      setSentryTag("locale", undefined);
      return;
    }
    let cancelled = false;
    void pseudonymize(session.userId, session.tenantId).then((pseudId) => {
      if (cancelled) return;
      setSentryUser({ id: pseudId });
      setSentryTag("tenantId", session.tenantId);
      setSentryTag("locale", session.i18n.locale);
    });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const applySwitchedSession = useCallback((next: SessionLoadResult) => {
    setSession(next.session);
    setTenants(next.tenants);
    setStatus("ready");
    setError(null);
    channelRef.current?.post({
      type: "tenant-changed",
      tenantId: next.session.tenantId,
      ts: Date.now(),
      sourceTabId: "",
    });
  }, []);

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
    () => ({ status, session, tenants, error, applySwitchedSession, login, logout }),
    [status, session, tenants, error, applySwitchedSession, login, logout],
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
