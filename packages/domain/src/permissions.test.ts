import { describe, expect, it } from "vitest";
import type { Permission, UIRole } from "./model";
import {
  canAccessScreen,
  canApproveChange,
  canApproveRequest,
  canBulkEditIncidents,
  canCreateChange,
  canEditCi,
  canEditKbArticle,
  canEditScreen,
  canEmergencyApproveChange,
  canEscalateIncident,
  canFulfillRequest,
  canManageProblem,
  canManageTenants,
  canPublishKbArticle,
  canSubmitTicket,
  canViewAuditLog,
  canViewChangeCalendar,
  canViewCmdb,
  canViewCrossTenantCalendar,
  canViewIncidentQueue,
  canViewKbAnalytics,
  canViewReports,
  getPermissionsForRole,
  getScreenVisibility,
  getScreenVisibilityForRoles,
  hasPermission,
  type ScreenId,
} from "./permissions";

const ALL_ROLES: readonly UIRole[] = [
  "requester",
  "requester_external",
  "agent_l1",
  "agent_l2",
  "change_manager",
  "kb_editor",
  "cmdb_owner",
  "sp_admin",
];

describe("getPermissionsForRole", () => {
  it("sp_admin subsumes every workspace persona (portal access is intentionally excluded per §5)", () => {
    const spAdminPerms = new Set(getPermissionsForRole("sp_admin"));
    const workspaceRoles: readonly UIRole[] = [
      "agent_l1",
      "agent_l2",
      "change_manager",
      "kb_editor",
      "cmdb_owner",
    ];
    for (const role of workspaceRoles) {
      for (const perm of getPermissionsForRole(role)) {
        expect(spAdminPerms.has(perm)).toBe(true);
      }
    }
    // Sanity: sp_admin must NOT have portal access — per rbac.md §5 it operates workspace-only.
    expect(spAdminPerms.has("app.portal.access")).toBe(false);
  });

  it("gives requester portal-only access (no workspace access)", () => {
    const perms = getPermissionsForRole("requester");
    expect(perms).toContain<Permission>("app.portal.access");
    expect(perms).not.toContain<Permission>("app.workspace.access");
    expect(perms).not.toContain<Permission>("incident.read.queue");
  });

  it("treats requester_external identically to requester (BFF applies filter)", () => {
    expect(getPermissionsForRole("requester_external")).toEqual(getPermissionsForRole("requester"));
  });

  it("gives agent_l2 a strict superset over agent_l1", () => {
    const l1 = new Set(getPermissionsForRole("agent_l1"));
    const l2 = new Set(getPermissionsForRole("agent_l2"));
    for (const perm of l1) expect(l2.has(perm)).toBe(true);
    expect(l2.size).toBeGreaterThan(l1.size);
  });

  it("scopes change_manager to change + read-only support modules", () => {
    const perms = getPermissionsForRole("change_manager");
    expect(perms).toContain<Permission>("cab.approve");
    expect(perms).toContain<Permission>("change.create");
    expect(perms).not.toContain<Permission>("incident.update.fields");
    expect(perms).not.toContain<Permission>("kb.write");
  });

  it("scopes kb_editor to knowledge ownership", () => {
    const perms = getPermissionsForRole("kb_editor");
    expect(perms).toContain<Permission>("kb.approve");
    expect(perms).toContain<Permission>("kb.taxonomy");
    expect(perms).not.toContain<Permission>("incident.read.queue");
    expect(perms).not.toContain<Permission>("cab.approve");
  });

  it("scopes cmdb_owner to CI ownership", () => {
    const perms = getPermissionsForRole("cmdb_owner");
    expect(perms).toContain<Permission>("ci.update");
    expect(perms).toContain<Permission>("ci.create");
    expect(perms).not.toContain<Permission>("kb.approve");
    expect(perms).not.toContain<Permission>("cab.approve");
  });

  it("gives sp_admin cross-tenant + admin permissions", () => {
    const perms = getPermissionsForRole("sp_admin");
    expect(perms).toContain<Permission>("tenant.admin");
    expect(perms).toContain<Permission>("ci.read.cross-tenant");
    expect(perms).toContain<Permission>("change.read.calendar.cross-tenant");
    expect(perms).toContain<Permission>("audit.export");
  });
});

describe("hasPermission", () => {
  it("returns true when any role grants the permission", () => {
    expect(hasPermission(["agent_l1"], "incident.read.queue")).toBe(true);
  });

  it("returns false when no role grants the permission", () => {
    expect(hasPermission(["agent_l1"], "cab.approve")).toBe(false);
  });

  it("aggregates across multiple roles in the same session", () => {
    expect(hasPermission(["agent_l1", "change_manager"], "cab.approve")).toBe(true);
  });

  it("returns false for empty role list", () => {
    expect(hasPermission([], "incident.read.own")).toBe(false);
  });
});

describe("screen visibility — spec matrix (rbac.md §5)", () => {
  it("hides every portal screen from workspace roles and vice-versa", () => {
    expect(getScreenVisibility("requester", "WORKSPACE_INCIDENT_QUEUE")).toBe("hidden");
    expect(getScreenVisibility("agent_l1", "PORTAL_HOME")).toBe("hidden");
    expect(getScreenVisibility("sp_admin", "PORTAL_SUBMIT_TICKET")).toBe("hidden");
  });

  it("matches the rbac.md §5 matrix for incident queue", () => {
    const matrix: Record<UIRole, "visible" | "readonly" | "hidden"> = {
      requester: "hidden",
      requester_external: "hidden",
      agent_l1: "visible",
      agent_l2: "visible",
      change_manager: "readonly",
      kb_editor: "readonly",
      cmdb_owner: "readonly",
      sp_admin: "visible",
    };
    for (const role of ALL_ROLES) {
      expect(getScreenVisibility(role, "WORKSPACE_INCIDENT_QUEUE")).toBe(matrix[role]);
    }
  });

  it("only change_manager + sp_admin can navigate the CAB queue", () => {
    for (const role of ALL_ROLES) {
      const expected = role === "change_manager" || role === "sp_admin" ? "visible" : "hidden";
      expect(getScreenVisibility(role, "WORKSPACE_CAB_QUEUE")).toBe(expected);
    }
  });

  it("only sp_admin can navigate Tenant admin and Workspace Settings", () => {
    for (const role of ALL_ROLES) {
      const expected = role === "sp_admin" ? "visible" : "hidden";
      expect(getScreenVisibility(role, "WORKSPACE_TENANT_ADMIN")).toBe(expected);
      expect(getScreenVisibility(role, "WORKSPACE_SETTINGS")).toBe(expected);
    }
  });

  it("kb_editor can navigate KB editor; agent_l2 sees it read-only; others hidden", () => {
    expect(getScreenVisibility("kb_editor", "WORKSPACE_KB_EDITOR")).toBe("visible");
    expect(getScreenVisibility("agent_l2", "WORKSPACE_KB_EDITOR")).toBe("readonly");
    expect(getScreenVisibility("agent_l1", "WORKSPACE_KB_EDITOR")).toBe("hidden");
    expect(getScreenVisibility("cmdb_owner", "WORKSPACE_KB_EDITOR")).toBe("hidden");
  });

  it("getScreenVisibilityForRoles picks the highest access across a multi-role session", () => {
    expect(getScreenVisibilityForRoles(["agent_l1", "change_manager"], "WORKSPACE_CAB_QUEUE")).toBe(
      "visible",
    );
    expect(getScreenVisibilityForRoles(["agent_l1", "kb_editor"], "WORKSPACE_KB_MANAGE")).toBe(
      "visible",
    );
    expect(getScreenVisibilityForRoles(["requester", "agent_l1"], "PORTAL_HOME")).toBe("visible");
  });

  it("canAccessScreen treats readonly as accessible", () => {
    expect(canAccessScreen(["change_manager"], "WORKSPACE_INCIDENT_QUEUE")).toBe(true);
    expect(canEditScreen(["change_manager"], "WORKSPACE_INCIDENT_QUEUE")).toBe(false);
  });

  it("every screen has at least one role that can see it (no dead screen)", () => {
    const screens: readonly ScreenId[] = [
      "PORTAL_HOME",
      "PORTAL_SUBMIT_TICKET",
      "PORTAL_MY_TICKETS",
      "PORTAL_TICKET_DETAIL",
      "PORTAL_KB_BROWSE",
      "PORTAL_KB_ARTICLE",
      "PORTAL_CATALOG",
      "PORTAL_CATALOG_ITEM",
      "PORTAL_NOTIFICATIONS",
      "PORTAL_PROFILE",
      "PORTAL_ONBOARDING",
      "WORKSPACE_DASHBOARD",
      "WORKSPACE_INCIDENT_QUEUE",
      "WORKSPACE_INCIDENT_DETAIL",
      "WORKSPACE_PROBLEM_LIST",
      "WORKSPACE_PROBLEM_DETAIL",
      "WORKSPACE_CHANGE_LIST",
      "WORKSPACE_CHANGE_DETAIL",
      "WORKSPACE_CHANGE_CALENDAR",
      "WORKSPACE_CAB_QUEUE",
      "WORKSPACE_KB_MANAGE",
      "WORKSPACE_KB_EDITOR",
      "WORKSPACE_KB_ANALYTICS",
      "WORKSPACE_CMDB_LIST",
      "WORKSPACE_CI_DETAIL",
      "WORKSPACE_CI_IMPACT",
      "WORKSPACE_TENANT_ADMIN",
      "WORKSPACE_REPORTS",
      "WORKSPACE_PROFILE",
      "WORKSPACE_SETTINGS",
      "WORKSPACE_CAB_MEETING",
    ];
    expect(screens).toHaveLength(31);
    for (const screen of screens) {
      const visibleRoles = ALL_ROLES.filter(
        (role) => getScreenVisibility(role, screen) === "visible",
      );
      expect(visibleRoles.length).toBeGreaterThan(0);
    }
  });
});

describe("per-action guard helpers", () => {
  it("canSubmitTicket — requesters and analysts only", () => {
    expect(canSubmitTicket(["requester"])).toBe(true);
    expect(canSubmitTicket(["requester_external"])).toBe(true);
    expect(canSubmitTicket(["agent_l1"])).toBe(true);
    expect(canSubmitTicket(["agent_l2"])).toBe(true);
    expect(canSubmitTicket(["change_manager"])).toBe(false);
    expect(canSubmitTicket(["kb_editor"])).toBe(false);
    expect(canSubmitTicket(["cmdb_owner"])).toBe(false);
  });

  it("canViewIncidentQueue — only workspace personas with queue read", () => {
    expect(canViewIncidentQueue(["requester"])).toBe(false);
    expect(canViewIncidentQueue(["agent_l1"])).toBe(true);
    expect(canViewIncidentQueue(["agent_l2"])).toBe(true);
    expect(canViewIncidentQueue(["change_manager"])).toBe(false); // ▣ via screen, not action
    expect(canViewIncidentQueue(["sp_admin"])).toBe(true);
  });

  it("canEscalateIncident — analysts and sp_admin", () => {
    expect(canEscalateIncident(["agent_l1"])).toBe(true);
    expect(canEscalateIncident(["agent_l2"])).toBe(true);
    expect(canEscalateIncident(["change_manager"])).toBe(false);
    expect(canEscalateIncident(["requester"])).toBe(false);
  });

  it("canBulkEditIncidents — analysts and sp_admin", () => {
    expect(canBulkEditIncidents(["agent_l1"])).toBe(true);
    expect(canBulkEditIncidents(["agent_l2"])).toBe(true);
    expect(canBulkEditIncidents(["requester"])).toBe(false);
    expect(canBulkEditIncidents(["kb_editor"])).toBe(false);
  });

  it("canApproveRequest / canFulfillRequest", () => {
    expect(canApproveRequest(["requester"])).toBe(true); // if assigned approver — BFF gates
    expect(canFulfillRequest(["requester"])).toBe(false);
    expect(canFulfillRequest(["agent_l1"])).toBe(true);
  });

  it("canManageProblem — only agent_l2 + sp_admin", () => {
    expect(canManageProblem(["agent_l1"])).toBe(false);
    expect(canManageProblem(["agent_l2"])).toBe(true);
    expect(canManageProblem(["sp_admin"])).toBe(true);
    expect(canManageProblem(["change_manager"])).toBe(false);
  });

  it("canCreateChange — agent_l2, change_manager, cmdb_owner, sp_admin", () => {
    expect(canCreateChange(["agent_l1"])).toBe(false);
    expect(canCreateChange(["agent_l2"])).toBe(true);
    expect(canCreateChange(["change_manager"])).toBe(true);
    expect(canCreateChange(["sp_admin"])).toBe(true);
  });

  it("canApproveChange / canEmergencyApproveChange — change_manager + sp_admin only", () => {
    for (const role of ALL_ROLES) {
      const expected = role === "change_manager" || role === "sp_admin";
      expect(canApproveChange([role])).toBe(expected);
      expect(canEmergencyApproveChange([role])).toBe(expected);
    }
  });

  it("canViewChangeCalendar — workspace personas via screen permission", () => {
    expect(canViewChangeCalendar(["change_manager"])).toBe(true);
    expect(canViewChangeCalendar(["sp_admin"])).toBe(true);
    expect(canViewChangeCalendar(["requester"])).toBe(false);
  });

  it("canViewCrossTenantCalendar — sp_admin only", () => {
    for (const role of ALL_ROLES) {
      expect(canViewCrossTenantCalendar([role])).toBe(role === "sp_admin");
    }
  });

  it("canEditKbArticle / canPublishKbArticle / canViewKbAnalytics", () => {
    expect(canEditKbArticle(["agent_l2"])).toBe(true);
    expect(canEditKbArticle(["kb_editor"])).toBe(true);
    expect(canEditKbArticle(["agent_l1"])).toBe(false);

    expect(canPublishKbArticle(["agent_l2"])).toBe(false);
    expect(canPublishKbArticle(["kb_editor"])).toBe(true);
    expect(canPublishKbArticle(["sp_admin"])).toBe(true);

    expect(canViewKbAnalytics(["kb_editor"])).toBe(true);
    expect(canViewKbAnalytics(["agent_l1"])).toBe(false);
  });

  it("canViewCmdb / canEditCi", () => {
    expect(canViewCmdb(["agent_l1"])).toBe(true); // ci.search granted
    expect(canViewCmdb(["requester"])).toBe(false);
    expect(canEditCi(["cmdb_owner"])).toBe(true);
    expect(canEditCi(["change_manager"])).toBe(false);
    expect(canEditCi(["sp_admin"])).toBe(true);
  });

  it("canManageTenants / canViewAuditLog — sp_admin only", () => {
    for (const role of ALL_ROLES) {
      const expected = role === "sp_admin";
      expect(canManageTenants([role])).toBe(expected);
      expect(canViewAuditLog([role])).toBe(expected);
    }
  });

  it("canViewReports — every workspace persona", () => {
    expect(canViewReports(["agent_l1"])).toBe(true);
    expect(canViewReports(["change_manager"])).toBe(true);
    expect(canViewReports(["kb_editor"])).toBe(true);
    expect(canViewReports(["cmdb_owner"])).toBe(true);
    expect(canViewReports(["sp_admin"])).toBe(true);
    expect(canViewReports(["requester"])).toBe(false);
  });
});
