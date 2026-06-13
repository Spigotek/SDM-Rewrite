import { useEffect } from "react";
import { Avatar, Button } from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";
import { useHotkeys } from "react-hotkeys-hook";
import { Bell, Search } from "lucide-react";
import { LanguageSwitcher } from "./language-switcher";
import { useSession } from "./session-context";
import { TenantSwitcher } from "./tenant-switcher";
import "../features/sp-cockpit/sp-cockpit.css";

/**
 * Placeholder handler for the global Cmd/Ctrl+K shortcut. The actual
 * command-palette modal is deferred to v1.2 (K.2); v1.1.4 ships only the
 * affordance so the muscle memory and keybinding are reserved.
 */
function openCommandPalettePlaceholder(): void {
  console.info("[workspace] Cmd+K modal — coming in v1.2");
}

// Notifications wiring is deferred to Round D (SSE-fed unread counter).
// For v1.1.4 the bell is rendered with a hardcoded zero so the affordance
// is in place but the badge stays hidden.
const NOTIFICATION_COUNT = 0;

export function TopBar({ appName }: { appName: string }) {
  const { t } = useTranslation();
  const { session, status, logout } = useSession();
  /**
   * I.5 — show a `SP mode` indicator whenever the active session has the
   * `sp_admin` role. Avoids disorientation when sp_admin is drilled into a
   * customer tenant via the cockpit — the TopBar makes the elevated scope
   * visible at all times.
   */
  const isSpMode = !!session?.roles.includes("sp_admin");

  // Reserve the keystroke globally so v1.2 can replace this placeholder
  // without retraining users. `enableOnFormTags` lets it work even when
  // focus is inside inputs (the future palette must always be reachable).
  useHotkeys(
    "mod+k",
    (event) => {
      event.preventDefault();
      openCommandPalettePlaceholder();
    },
    { enableOnFormTags: true, enabled: status === "ready" },
  );

  // No-op effect that keeps the hook ordering stable across re-renders even
  // if `useHotkeys` is conditionally enabled inside a future refactor.
  useEffect(() => undefined, []);

  const notificationLabel = `${t("nav.notifications")}, ${NOTIFICATION_COUNT} ${t("nav.unread")}`;

  return (
    <header className="sdm-top-bar" data-testid="top-bar">
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
        <>
          <TenantSwitcher />
          <button
            type="button"
            className="sdm-cmdk-hint"
            data-testid="cmdk-hint"
            onClick={openCommandPalettePlaceholder}
            aria-label={t("nav.cmdkHint")}
            title={t("nav.cmdkHint")}
          >
            <Search size={14} aria-hidden="true" />
            <span className="sdm-cmdk-hint-keys" aria-hidden="true">
              <kbd>⌘</kbd>
              <kbd>K</kbd>
            </span>
          </button>
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
          <div className="sdm-user-pill" data-testid="user-pill">
            <Avatar name={session.displayName} size="md" aria-label={session.displayName} />
            <div className="sdm-user-pill-meta">
              <span className="sdm-user-name">{session.displayName}</span>
              <span className="sdm-user-roles">
                {session.roles.length > 0 ? session.roles.join(", ") : t("meta.noRoles")}
              </span>
            </div>
          </div>
          <LanguageSwitcher />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void logout()}
            data-testid="logout-button"
          >
            {t("actions.signOut")}
          </Button>
        </>
      )}
    </header>
  );
}
