import { useRef, useState } from "react";
import { NotificationPopover, ThemeToggle, Wordmark, useTheme } from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";
import { Bell, Menu } from "lucide-react";
import { useNotifications } from "./use-notifications";
import { useSession } from "./session-context";
import "../features/sp-cockpit/sp-cockpit.css";

/**
 * Toggle the left-rail visibility below the `lg` breakpoint via a body-level
 * data attribute. Keeping the toggle on `document.body` avoids prop-drilling
 * and lets the rail/CSS-only media queries decide rendering — the rail
 * component itself doesn't need to know whether mobile mode is active.
 */
function toggleMobileRail(): void {
  const open = document.body.getAttribute("data-rail-open") === "true";
  if (open) {
    document.body.removeAttribute("data-rail-open");
  } else {
    document.body.setAttribute("data-rail-open", "true");
  }
}

export function TopBar({ appName }: { appName: string }) {
  const { t } = useTranslation("workspace");
  const { session, status } = useSession();
  const { choice, setChoice } = useTheme();

  /**
   * I.5 — show a `SP mode` indicator whenever the active session has the
   * `sp_admin` role. The badge stays in the top-bar so the elevated scope is
   * visible from every workspace view, including those without a rail
   * (loading/anonymous/error).
   */
  const isSpMode = !!session?.roles.includes("sp_admin");

  // L.1.B — live notification center driven by the shared SSE stream.
  const { events, unreadCount, markAllRead } = useNotifications();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifAnchorRef = useRef<HTMLButtonElement | null>(null);
  const notificationLabel = t("notifications.unreadCount").replace("{count}", String(unreadCount));

  return (
    <header className="sdm-top-bar" data-testid="top-bar">
      <button
        type="button"
        className="sdm-hamburger"
        data-testid="rail-hamburger"
        aria-label={t("nav.mobile.open")}
        title={t("nav.mobile.open")}
        onClick={toggleMobileRail}
      >
        <Menu size={18} aria-hidden="true" />
      </button>
      <div className="sdm-brand">
        <Wordmark size="md" />
        <span className="sdm-app-name">{appName}</span>
        {isSpMode && (
          <span className="sdm-sp-mode-badge" data-testid="sp-mode-badge">
            {t("sp.mode.indicator")}
          </span>
        )}
      </div>
      {status === "ready" && session && (
        <div className="sdm-top-bar-actions">
          <ThemeToggle value={choice} onChange={setChoice} />
          <button
            ref={notifAnchorRef}
            type="button"
            className="sdm-notif-button"
            data-testid="notif-button"
            aria-label={notificationLabel}
            aria-expanded={notifOpen}
            aria-haspopup="dialog"
            title={t("nav.notifications")}
            onClick={() => setNotifOpen((prev) => !prev)}
          >
            <Bell size={18} aria-hidden="true" />
            {unreadCount > 0 && (
              <span className="sdm-notif-count" aria-hidden="true">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
          <NotificationPopover
            open={notifOpen}
            onClose={() => setNotifOpen(false)}
            events={events}
            anchorRef={notifAnchorRef}
            onMarkAllRead={markAllRead}
            title={t("notifications.title")}
            emptyMessage={t("notifications.empty")}
            markAllReadLabel={t("notifications.markAllRead")}
            viewAllLabel={t("notifications.viewAll")}
          />
        </div>
      )}
    </header>
  );
}
