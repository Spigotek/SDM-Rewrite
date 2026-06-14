import { useCallback, useEffect, useMemo, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { NavLink, Avatar, ThemeToggle, useTheme } from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";
import {
  AlertTriangle,
  BookOpen,
  Box,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Clipboard,
  ClipboardList,
  Clock,
  GitBranch,
  Inbox,
  PauseCircle,
  Play,
  Search,
  Settings,
  ShieldQuestion,
  Star,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { openWorkspaceCommandPalette } from "./command-palette-mount";
import { LanguageSwitcher } from "./language-switcher";
import { useSession } from "./session-context";
import { TenantSwitcher } from "./tenant-switcher";

type GroupKey = "TOP" | "INCIDENTS" | "CHANGES" | "KNOWLEDGE" | "CMDB";

interface RailItem {
  readonly href: string;
  readonly slug: string;
  readonly labelKey: string;
  readonly icon: ReactNode;
}

interface RailGroup {
  readonly key: GroupKey;
  readonly labelKey: string;
  readonly items: readonly RailItem[];
  readonly defaultOpen: boolean;
}

/**
 * Rail-item hrefs use the same URL filter contract as the `/queue` and `/changes`
 * routes (`?status=…`, `?assignee=…`, `?scope=…`). Logical status names — `new`,
 * `in_progress`, `waiting_customer`, etc. — are resolved against the row's CA
 * SDM code by `statusMatchesFilter` (see `features/queue/hooks.ts`) so clicking
 * the rail and a `FilterBar` chip compose AND, not replace. Stub query keys
 * (`scope=inbox`, `starred=true`, `assignee=me`) hit the queue but are not yet
 * honoured by the BFF — the table still renders, just without further filtering.
 */
const GROUPS: readonly RailGroup[] = [
  {
    key: "TOP",
    labelKey: "nav.groups.top",
    defaultOpen: true,
    items: [
      {
        href: "/queue?scope=inbox",
        slug: "inbox",
        labelKey: "nav.items.inbox",
        icon: <Inbox size={16} aria-hidden="true" />,
      },
      {
        href: "/queue?assignee=me",
        slug: "myqueue",
        labelKey: "nav.queue",
        icon: <Clock size={16} aria-hidden="true" />,
      },
      {
        href: "/queue?starred=true",
        slug: "starred",
        labelKey: "nav.items.starred",
        icon: <Star size={16} aria-hidden="true" />,
      },
    ],
  },
  {
    key: "INCIDENTS",
    labelKey: "nav.groups.incidents",
    defaultOpen: true,
    items: [
      {
        href: "/queue?status=new",
        slug: "triage",
        labelKey: "nav.items.triage",
        icon: <ClipboardList size={16} aria-hidden="true" />,
      },
      {
        href: "/queue?status=in_progress",
        slug: "in-progress",
        labelKey: "nav.items.inProgress",
        icon: <Play size={16} aria-hidden="true" />,
      },
      {
        href: "/queue?status=waiting_customer,waiting_vendor,hold",
        slug: "on-hold",
        labelKey: "nav.items.onHold",
        icon: <PauseCircle size={16} aria-hidden="true" />,
      },
      {
        href: "/queue?status=resolved,closed",
        slug: "resolved",
        labelKey: "nav.items.resolved",
        icon: <Clipboard size={16} aria-hidden="true" />,
      },
      {
        href: "/problems",
        slug: "problems",
        labelKey: "nav.problems",
        icon: <AlertTriangle size={16} aria-hidden="true" />,
      },
    ],
  },
  {
    key: "CHANGES",
    labelKey: "nav.groups.changes",
    defaultOpen: true,
    items: [
      {
        // CHANGES filter uses raw CA SDM codes; `APPR_PENDING` / `SCHEDULED`
        // are the canonical change-status values (see `features/changes/hooks.ts`).
        href: "/changes?status=APPR_PENDING",
        slug: "pending-approval",
        labelKey: "nav.items.pendingApproval",
        icon: <ShieldQuestion size={16} aria-hidden="true" />,
      },
      {
        href: "/changes?status=SCHEDULED",
        slug: "scheduled",
        labelKey: "nav.items.scheduled",
        icon: <GitBranch size={16} aria-hidden="true" />,
      },
      {
        href: "/changes/calendar",
        slug: "calendar",
        labelKey: "nav.items.calendar",
        icon: <CalendarClock size={16} aria-hidden="true" />,
      },
    ],
  },
  {
    key: "KNOWLEDGE",
    labelKey: "nav.groups.knowledge",
    defaultOpen: false,
    items: [
      {
        href: "/kb",
        slug: "kb",
        labelKey: "nav.kb",
        icon: <BookOpen size={16} aria-hidden="true" />,
      },
    ],
  },
  {
    key: "CMDB",
    labelKey: "nav.groups.cmdb",
    defaultOpen: false,
    items: [
      {
        href: "/cmdb",
        slug: "cmdb",
        labelKey: "nav.cmdb",
        icon: <Box size={16} aria-hidden="true" />,
      },
    ],
  },
];

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
  item: RailItem;
  active: boolean;
  label: string;
}

function RailLink({ item, active, label }: RailLinkProps) {
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
  return (
    <li className="sdm-rail-item" data-testid={`workspace-rail-item-${item.slug}`}>
      <NavLink
        href={item.href}
        label={label}
        icon={item.icon}
        variant="vertical"
        active={active}
        onClick={handleClick}
      />
    </li>
  );
}

interface RailGroupSectionProps {
  group: RailGroup;
  pathname: string;
  open: boolean;
  onToggle: () => void;
}

function RailGroupSection({ group, pathname, open, onToggle }: RailGroupSectionProps) {
  const { t } = useTranslation("workspace");
  const groupLabel = t(group.labelKey);
  const toggleLabel = open
    ? t("nav.rail.collapseGroup", { name: groupLabel })
    : t("nav.rail.expandGroup", { name: groupLabel });
  return (
    <section className="sdm-rail-group" data-open={open ? "true" : "false"}>
      <button
        type="button"
        className="sdm-rail-group-header"
        data-testid={`workspace-rail-group-${group.key.toLowerCase()}`}
        aria-expanded={open}
        aria-label={toggleLabel}
        onClick={onToggle}
      >
        <span className="sdm-rail-group-chevron" aria-hidden="true">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <span className="sdm-rail-group-label">{groupLabel}</span>
      </button>
      {open && (
        <ul className="sdm-rail-list">
          {group.items.map((item) => (
            <RailLink
              key={item.slug}
              item={item}
              active={isActive(pathname, item.href)}
              label={t(item.labelKey)}
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

  const [openState, setOpenState] = useState<Record<GroupKey, boolean>>(() => {
    const initial = {} as Record<GroupKey, boolean>;
    for (const group of GROUPS) {
      initial[group.key] = readStoredOpen(group.key, group.defaultOpen);
    }
    return initial;
  });

  const toggleGroup = useCallback((key: GroupKey) => {
    setOpenState((prev) => {
      const next = !prev[key];
      writeStoredOpen(key, next);
      return { ...prev, [key]: next };
    });
  }, []);

  const displayName = session?.displayName ?? "";

  // Group list is stable across renders but route changes still need a
  // re-evaluation of `isActive` per item. Memoising the rendered groups also
  // keeps React from rebuilding the lucide icon trees on unrelated state changes.
  const renderedGroups = useMemo(
    () =>
      GROUPS.map((group) => (
        <RailGroupSection
          key={group.key}
          group={group}
          pathname={pathname}
          open={openState[group.key]}
          onToggle={() => toggleGroup(group.key)}
        />
      )),
    [pathname, openState, toggleGroup],
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
      <nav className="sdm-rail-nav">{renderedGroups}</nav>
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
