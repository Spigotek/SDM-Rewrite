import { Button } from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";
import { LanguageSwitcher } from "./language-switcher";
import { useSession } from "./session-context";
import { TenantSwitcher } from "./tenant-switcher";
import "../features/sp-cockpit/sp-cockpit.css";

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
          <div className="sdm-user-pill" data-testid="user-pill">
            <span className="sdm-user-name">{session.displayName}</span>
            <span className="sdm-user-roles">
              {session.roles.length > 0 ? session.roles.join(", ") : t("meta.noRoles")}
            </span>
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
