// IdleModal — sleduje user-events a otvorí warning modál 60s pred idle timeoutom.
// Per docs/agents/security/auth-flow.md §2.4 — pri 29 min nečinnosti varovanie,
// pri 30 min countdown vyprší a redirect na /login?reason=idle.

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_IDLE_TIMEOUT_SEC = 30 * 60;
const WARNING_COUNTDOWN_SEC = 60;
const HEARTBEAT_URL = "/auth/heartbeat";
const LOGIN_REDIRECT = "/login?reason=idle";

export interface IdleModalProps {
  readonly idleTimeoutSec?: number;
}

export function IdleModal({ idleTimeoutSec = DEFAULT_IDLE_TIMEOUT_SEC }: IdleModalProps) {
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState<number>(WARNING_COUNTDOWN_SEC);

  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const showWarningRef = useRef<boolean>(false);

  const warningDelayMs = Math.max(0, (idleTimeoutSec - WARNING_COUNTDOWN_SEC) * 1000);

  const clearWarningTimer = useCallback(() => {
    if (warningTimerRef.current !== null) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
  }, []);

  const clearCountdownInterval = useCallback(() => {
    if (countdownIntervalRef.current !== null) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const redirectToLogin = useCallback(() => {
    window.location.href = LOGIN_REDIRECT;
  }, []);

  const startCountdown = useCallback(() => {
    setCountdown(WARNING_COUNTDOWN_SEC);
    setShowWarning(true);
    showWarningRef.current = true;
    clearCountdownInterval();
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearCountdownInterval();
          setShowWarning(false);
          showWarningRef.current = false;
          redirectToLogin();
          return 0;
        }
        return next;
      });
    }, 1000);
  }, [clearCountdownInterval, redirectToLogin]);

  const scheduleWarning = useCallback(() => {
    clearWarningTimer();
    warningTimerRef.current = setTimeout(() => {
      startCountdown();
    }, warningDelayMs);
  }, [clearWarningTimer, startCountdown, warningDelayMs]);

  const handleContinue = useCallback(async () => {
    clearCountdownInterval();
    setShowWarning(false);
    showWarningRef.current = false;
    setCountdown(WARNING_COUNTDOWN_SEC);
    scheduleWarning();
    try {
      await fetch(HEARTBEAT_URL, { method: "POST", credentials: "include" });
    } catch {
      // Network errors are non-fatal — Heartbeat komponent znova zafailne pri
      // ďalšom user-evente; ak je session naozaj mŕtva, /me vráti 401.
    }
  }, [clearCountdownInterval, scheduleWarning]);

  useEffect(() => {
    function handleUserEvent(): void {
      if (showWarningRef.current) return;
      scheduleWarning();
    }

    const passive: AddEventListenerOptions = { passive: true };
    window.addEventListener("mousedown", handleUserEvent, passive);
    window.addEventListener("keydown", handleUserEvent, passive);
    window.addEventListener("scroll", handleUserEvent, passive);
    window.addEventListener("focus", handleUserEvent);

    scheduleWarning();

    return () => {
      window.removeEventListener("mousedown", handleUserEvent);
      window.removeEventListener("keydown", handleUserEvent);
      window.removeEventListener("scroll", handleUserEvent);
      window.removeEventListener("focus", handleUserEvent);
      clearWarningTimer();
      clearCountdownInterval();
    };
  }, [scheduleWarning, clearWarningTimer, clearCountdownInterval]);

  if (!showWarning) return null;

  return (
    <div className="sdm-modal-overlay" data-testid="idle-modal-overlay">
      <div
        className="sdm-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sdm-idle-modal-title"
        data-testid="idle-modal"
      >
        <h2 id="sdm-idle-modal-title" className="sdm-modal-title">
          Relácia čoskoro vyprší
        </h2>
        <p className="sdm-modal-body">
          Vaša relácia vyprší o <span data-testid="idle-modal-countdown">{countdown}</span> sekúnd.
          Chcete pokračovať?
        </p>
        <div className="sdm-modal-actions">
          <button
            type="button"
            className="sdm-modal-button sdm-modal-button-primary"
            onClick={() => void handleContinue()}
            data-testid="idle-modal-continue"
          >
            Pokračovať
          </button>
        </div>
      </div>
    </div>
  );
}
