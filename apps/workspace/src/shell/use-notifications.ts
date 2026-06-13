/**
 * L.1.B — Notification queue for the workspace top-bar bell.
 *
 * Reads every event from the shared `EventSourceProvider` (single underlying
 * EventSource) and maps the J.3 AppEvent shapes into renderer-friendly
 * `NotificationEvent` objects. The queue is capped at 50 entries — older
 * entries fall off as new events arrive.
 *
 * Persistence: only the `lastReadAt` cursor is persisted (localStorage).
 * The event queue itself is in-memory — the next session refetches state via
 * the SSE backlog the server replays on reconnect (J.3 contract).
 *
 * NOTE — `GET /api/events?since=…` does not exist in the BFF yet; the brief
 * explicitly allows skipping initial hydration when missing. New events
 * arriving over SSE are sufficient for the v1.3 surprise demo.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { AppEvent } from "@sdm/api-client";
import type { NotificationEvent } from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";
import { useAppEvents } from "./event-source";

const STORAGE_KEY = "sdm.workspace.notifications.lastReadAt";
const QUEUE_MAX = 50;

export interface UseNotificationsResult {
  readonly events: ReadonlyArray<NotificationEvent>;
  readonly unreadCount: number;
  readonly lastReadAt: string | null;
  readonly markAllRead: () => void;
  readonly clear: () => void;
}

function readLastReadAt(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeLastReadAt(value: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* swallow — quota or private-mode disable */
  }
}

function mapEvent(
  event: AppEvent,
  t: (key: string) => string,
  idSuffix: number,
): NotificationEvent | null {
  if (event.type === "connected") return null;

  if (event.type === "tenant.suspended") {
    return {
      id: `tenant-suspended-${event.tenantId}-${event.at}-${idSuffix}`,
      occurredAt: event.at,
      verb: t("notifications.verbs.tenantSuspended"),
      severity: "danger",
    };
  }

  if (event.type === "session.expired") {
    return {
      id: `session-expired-${event.at}-${idSuffix}`,
      occurredAt: event.at,
      verb: t("notifications.verbs.sessionExpired"),
      severity: "warning",
    };
  }

  return null;
}

export function useNotifications(): UseNotificationsResult {
  const { subscribe } = useAppEvents();
  const { t } = useTranslation("workspace");
  const [events, setEvents] = useState<ReadonlyArray<NotificationEvent>>([]);
  const [lastReadAt, setLastReadAt] = useState<string | null>(() => readLastReadAt());
  const counterRef = useRef(0);

  useEffect(() => {
    return subscribe((event) => {
      counterRef.current += 1;
      const mapped = mapEvent(event, t, counterRef.current);
      if (!mapped) return;
      setEvents((prev) => {
        const next = [mapped, ...prev];
        return next.length > QUEUE_MAX ? next.slice(0, QUEUE_MAX) : next;
      });
    });
  }, [subscribe, t]);

  const markAllRead = useCallback(() => {
    const now = new Date().toISOString();
    setLastReadAt(now);
    writeLastReadAt(now);
  }, []);

  const clear = useCallback(() => {
    setEvents([]);
  }, []);

  const unreadCount = lastReadAt
    ? events.filter((event) => event.occurredAt > lastReadAt).length
    : events.length;

  return { events, unreadCount, lastReadAt, markAllRead, clear };
}
