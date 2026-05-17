/**
 * RBAC mapping — UI rola → permissions + screen visibility.
 *
 * Source of truth: `docs/agents/security/rbac.md` (round 2).
 *  - §2 — UI rola enumerácia (7 + `requester_external` subtype).
 *  - §4 — 31 obrazoviek (route + permission key).
 *  - §5 — Screen visibility matica per rola (✓ / ▣ / ✗).
 *  - §6 — Action permission matica per modul.
 *
 * Princíp 4 rbac.md: BFF **vždy** re-validuje na mutáciách. Tieto helpery
 * sú UX optimalizácia (hide / disable), nie security gate.
 */
import type { Permission, UIRole } from "./model";

// =============================================================================
// Role → permissions mapping (rbac.md §6)
// =============================================================================

const REQUESTER_PERMISSIONS: readonly Permission[] = [
  "app.portal.access",
  "ticket.create.own",
  "ticket.read.own",
  "catalog.browse",
  "catalog.request",
  "incident.create",
  "incident.read.own",
  "incident.attach.add",
  "incident.comment.public",
  "incident.reopen", // own, 7-day window — enforced server-side
  "request.create",
  "request.read.own",
  "request.approve", // only if assigned approver — enforced server-side
  "request.reject",
  "request.cancel.own",
  "kb.read.public",
  "kb.search",
  "kb.rate",
];

const AGENT_L1_PERMISSIONS: readonly Permission[] = [
  "app.workspace.access",
  "incident.create",
  "incident.read.own",
  "incident.read.queue",
  "incident.update.fields",
  "incident.transition.status",
  "incident.assign",
  "incident.escalate",
  "incident.attach.add",
  "incident.comment.private",
  "incident.comment.public",
  "incident.close",
  "incident.reopen",
  "incident.bulk",
  "request.create",
  "request.read.own",
  "request.read.queue",
  "request.approve",
  "request.fulfill",
  "request.reject",
  "request.cancel.own",
  "kb.read.public",
  "kb.read.internal",
  "kb.search",
  "kb.rate",
  "ci.search",
  "reports.read",
];

const AGENT_L2_PERMISSIONS: readonly Permission[] = [
  ...AGENT_L1_PERMISSIONS,
  "incident.read.all",
  "incident.link.problem",
  "problem.create",
  "problem.read",
  "problem.update.rca",
  "problem.link.incidents",
  "problem.mark.known-error",
  "problem.close",
  "problem.spawn.kb",
  "change.create", // limited categories — server-side
  "change.update.plan", // own — server-side
  "kb.create.draft",
  "kb.write",
  "kb.submit.review",
  "ci.impact",
];

const CHANGE_MANAGER_PERMISSIONS: readonly Permission[] = [
  "app.workspace.access",
  "change.create",
  "change.read",
  "change.update.plan",
  "change.schedule",
  "change.submit.cab",
  "cab.approve",
  "cab.approve.emergency",
  "cab.reject",
  "change.read.calendar",
  "change.close",
  "kb.read.public",
  "kb.read.internal",
  "kb.search",
  "kb.rate",
  "ci.search",
  "ci.impact",
  "reports.read",
];

const KB_EDITOR_PERMISSIONS: readonly Permission[] = [
  "app.workspace.access",
  "kb.read.public",
  "kb.read.internal",
  "kb.search",
  "kb.rate",
  "kb.create.draft",
  "kb.write",
  "kb.submit.review",
  "kb.approve",
  "kb.archive",
  "kb.manage",
  "kb.analytics",
  "kb.taxonomy",
  "reports.read",
];

const CMDB_OWNER_PERMISSIONS: readonly Permission[] = [
  "app.workspace.access",
  "ci.read",
  "ci.read.relationships",
  "ci.search",
  "ci.impact",
  "ci.create",
  "ci.update",
  "change.update.plan", // for CI-related changes
  "kb.read.public",
  "kb.read.internal",
  "kb.search",
  "kb.rate",
  "reports.read",
];

const SP_ADMIN_PERMISSIONS: readonly Permission[] = [
  "app.workspace.access",
  // Incident — full
  "incident.create",
  "incident.read.own",
  "incident.read.queue",
  "incident.read.all",
  "incident.update.fields",
  "incident.transition.status",
  "incident.assign",
  "incident.escalate",
  "incident.link.problem",
  "incident.attach.add",
  "incident.comment.private",
  "incident.comment.public",
  "incident.close",
  "incident.reopen",
  "incident.bulk",
  "incident.delete",
  // Request — full
  "request.create",
  "request.read.own",
  "request.read.queue",
  "request.approve",
  "request.fulfill",
  "request.reject",
  "request.cancel.own",
  // Problem — full
  "problem.create",
  "problem.read",
  "problem.update.rca",
  "problem.link.incidents",
  "problem.mark.known-error",
  "problem.close",
  "problem.spawn.kb",
  // Change — full
  "change.create",
  "change.read",
  "change.update.plan",
  "change.schedule",
  "change.submit.cab",
  "cab.approve",
  "cab.approve.emergency",
  "cab.reject",
  "change.read.calendar",
  "change.read.calendar.cross-tenant",
  "change.close",
  // KB — full
  "kb.read.public",
  "kb.read.internal",
  "kb.search",
  "kb.rate",
  "kb.create.draft",
  "kb.write",
  "kb.submit.review",
  "kb.approve",
  "kb.archive",
  "kb.manage",
  "kb.analytics",
  "kb.taxonomy",
  // CMDB — full + cross-tenant
  "ci.read",
  "ci.read.relationships",
  "ci.search",
  "ci.impact",
  "ci.create",
  "ci.update",
  "ci.read.cross-tenant",
  // Admin / reports / audit
  "tenant.admin",
  "tenant.admin.list",
  "tenant.admin.update",
  "tenant.admin.roles",
  "audit.read",
  "audit.export",
  "reports.read",
  "reports.export",
];

const ROLE_PERMISSIONS: Readonly<Record<UIRole, readonly Permission[]>> = {
  requester: REQUESTER_PERMISSIONS,
  requester_external: REQUESTER_PERMISSIONS, // BFF aplikuje restricted_share_flag filter
  agent_l1: AGENT_L1_PERMISSIONS,
  agent_l2: AGENT_L2_PERMISSIONS,
  change_manager: CHANGE_MANAGER_PERMISSIONS,
  kb_editor: KB_EDITOR_PERMISSIONS,
  cmdb_owner: CMDB_OWNER_PERMISSIONS,
  sp_admin: SP_ADMIN_PERMISSIONS,
};

export const getPermissionsForRole = (role: UIRole): readonly Permission[] =>
  ROLE_PERMISSIONS[role];

export const hasPermission = (roles: readonly UIRole[], permission: Permission): boolean =>
  roles.some((role) => ROLE_PERMISSIONS[role].includes(permission));

// =============================================================================
// Screen visibility — rbac.md §4 + §5
// =============================================================================

export type ScreenId =
  // Portal (rbac.md §4 #1-8, 26-28)
  | "PORTAL_HOME"
  | "PORTAL_SUBMIT_TICKET"
  | "PORTAL_MY_TICKETS"
  | "PORTAL_TICKET_DETAIL"
  | "PORTAL_KB_BROWSE"
  | "PORTAL_KB_ARTICLE"
  | "PORTAL_CATALOG"
  | "PORTAL_CATALOG_ITEM"
  | "PORTAL_NOTIFICATIONS"
  | "PORTAL_PROFILE"
  | "PORTAL_ONBOARDING"
  // Workspace (rbac.md §4 #9-25, 29-31)
  | "WORKSPACE_DASHBOARD"
  | "WORKSPACE_INCIDENT_QUEUE"
  | "WORKSPACE_INCIDENT_DETAIL"
  | "WORKSPACE_PROBLEM_LIST"
  | "WORKSPACE_PROBLEM_DETAIL"
  | "WORKSPACE_CHANGE_LIST"
  | "WORKSPACE_CHANGE_DETAIL"
  | "WORKSPACE_CHANGE_CALENDAR"
  | "WORKSPACE_CAB_QUEUE"
  | "WORKSPACE_KB_MANAGE"
  | "WORKSPACE_KB_EDITOR"
  | "WORKSPACE_KB_ANALYTICS"
  | "WORKSPACE_CMDB_LIST"
  | "WORKSPACE_CI_DETAIL"
  | "WORKSPACE_CI_IMPACT"
  | "WORKSPACE_TENANT_ADMIN"
  | "WORKSPACE_REPORTS"
  | "WORKSPACE_PROFILE"
  | "WORKSPACE_SETTINGS"
  | "WORKSPACE_CAB_MEETING";

export type ScreenVisibility = "visible" | "readonly" | "hidden";

interface ScreenSpec {
  readonly route: string;
  readonly app: "portal" | "workspace";
  readonly visibility: Readonly<Record<UIRole, ScreenVisibility>>;
}

// Helper aliases for compactness in the spec table.
const V: ScreenVisibility = "visible";
const R: ScreenVisibility = "readonly";
const H: ScreenVisibility = "hidden";

const portalDefault = (req: ScreenVisibility): Record<UIRole, ScreenVisibility> => ({
  requester: req,
  requester_external: req,
  agent_l1: H,
  agent_l2: H,
  change_manager: H,
  kb_editor: H,
  cmdb_owner: H,
  sp_admin: H,
});

const SCREENS: Readonly<Record<ScreenId, ScreenSpec>> = {
  // ---- Portal ------------------------------------------------------------
  PORTAL_HOME: { route: "/", app: "portal", visibility: portalDefault(V) },
  PORTAL_SUBMIT_TICKET: { route: "/submit", app: "portal", visibility: portalDefault(V) },
  PORTAL_MY_TICKETS: { route: "/my-tickets", app: "portal", visibility: portalDefault(V) },
  PORTAL_TICKET_DETAIL: {
    route: "/my-tickets/:ref",
    app: "portal",
    visibility: portalDefault(V),
  },
  PORTAL_KB_BROWSE: { route: "/kb", app: "portal", visibility: portalDefault(V) },
  PORTAL_KB_ARTICLE: { route: "/kb/:slug", app: "portal", visibility: portalDefault(V) },
  PORTAL_CATALOG: { route: "/catalog", app: "portal", visibility: portalDefault(V) },
  PORTAL_CATALOG_ITEM: {
    route: "/catalog/:id",
    app: "portal",
    visibility: portalDefault(V),
  },
  PORTAL_NOTIFICATIONS: {
    route: "/notifications",
    app: "portal",
    visibility: portalDefault(V),
  },
  PORTAL_PROFILE: { route: "/profile", app: "portal", visibility: portalDefault(V) },
  PORTAL_ONBOARDING: {
    route: "/onboarding",
    app: "portal",
    visibility: portalDefault(V),
  },
  // ---- Workspace ---------------------------------------------------------
  WORKSPACE_DASHBOARD: {
    route: "/",
    app: "workspace",
    visibility: {
      requester: H,
      requester_external: H,
      agent_l1: V,
      agent_l2: V,
      change_manager: V,
      kb_editor: V,
      cmdb_owner: V,
      sp_admin: V,
    },
  },
  WORKSPACE_INCIDENT_QUEUE: {
    route: "/incidents",
    app: "workspace",
    visibility: {
      requester: H,
      requester_external: H,
      agent_l1: V,
      agent_l2: V,
      change_manager: R,
      kb_editor: R,
      cmdb_owner: R,
      sp_admin: V,
    },
  },
  WORKSPACE_INCIDENT_DETAIL: {
    route: "/incidents/:ref",
    app: "workspace",
    visibility: {
      requester: H,
      requester_external: H,
      agent_l1: V,
      agent_l2: V,
      change_manager: R,
      kb_editor: R,
      cmdb_owner: R,
      sp_admin: V,
    },
  },
  WORKSPACE_PROBLEM_LIST: {
    route: "/problems",
    app: "workspace",
    visibility: {
      requester: H,
      requester_external: H,
      agent_l1: R,
      agent_l2: V,
      change_manager: R,
      kb_editor: R,
      cmdb_owner: R,
      sp_admin: V,
    },
  },
  WORKSPACE_PROBLEM_DETAIL: {
    route: "/problems/:ref",
    app: "workspace",
    visibility: {
      requester: H,
      requester_external: H,
      agent_l1: R,
      agent_l2: V,
      change_manager: R,
      kb_editor: R,
      cmdb_owner: R,
      sp_admin: V,
    },
  },
  WORKSPACE_CHANGE_LIST: {
    route: "/changes",
    app: "workspace",
    visibility: {
      requester: H,
      requester_external: H,
      agent_l1: R,
      agent_l2: R,
      change_manager: V,
      kb_editor: R,
      cmdb_owner: R,
      sp_admin: V,
    },
  },
  WORKSPACE_CHANGE_DETAIL: {
    route: "/changes/:ref",
    app: "workspace",
    visibility: {
      requester: H,
      requester_external: H,
      agent_l1: R,
      agent_l2: R,
      change_manager: V,
      kb_editor: R,
      cmdb_owner: R,
      sp_admin: V,
    },
  },
  WORKSPACE_CHANGE_CALENDAR: {
    route: "/changes/calendar",
    app: "workspace",
    visibility: {
      requester: H,
      requester_external: H,
      agent_l1: R,
      agent_l2: R,
      change_manager: V,
      kb_editor: H,
      cmdb_owner: R,
      sp_admin: V,
    },
  },
  WORKSPACE_CAB_QUEUE: {
    route: "/cab",
    app: "workspace",
    visibility: {
      requester: H,
      requester_external: H,
      agent_l1: H,
      agent_l2: H,
      change_manager: V,
      kb_editor: H,
      cmdb_owner: H,
      sp_admin: V,
    },
  },
  WORKSPACE_KB_MANAGE: {
    route: "/kb/manage",
    app: "workspace",
    visibility: {
      requester: H,
      requester_external: H,
      agent_l1: H,
      agent_l2: R,
      change_manager: H,
      kb_editor: V,
      cmdb_owner: H,
      sp_admin: V,
    },
  },
  WORKSPACE_KB_EDITOR: {
    route: "/kb/manage/:id",
    app: "workspace",
    visibility: {
      requester: H,
      requester_external: H,
      agent_l1: H,
      agent_l2: R,
      change_manager: H,
      kb_editor: V,
      cmdb_owner: H,
      sp_admin: V,
    },
  },
  WORKSPACE_KB_ANALYTICS: {
    route: "/kb/analytics",
    app: "workspace",
    visibility: {
      requester: H,
      requester_external: H,
      agent_l1: H,
      agent_l2: R,
      change_manager: H,
      kb_editor: V,
      cmdb_owner: H,
      sp_admin: V,
    },
  },
  WORKSPACE_CMDB_LIST: {
    route: "/cmdb",
    app: "workspace",
    visibility: {
      requester: H,
      requester_external: H,
      agent_l1: R,
      agent_l2: R,
      change_manager: R,
      kb_editor: H,
      cmdb_owner: V,
      sp_admin: V,
    },
  },
  WORKSPACE_CI_DETAIL: {
    route: "/cmdb/:id",
    app: "workspace",
    visibility: {
      requester: H,
      requester_external: H,
      agent_l1: R,
      agent_l2: R,
      change_manager: R,
      kb_editor: H,
      cmdb_owner: V,
      sp_admin: V,
    },
  },
  WORKSPACE_CI_IMPACT: {
    route: "/cmdb/:id/impact",
    app: "workspace",
    visibility: {
      requester: H,
      requester_external: H,
      agent_l1: R,
      agent_l2: R,
      change_manager: R,
      kb_editor: H,
      cmdb_owner: V,
      sp_admin: V,
    },
  },
  WORKSPACE_TENANT_ADMIN: {
    route: "/admin/tenants",
    app: "workspace",
    visibility: {
      requester: H,
      requester_external: H,
      agent_l1: H,
      agent_l2: H,
      change_manager: H,
      kb_editor: H,
      cmdb_owner: H,
      sp_admin: V,
    },
  },
  WORKSPACE_REPORTS: {
    route: "/reports",
    app: "workspace",
    visibility: {
      requester: H,
      requester_external: H,
      agent_l1: R,
      agent_l2: R,
      change_manager: R,
      kb_editor: R,
      cmdb_owner: R,
      sp_admin: V,
    },
  },
  WORKSPACE_PROFILE: {
    route: "/profile",
    app: "workspace",
    visibility: {
      requester: H,
      requester_external: H,
      agent_l1: V,
      agent_l2: V,
      change_manager: V,
      kb_editor: V,
      cmdb_owner: V,
      sp_admin: V,
    },
  },
  WORKSPACE_SETTINGS: {
    route: "/settings",
    app: "workspace",
    visibility: {
      requester: H,
      requester_external: H,
      agent_l1: H,
      agent_l2: H,
      change_manager: H,
      kb_editor: H,
      cmdb_owner: H,
      sp_admin: V,
    },
  },
  WORKSPACE_CAB_MEETING: {
    route: "/changes/cab/:date",
    app: "workspace",
    visibility: {
      requester: H,
      requester_external: H,
      agent_l1: H,
      agent_l2: H,
      change_manager: V,
      kb_editor: H,
      cmdb_owner: H,
      sp_admin: V,
    },
  },
};

export const getScreenSpec = (screen: ScreenId): ScreenSpec => SCREENS[screen];

export const getScreenVisibility = (role: UIRole, screen: ScreenId): ScreenVisibility =>
  SCREENS[screen].visibility[role];

/** Aggregated visibility for a user with multiple roles — highest wins. */
export const getScreenVisibilityForRoles = (
  roles: readonly UIRole[],
  screen: ScreenId,
): ScreenVisibility => {
  let best: ScreenVisibility = "hidden";
  for (const role of roles) {
    const v = getScreenVisibility(role, screen);
    if (v === "visible") return "visible";
    if (v === "readonly") best = "readonly";
  }
  return best;
};

export const canAccessScreen = (roles: readonly UIRole[], screen: ScreenId): boolean =>
  getScreenVisibilityForRoles(roles, screen) !== "hidden";

export const canEditScreen = (roles: readonly UIRole[], screen: ScreenId): boolean =>
  getScreenVisibilityForRoles(roles, screen) === "visible";

// =============================================================================
// Per-screen / per-action guard helpers (rbac.md §6)
// =============================================================================

export const canSubmitTicket = (roles: readonly UIRole[]): boolean =>
  hasPermission(roles, "ticket.create.own") || hasPermission(roles, "incident.create");

export const canViewIncidentQueue = (roles: readonly UIRole[]): boolean =>
  hasPermission(roles, "incident.read.queue");

export const canEscalateIncident = (roles: readonly UIRole[]): boolean =>
  hasPermission(roles, "incident.escalate");

export const canBulkEditIncidents = (roles: readonly UIRole[]): boolean =>
  hasPermission(roles, "incident.bulk");

export const canApproveRequest = (roles: readonly UIRole[]): boolean =>
  hasPermission(roles, "request.approve");

export const canFulfillRequest = (roles: readonly UIRole[]): boolean =>
  hasPermission(roles, "request.fulfill");

export const canManageProblem = (roles: readonly UIRole[]): boolean =>
  hasPermission(roles, "problem.update.rca");

export const canCreateChange = (roles: readonly UIRole[]): boolean =>
  hasPermission(roles, "change.create");

export const canApproveChange = (roles: readonly UIRole[]): boolean =>
  hasPermission(roles, "cab.approve");

export const canEmergencyApproveChange = (roles: readonly UIRole[]): boolean =>
  hasPermission(roles, "cab.approve.emergency");

export const canViewChangeCalendar = (roles: readonly UIRole[]): boolean =>
  hasPermission(roles, "change.read.calendar");

export const canViewCrossTenantCalendar = (roles: readonly UIRole[]): boolean =>
  hasPermission(roles, "change.read.calendar.cross-tenant");

export const canEditKbArticle = (roles: readonly UIRole[]): boolean =>
  hasPermission(roles, "kb.write");

export const canPublishKbArticle = (roles: readonly UIRole[]): boolean =>
  hasPermission(roles, "kb.approve");

export const canViewKbAnalytics = (roles: readonly UIRole[]): boolean =>
  hasPermission(roles, "kb.analytics");

export const canViewCmdb = (roles: readonly UIRole[]): boolean =>
  hasPermission(roles, "ci.read") || hasPermission(roles, "ci.search");

export const canEditCi = (roles: readonly UIRole[]): boolean => hasPermission(roles, "ci.update");

export const canManageTenants = (roles: readonly UIRole[]): boolean =>
  hasPermission(roles, "tenant.admin");

export const canViewAuditLog = (roles: readonly UIRole[]): boolean =>
  hasPermission(roles, "audit.read");

export const canViewReports = (roles: readonly UIRole[]): boolean =>
  hasPermission(roles, "reports.read");
