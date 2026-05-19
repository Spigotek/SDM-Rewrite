// Heartbeat — pošle POST /auth/heartbeat pri user-eventoch s 30s debounce.
// Per docs/agents/security/auth-flow.md §2.4 — BFF aktualizuje session.idleAt
// iba pri tomto pingu; renderer NIČ. 401 → onSessionLost (alebo custom event
// "sdm:session-lost" pre voľný coupling s ešte-neexistujúcim session-contextom).

import { useEffect, useRef } from "react";

const HEARTBEAT_DEBOUNCE_MS = 30_000;
const HEARTBEAT_URL = "/auth/heartbeat";
const SESSION_LOST_EVENT = "sdm:session-lost";

export interface HeartbeatProps {
  readonly onSessionLost?: () => void;
}

export function Heartbeat({ onSessionLost }: HeartbeatProps): null {
  const lastSentAtRef = useRef<number>(0);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSessionLostRef = useRef<HeartbeatProps["onSessionLost"]>(onSessionLost);

  useEffect(() => {
    onSessionLostRef.current = onSessionLost;
  }, [onSessionLost]);

  useEffect(() => {
    let unmounted = false;

    async function sendHeartbeat(): Promise<void> {
      pendingTimerRef.current = null;
      try {
        const response = await fetch(HEARTBEAT_URL, {
          method: "POST",
          credentials: "include",
        });
        if (unmounted) return;
        lastSentAtRef.current = Date.now();
        if (response.status === 401) {
          const handler = onSessionLostRef.current;
          if (handler) {
            handler();
          } else {
            window.dispatchEvent(new CustomEvent(SESSION_LOST_EVENT));
          }
        }
      } catch {
        // Network errors are swallowed — next user-event will retry.
        if (!unmounted) {
          lastSentAtRef.current = Date.now();
        }
      }
    }

    function handleUserEvent(): void {
      if (pendingTimerRef.current !== null) return;
      const elapsed = Date.now() - lastSentAtRef.current;
      if (elapsed < HEARTBEAT_DEBOUNCE_MS) return;
      pendingTimerRef.current = setTimeout(() => {
        void sendHeartbeat();
      }, 0);
    }

    const passive: AddEventListenerOptions = { passive: true };
    window.addEventListener("mousedown", handleUserEvent, passive);
    window.addEventListener("keydown", handleUserEvent, passive);
    window.addEventListener("scroll", handleUserEvent, passive);
    window.addEventListener("focus", handleUserEvent);

    return () => {
      unmounted = true;
      window.removeEventListener("mousedown", handleUserEvent);
      window.removeEventListener("keydown", handleUserEvent);
      window.removeEventListener("scroll", handleUserEvent);
      window.removeEventListener("focus", handleUserEvent);
      if (pendingTimerRef.current !== null) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    };
  }, []);

  return null;
}
