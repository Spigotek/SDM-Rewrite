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
import type { Session } from "@sdm/auth";
import type { TenantId } from "@sdm/domain";
import { createCrossTabChannel, pseudonymize, type CrossTabChannel } from "@sdm/api-client";
import {
  loadSession,
  login as doLogin,
  logout as doLogout,
  type SessionLoadResult,
  type TenantEnvironment,
  UnauthorizedError,
} from "../bootstrap/session";
import { consumePreloadedSession } from "../bootstrap/session-preload";

interface TenantOption {
  readonly id: TenantId;
  readonly name: string;
  readonly environment?: TenantEnvironment;
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
  // I.0 — consume the bootstrap-phase session preload (set by `main.tsx`
  // before `createRoot().render()`). `ready` / `anonymous` outcomes skip
  // the initial `useEffect → loadSession()` fetch entirely; `loading`
  // (5xx fallback) keeps the legacy retry-on-mount behaviour. The slot is
  // cleared on read so a hot-reload re-mount falls back to normal flow.
  const preloadedRef = useRef(consumePreloadedSession());
  const preloaded = preloadedRef.current;
  const [session, setSession] = useState<Session | null>(
    preloaded?.status === "ready" ? preloaded.result.session : null,
  );
  const [tenants, setTenants] = useState<readonly TenantOption[]>(
    preloaded?.status === "ready" ? preloaded.result.tenants : [],
  );
  const [status, setStatus] = useState<Status>(
    preloaded?.status === "ready"
      ? "ready"
      : preloaded?.status === "anonymous"
        ? "anonymous"
        : "loading",
  );
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
    // Skip the initial `/me` round-trip when bootstrap already produced an
    // authoritative outcome (`ready` or `anonymous`). The legacy fallback
    // (`loading` — 5xx / network failure during bootstrap) re-runs the
    // fetch on mount so transient backend hiccups self-heal.
    if (preloaded?.status === "ready" || preloaded?.status === "anonymous") return;
    void refresh();
  }, [refresh, preloaded]);

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
