import { Avatar, Button, ThemeToggle, useTheme, type ThemeChoice } from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";
import { useHotkeys } from "react-hotkeys-hook";
import { LanguageSwitcher } from "./language-switcher";
import { openPortalDrawer } from "./mobile-drawer";
import { useSession } from "./session-context";
import { TenantSwitcher } from "./tenant-switcher";

/**
 * Inline SVG icons. `lucide-react` is bundled by design-system but is not a
 * direct dep of `@sdm/portal`; the shell only needs a handful of glyphs so
 * we keep them inline rather than enlarge portal's dep graph.
 */
function SearchIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function HamburgerIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}

function BellIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M10.268 21a2 2 0 0 0 3.464 0" />
      <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
    </svg>
  );
}

/**
 * Placeholder handler for the global Cmd/Ctrl+K shortcut. The actual
 * command-palette modal is deferred to v1.2 (K.2); v1.1.4 ships only the
 * affordance so the muscle memory and keybinding are reserved.
 */
function openCommandPalettePlaceholder(): void {
  console.info("[portal] Cmd+K modal — coming in v1.2");
}

type CycleChoice = "system" | "light" | "dark";

function nextChoice(current: CycleChoice): CycleChoice {
  if (current === "system") return "light";
  if (current === "light") return "dark";
  return "system";
}

function themeToggleLabel(choice: ThemeChoice, t: (key: string) => string): string {
  // Mirror the DS default cycle wording but localised through the portal
  // catalog so SK users get Slovak SR output. `hc` is outside the cycle and
  // collapses to `system` for label purposes (it also resets there on click).
  const current: CycleChoice = choice === "hc" ? "system" : choice;
  const next = nextChoice(current);
  return t("nav.themeToggle.aria")
    .replace("{current}", t(`nav.themeToggle.${current}`))
    .replace("{next}", t(`nav.themeToggle.${next}`));
}

export function TopBar({ appName }: { appName: string }) {
  const { t } = useTranslation();
  const { session, status, logout } = useSession();
  const { choice, setChoice } = useTheme();

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

  // v1.1.4 ships notifications visually only; Round D will wire SSE-driven
  // counts. `as number` widens the literal so future increments typecheck.
  const notificationCount = 0 as number;
  const notificationLabel = `${t("nav.notifications")}, ${notificationCount} unread`;

  return (
    <header className="sdm-top-bar" data-testid="top-bar">
      {status === "ready" && session && (
        <button
          type="button"
          className="sdm-hamburger"
          data-testid="portal-hamburger"
          onClick={openPortalDrawer}
          aria-label={t("nav.mobile.open")}
          aria-controls="portal-mobile-drawer"
          title={t("nav.mobile.open")}
        >
          <HamburgerIcon size={20} />
        </button>
      )}
      <div className="sdm-brand">
        <span className="sdm-logo" aria-hidden="true">
          SDM
        </span>
        <span className="sdm-app-name">{appName}</span>
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
            <SearchIcon size={14} />
            <span className="sdm-cmdk-hint-keys" aria-hidden="true">
              <kbd>⌘</kbd>
              <kbd>K</kbd>
            </span>
          </button>
          <span className="sdm-theme-toggle-slot" data-testid="portal-theme-toggle">
            <ThemeToggle
              value={choice}
              onChange={setChoice}
              aria-label={themeToggleLabel(choice, t)}
            />
          </span>
          <button
            type="button"
            className="sdm-notif-button"
            data-testid="notif-button"
            aria-label={notificationLabel}
            title={t("nav.notifications")}
          >
            <BellIcon size={18} />
            {notificationCount > 0 && (
              <span className="sdm-notif-count" aria-hidden="true">
                {notificationCount > 99 ? "99+" : notificationCount}
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
