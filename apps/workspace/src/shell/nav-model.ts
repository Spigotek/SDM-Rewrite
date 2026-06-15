/**
 * v1.7.0 — role-driven workspace navigation model.
 *
 * **Single source of truth** for the left-rail AND the command palette nav
 * actions. The rail is organised by CA SDM functional tabs (Service Desk /
 * Change / Knowledge / CMDB / Administration / Reports) so operators see the
 * vocabulary they already know, and each item is gated against the existing
 * RBAC permission matrix (`@sdm/domain` `permissions.ts`) — no BFF/CA SDM
 * change is needed because `/me` already returns `roles` + `effectivePermissions`.
 *
 * Visibility rules (see `visibleNavFor`):
 *  - An item is shown when ALL of its declared gates pass (AND):
 *      `requiredScreen` → screen is not `hidden` for the user's roles,
 *      `requiredPermission` → at least one role holds it,
 *      `requiredFeature` → the runtime feature flag is on.
 *  - An item gated by a `requiredScreen` that resolves to `readonly` is shown
 *    with `isReadonly: true` (the rail paints a `data-readonly` badge; the
 *    route itself renders read-only).
 *  - A group is shown only when it has at least one visible item — empty
 *    groups are dropped.
 *
 * Critical correction (verified against `routes/index.tsx`): the matrix `route`
 * strings are NOT the real router paths. Menu items therefore gate via
 * `ScreenId`/`Permission` but their `href` points at the real route
 * (`/queue?…`, `/changes?…`, `/sp/cockpit`, …). The two are intentionally
 * decoupled. Routes that do not exist yet (Reports) are additionally gated on
 * a feature flag so they stay dark — no dead links.
 */

import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Box,
  Building2,
  CalendarClock,
  Clipboard,
  ClipboardList,
  Gavel,
  GitBranch,
  Inbox,
  LineChart,
  PauseCircle,
  Play,
  ShieldQuestion,
  SquarePen,
  type LucideIcon,
} from "lucide-react";
import {
  getScreenVisibilityForRoles,
  hasPermission,
  type Permission,
  type ScreenId,
  type UIRole,
} from "@sdm/domain";
import type { FeatureFlags } from "../bootstrap/config";

export type GroupKey = "SERVICE_DESK" | "CHANGE" | "KNOWLEDGE" | "CMDB" | "ADMIN" | "REPORTS";

export interface RailItem {
  /** Stable identifier — drives the testid (`workspace-rail-item-<slug>`) and
   *  the per-item help key (`nav.help.<slug>`). */
  readonly slug: string;
  /** i18n key for the visible label. */
  readonly labelKey: string;
  /** Real router href (NOT the matrix `route` string). */
  readonly href: string;
  /** Lucide icon component — rendered by the consumer, kept as a component
   *  reference so this module stays JSX-free and unit-testable. */
  readonly icon: LucideIcon;
  /** Screen visibility gate — item hidden when screen is `hidden`, shown with
   *  `isReadonly` when `readonly`. */
  readonly requiredScreen?: ScreenId;
  /** Permission gate — used for routes without a matrix screen (e.g. KB browse). */
  readonly requiredPermission?: Permission;
  /** Runtime feature-flag gate — keeps routeless items (Reports) dark. */
  readonly requiredFeature?: keyof FeatureFlags;
}

export interface RailGroup {
  readonly key: GroupKey;
  /** Kebab slug for the group testid (`workspace-rail-group-<slug>`). */
  readonly slug: string;
  readonly labelKey: string;
  readonly helpKey: string;
  readonly defaultOpen: boolean;
  readonly items: readonly RailItem[];
}

/**
 * Functional-tab nav model. Hrefs reuse the established `/queue` + `/changes`
 * URL filter contract (`?status=…`, `?scope=…`) so a rail click and a
 * `FilterBar` chip compose AND, not replace (see `features/queue/hooks.ts`).
 */
export const NAV_GROUPS: readonly RailGroup[] = [
  {
    key: "SERVICE_DESK",
    slug: "service-desk",
    labelKey: "nav.groups.serviceDesk",
    helpKey: "nav.groups.help.serviceDesk",
    defaultOpen: true,
    items: [
      {
        slug: "myqueue",
        labelKey: "nav.queue",
        href: "/queue?assignee=me",
        icon: Inbox,
        requiredScreen: "WORKSPACE_INCIDENT_QUEUE",
      },
      {
        slug: "triage",
        labelKey: "nav.items.triage",
        href: "/queue?status=new",
        icon: ClipboardList,
        requiredScreen: "WORKSPACE_INCIDENT_QUEUE",
      },
      {
        slug: "in-progress",
        labelKey: "nav.items.inProgress",
        href: "/queue?status=in_progress",
        icon: Play,
        requiredScreen: "WORKSPACE_INCIDENT_QUEUE",
      },
      {
        slug: "on-hold",
        labelKey: "nav.items.onHold",
        href: "/queue?status=waiting_customer,waiting_vendor,hold",
        icon: PauseCircle,
        requiredScreen: "WORKSPACE_INCIDENT_QUEUE",
      },
      {
        slug: "resolved",
        labelKey: "nav.items.resolved",
        href: "/queue?status=resolved,closed",
        icon: Clipboard,
        requiredScreen: "WORKSPACE_INCIDENT_QUEUE",
      },
      {
        slug: "problems",
        labelKey: "nav.problems",
        href: "/problems",
        icon: AlertTriangle,
        requiredScreen: "WORKSPACE_PROBLEM_LIST",
      },
    ],
  },
  {
    key: "CHANGE",
    slug: "change",
    labelKey: "nav.groups.change",
    helpKey: "nav.groups.help.change",
    defaultOpen: true,
    items: [
      {
        slug: "pending-approval",
        labelKey: "nav.items.pendingApproval",
        href: "/changes?status=APPR_PENDING",
        icon: ShieldQuestion,
        requiredScreen: "WORKSPACE_CHANGE_LIST",
      },
      {
        slug: "scheduled",
        labelKey: "nav.items.scheduled",
        href: "/changes?status=SCHEDULED",
        icon: GitBranch,
        requiredScreen: "WORKSPACE_CHANGE_LIST",
      },
      {
        slug: "calendar",
        labelKey: "nav.items.calendar",
        href: "/changes/calendar",
        icon: CalendarClock,
        requiredScreen: "WORKSPACE_CHANGE_CALENDAR",
      },
      {
        // No `/cab` route exists — CAB is a scoped filter over `/changes`.
        slug: "cab",
        labelKey: "nav.items.cab",
        href: "/changes?status=APPR_PENDING&scope=cab",
        icon: Gavel,
        requiredScreen: "WORKSPACE_CAB_QUEUE",
      },
    ],
  },
  {
    key: "KNOWLEDGE",
    slug: "knowledge",
    labelKey: "nav.groups.knowledge",
    helpKey: "nav.groups.help.knowledge",
    defaultOpen: false,
    items: [
      {
        slug: "browse-kb",
        labelKey: "nav.items.browseKb",
        href: "/kb",
        icon: BookOpen,
        requiredPermission: "kb.search",
      },
      {
        slug: "manage-kb",
        labelKey: "nav.items.manageKb",
        href: "/kb/editor",
        icon: SquarePen,
        requiredScreen: "WORKSPACE_KB_MANAGE",
      },
      {
        slug: "kb-analytics",
        labelKey: "nav.items.kbAnalytics",
        href: "/kb/analytics",
        icon: LineChart,
        requiredScreen: "WORKSPACE_KB_ANALYTICS",
      },
    ],
  },
  {
    key: "CMDB",
    slug: "cmdb",
    labelKey: "nav.groups.cmdb",
    helpKey: "nav.groups.help.cmdb",
    defaultOpen: false,
    items: [
      {
        slug: "cmdb",
        labelKey: "nav.items.configItems",
        href: "/cmdb",
        icon: Box,
        requiredScreen: "WORKSPACE_CMDB_LIST",
      },
    ],
  },
  {
    key: "ADMIN",
    slug: "admin",
    labelKey: "nav.groups.admin",
    helpKey: "nav.groups.help.admin",
    defaultOpen: false,
    items: [
      {
        // `/sp/cockpit` is the only real admin route today.
        slug: "service-provider",
        labelKey: "nav.items.serviceProvider",
        href: "/sp/cockpit",
        icon: Building2,
        requiredScreen: "WORKSPACE_TENANT_ADMIN",
      },
    ],
  },
  {
    key: "REPORTS",
    slug: "reports",
    labelKey: "nav.groups.reports",
    helpKey: "nav.groups.help.reports",
    defaultOpen: false,
    items: [
      {
        // No `/reports` route yet — gated on the feature flag so it stays dark
        // (no dead link) until the route lands.
        slug: "reports",
        labelKey: "nav.items.reports",
        href: "/reports",
        icon: BarChart3,
        requiredScreen: "WORKSPACE_REPORTS",
        requiredFeature: "reportingWidgets",
      },
    ],
  },
];

export interface VisibleRailItem extends RailItem {
  readonly isReadonly: boolean;
}

export interface VisibleRailGroup {
  readonly key: GroupKey;
  readonly slug: string;
  readonly labelKey: string;
  readonly helpKey: string;
  readonly defaultOpen: boolean;
  readonly items: readonly VisibleRailItem[];
}

function evaluateItem(
  item: RailItem,
  roles: readonly UIRole[],
  features: FeatureFlags,
): VisibleRailItem | null {
  if (item.requiredFeature && !features[item.requiredFeature]) return null;
  if (item.requiredPermission && !hasPermission(roles, item.requiredPermission)) return null;

  let isReadonly = false;
  if (item.requiredScreen) {
    const visibility = getScreenVisibilityForRoles(roles, item.requiredScreen);
    if (visibility === "hidden") return null;
    isReadonly = visibility === "readonly";
  }

  return { ...item, isReadonly };
}

/**
 * Pure projection of `NAV_GROUPS` for a given session. Drops hidden items and
 * empty groups, and annotates each surviving item with `isReadonly`. This is
 * the contract consumed by both the left-rail and the command palette.
 */
export function visibleNavFor(
  roles: readonly UIRole[],
  features: FeatureFlags,
): readonly VisibleRailGroup[] {
  const out: VisibleRailGroup[] = [];
  for (const group of NAV_GROUPS) {
    const items: VisibleRailItem[] = [];
    for (const item of group.items) {
      const evaluated = evaluateItem(item, roles, features);
      if (evaluated) items.push(evaluated);
    }
    if (items.length === 0) continue;
    out.push({
      key: group.key,
      slug: group.slug,
      labelKey: group.labelKey,
      helpKey: group.helpKey,
      defaultOpen: group.defaultOpen,
      items,
    });
  }
  return out;
}
