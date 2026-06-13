import { ThemeToggle, useTheme } from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";
import { Bell, Menu } from "lucide-react";
import { useSession } from "./session-context";
import "../features/sp-cockpit/sp-cockpit.css";

// Notifications wiring is deferred to Round D (SSE-fed unread counter).
// For v1.1.4 the bell renders with a hardcoded zero; in K.3.B the bell stays
// in the top-bar so the affordance survives the rail migration.
const NOTIFICATION_COUNT = 0;

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
  const { t } = useTranslation();
  const { session, status } = useSession();
  const { choice, setChoice } = useTheme();

  /**
   * I.5 — show a `SP mode` indicator whenever the active session has the
   * `sp_admin` role. The badge stays in the top-bar so the elevated scope is
   * visible from every workspace view, including those without a rail
   * (loading/anonymous/error).
   */
  const isSpMode = !!session?.roles.includes("sp_admin");

  const notificationLabel = `${t("nav.notifications")}, ${NOTIFICATION_COUNT} ${t("nav.unread")}`;

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
        <span className="sdm-logo" aria-hidden="true">
          SDM
        </span>
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
            type="button"
            className="sdm-notif-button"
            data-testid="notif-button"
            aria-label={notificationLabel}
            title={t("nav.notifications")}
          >
            <Bell size={18} aria-hidden="true" />
            {NOTIFICATION_COUNT > 0 && (
              <span className="sdm-notif-count" aria-hidden="true">
                {NOTIFICATION_COUNT > 99 ? "99+" : NOTIFICATION_COUNT}
              </span>
            )}
          </button>
        </div>
      )}
    </header>
  );
}
