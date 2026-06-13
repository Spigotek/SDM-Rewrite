/**
 * J.3 — EventSourceProvider for the workspace shell.
 *
 * Opens AppEventSource when a session is active, closes it on session end.
 * Dispatches events into the existing DOM event system so session-context.tsx
 * handlers fire identically whether triggered by I.3 next-API-call detection
 * or by J.3 SSE push.
 *
 * Mount: inside SessionProvider (needs session) and outside routing tree.
 *
 * On `tenant.suspended` for the active tenant → dispatch `sdm:tenant-suspended`
 * (session-context drops to anonymous, toast fires via existing listener).
 *
 * On `tenant.suspended` for a non-active tenant → dispatch
 * `sdm:tenant-switcher-invalidate` (tenant switcher refetches; no logout).
 *
 * On `session.expired` → dispatch `sdm:session-lost` (session-context drops
 * to anonymous per heartbeat 401 path — same handler, same effect).
 *
 * On EventSource error → silent (I.3 fallback stays active via heartbeat).
 *
 * L.1.B — additionally expose a React context (`useAppEvents`) so the
 * notification center can read the same SSE stream without instantiating a
 * second EventSource. Subscribers get every event the underlying connection
 * receives; the provider tracks them in a ref so additions don't restart the
 * SSE connection.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { AppEventSource, type AppEvent } from "@sdm/api-client";
import { useSession } from "./session-context";

export type AppEventListener = (event: AppEvent) => void;

export interface AppEventsContextValue {
  /** Register a listener. Returns the teardown that removes it. */
  readonly subscribe: (listener: AppEventListener) => () => void;
}

const AppEventsContext = createContext<AppEventsContextValue | null>(null);

export function useAppEvents(): AppEventsContextValue {
  const value = useContext(AppEventsContext);
  if (!value) {
    throw new Error("useAppEvents must be used inside <EventSourceProvider>");
  }
  return value;
}

export function EventSourceProvider({ children }: { children: ReactNode }) {
  const { session, status } = useSession();
  // Keep activeTenantId in a ref so the event handler always sees the latest
  // value without causing EventSource to re-open on every tenant switch.
  const activeTenantRef = useRef<string | null>(session?.tenantId ?? null);
  const listenersRef = useRef<Set<AppEventListener>>(new Set());

  useEffect(() => {
    activeTenantRef.current = session?.tenantId ?? null;
  }, [session?.tenantId]);

  const subscribe = useCallback((listener: AppEventListener): (() => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    // Only open SSE when the session is fully loaded.
    if (status !== "ready") return;

    const es = new AppEventSource({
      url: "/api/events",
      onEvent(event: AppEvent) {
        if (event.type === "tenant.suspended") {
          if (event.tenantId === activeTenantRef.current) {
            // Active tenant suspended — force logout flow.
            window.dispatchEvent(
              new CustomEvent("sdm:tenant-suspended", { detail: { tenantId: event.tenantId } }),
            );
          } else {
            // Non-active tenant — invalidate switcher cache without logout.
            window.dispatchEvent(
              new CustomEvent("sdm:tenant-switcher-invalidate", {
                detail: { tenantId: event.tenantId },
              }),
            );
          }
        } else if (event.type === "session.expired") {
          window.dispatchEvent(new CustomEvent("sdm:session-lost"));
        }
        // "connected" event is informational — no UI action needed.

        // L.1.B — fan-out to context subscribers. Iterate over a snapshot so a
        // listener that unsubscribes mid-loop doesn't skip the rest.
        const snapshot = Array.from(listenersRef.current);
        for (const listener of snapshot) {
          try {
            listener(event);
          } catch {
            /* Listeners must not break the SSE pipeline. */
          }
        }
      },
    });

    return () => es.close();
  }, [status]);

  const value = useMemo<AppEventsContextValue>(() => ({ subscribe }), [subscribe]);

  return <AppEventsContext.Provider value={value}>{children}</AppEventsContext.Provider>;
}
