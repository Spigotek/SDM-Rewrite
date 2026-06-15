import { useCallback, useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { NavLink, Avatar, ThemeToggle, useTheme } from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";
import { ChevronDown, ChevronRight, Eye, Info, Search, Settings } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { getConfig } from "../bootstrap/config";
import { openWorkspaceCommandPalette } from "./command-palette-mount";
import { LanguageSwitcher } from "./language-switcher";
import {
  visibleNavFor,
  type GroupKey,
  type VisibleRailGroup,
  type VisibleRailItem,
} from "./nav-model";
import { useSession } from "./session-context";
import { TenantSwitcher } from "./tenant-switcher";

const STORAGE_PREFIX = "sdm.workspace.rail.";

function readStoredOpen(key: GroupKey, defaultOpen: boolean): boolean {
  if (typeof localStorage === "undefined") return defaultOpen;
  const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
  if (raw === "true") return true;
  if (raw === "false") return false;
  return defaultOpen;
}

function writeStoredOpen(key: GroupKey, open: boolean): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(`${STORAGE_PREFIX}${key}`, open ? "true" : "false");
}

/**
 * Active-link matcher — mirrors the K.2 NavRow behaviour. The first segment
 * of `href` determines the active root; we ignore query strings here because
 * `?view=` filters live within the same route and would otherwise flicker the
 * underline as the agent switches saved views.
 */
function isActive(pathname: string, href: string): boolean {
  const [path] = href.split("?");
  if (!path) return false;
  if (path === "/queue") {
    return (
      pathname === "/queue" ||
      pathname.startsWith("/queue/") ||
      pathname === "/tickets" ||
      pathname.startsWith("/tickets/")
    );
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}

interface RailLinkProps {
  item: VisibleRailItem;
  active: boolean;
  label: string;
  help: string;
  readonlyLabel: string;
}

function RailLink({ item, active, label, help, readonlyLabel }: RailLinkProps) {
  const navigate = useNavigate();
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    navigate(item.href);
  };
  const accessibleLabel = item.isReadonly
    ? help
      ? `${label} — ${help} (${readonlyLabel})`
      : `${label} (${readonlyLabel})`
    : help
      ? `${label} — ${help}`
      : label;
  return (
    <li
      className="sdm-rail-item"
      data-testid={`workspace-rail-item-${item.slug}`}
      data-readonly={item.isReadonly ? "true" : undefined}
    >
      <NavLink
        href={item.href}
        label={label}
        icon={<item.icon size={16} aria-hidden="true" />}
        variant="vertical"
        active={active}
        onClick={handleClick}
        title={help}
        aria-label={accessibleLabel}
      />
      {item.isReadonly && (
        <span
          className="sdm-rail-item-readonly-badge"
          data-testid={`workspace-rail-item-readonly-${item.slug}`}
          title={readonlyLabel}
          aria-hidden="true"
        >
          <Eye size={12} />
        </span>
      )}
    </li>
  );
}

interface RailGroupSectionProps {
  group: VisibleRailGroup;
  pathname: string;
  open: boolean;
  onToggle: () => void;
}

function RailGroupSection({ group, pathname, open, onToggle }: RailGroupSectionProps) {
  const { t } = useTranslation("workspace");
  const groupLabel = t(group.labelKey);
  const groupHelp = t(group.helpKey);
  const toggleLabel = open
    ? t("nav.rail.collapseGroup", { name: groupLabel })
    : t("nav.rail.expandGroup", { name: groupLabel });
  return (
    <section className="sdm-rail-group" data-open={open ? "true" : "false"}>
      <div className="sdm-rail-group-headerrow">
        <button
          type="button"
          className="sdm-rail-group-header"
          data-testid={`workspace-rail-group-${group.slug}`}
          aria-expanded={open}
          aria-label={toggleLabel}
          onClick={onToggle}
        >
          <span className="sdm-rail-group-chevron" aria-hidden="true">
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          <span className="sdm-rail-group-label">{groupLabel}</span>
        </button>
        <button
          type="button"
          className="sdm-rail-group-help"
          data-testid={`workspace-rail-group-help-${group.slug}`}
          aria-label={t("nav.rail.groupHelp", { name: groupLabel, description: groupHelp })}
          title={groupHelp}
          onClick={(event) => event.currentTarget.blur()}
        >
          <Info size={13} aria-hidden="true" />
        </button>
      </div>
      {open && (
        <ul className="sdm-rail-list">
          {group.items.map((item) => (
            <RailLink
              key={item.slug}
              item={item}
              active={isActive(pathname, item.href)}
              label={t(item.labelKey)}
              help={t(`nav.help.${item.slug}`)}
              readonlyLabel={t("nav.rail.readonly")}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

interface UserMenuProps {
  displayName: string;
  onSignOut: () => void;
}

function UserMenu({ displayName, onSignOut }: UserMenuProps) {
  const { t } = useTranslation("workspace");
  const { choice, setChoice } = useTheme();
  const [open, setOpen] = useState(false);

  // Close on outside click — the rail is the entire left column so we anchor
  // the dropdown above the trigger and dismiss on any document click outside.
  useEffect(() => {
    if (!open) return;
    function onDocClick(event: globalThis.MouseEvent) {
      const target = event.target as Node | null;
      const root = document.querySelector(".sdm-rail-user-menu");
      if (root && target && !root.contains(target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div className="sdm-rail-user-menu" data-open={open ? "true" : "false"}>
      {open && (
        <div className="sdm-rail-user-popover" role="menu">
          <div className="sdm-rail-user-popover-row">
            <span className="sdm-rail-user-popover-label">{t("nav.userMenu.themeToggle")}</span>
            <ThemeToggle value={choice} onChange={setChoice} />
          </div>
          <div className="sdm-rail-user-popover-row">
            <span className="sdm-rail-user-popover-label">{t("nav.userMenu.language")}</span>
            <LanguageSwitcher />
          </div>
          <button
            type="button"
            className="sdm-rail-user-popover-item"
            data-testid="logout-button"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            role="menuitem"
          >
            {t("nav.userMenu.signOut")}
          </button>
        </div>
      )}
      <button
        type="button"
        className="sdm-rail-user-trigger"
        data-testid="user-pill"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("shell.userMenuLabel")}
        onClick={() => setOpen((value) => !value)}
      >
        <Avatar name={displayName} size="sm" aria-label={displayName} />
        <span className="sdm-rail-user-name">{displayName}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

export function LeftRail() {
  const { t } = useTranslation("workspace");
  const { pathname } = useLocation();
  const { session, logout } = useSession();

  // v1.7.0 — the rail is a pure projection of the role-driven nav model.
  // `applySwitchedSession` swaps `session.roles` on role switch and re-renders
  // the SessionProvider, so this memo recomputes and the rail follows the
  // active role (the v1.6.0 bug was the rail ignoring roles entirely).
  const groups = useMemo(
    () => visibleNavFor(session?.roles ?? [], getConfig().features),
    [session?.roles],
  );

  // Open-state is keyed on the group key but derived from the *currently
  // visible* groups — a group can vanish per role, so a missing key falls back
  // to its `defaultOpen`.
  const [openState, setOpenState] = useState<Partial<Record<GroupKey, boolean>>>({});

  useEffect(() => {
    setOpenState((prev) => {
      const next: Partial<Record<GroupKey, boolean>> = {};
      for (const group of groups) {
        next[group.key] = prev[group.key] ?? readStoredOpen(group.key, group.defaultOpen);
      }
      return next;
    });
  }, [groups]);

  const toggleGroup = useCallback((key: GroupKey) => {
    setOpenState((prev) => {
      const next = !prev[key];
      writeStoredOpen(key, next);
      return { ...prev, [key]: next };
    });
  }, []);

  const displayName = session?.displayName ?? "";

  const isGroupOpen = useCallback(
    (group: VisibleRailGroup): boolean => openState[group.key] ?? group.defaultOpen,
    [openState],
  );

  return (
    <aside
      className="sdm-left-rail"
      data-testid="workspace-left-rail"
      aria-label={t("nav.primary")}
    >
      <div className="sdm-rail-header">
        <TenantSwitcher />
        <button
          type="button"
          className="sdm-rail-cmdk"
          onClick={openWorkspaceCommandPalette}
          aria-label={t("nav.cmdkHint")}
          title={t("nav.cmdkHint")}
        >
          <Search size={14} aria-hidden="true" />
          <span className="sdm-rail-cmdk-label">{t("nav.cmdkHint")}</span>
          <span className="sdm-rail-cmdk-keys" aria-hidden="true">
            <kbd>⌘</kbd>
            <kbd>K</kbd>
          </span>
        </button>
      </div>
      <nav className="sdm-rail-nav">
        {groups.map((group) => (
          <RailGroupSection
            key={group.key}
            group={group}
            pathname={pathname}
            open={isGroupOpen(group)}
            onToggle={() => toggleGroup(group.key)}
          />
        ))}
      </nav>
      <div className="sdm-rail-footer">
        <a
          href="/settings"
          className="sdm-rail-footer-link"
          onClick={(event) => {
            event.preventDefault();
            console.info("[workspace] Settings — coming later in v1.2");
          }}
        >
          <Settings size={16} aria-hidden="true" />
          <span>{t("nav.settings")}</span>
        </a>
        {session && <UserMenu displayName={displayName} onSignOut={() => void logout()} />}
      </div>
    </aside>
  );
}
