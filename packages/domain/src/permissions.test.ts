import { describe, expect, it } from "vitest";
import { getPermissionsForRole, hasPermission } from "./permissions";
import type { Permission, RoleCode } from "./model";

describe("getPermissionsForRole", () => {
  it("returns the full set for ADMINISTRATOR", () => {
    const perms = getPermissionsForRole("ADMINISTRATOR");
    expect(perms.length).toBeGreaterThan(10);
    expect(perms).toContain<Permission>("ADMINISTRATION_MODIFY");
    expect(perms).toContain<Permission>("CHANGE_APPROVE");
  });

  it("returns view-only for CONFIG_VIEWER", () => {
    expect(getPermissionsForRole("CONFIG_VIEWER")).toEqual(["CI_VIEW"]);
  });

  it("returns empty intersection for unrelated permissions", () => {
    expect(getPermissionsForRole("CONFIG_VIEWER")).not.toContain<Permission>("INCIDENT_MODIFY");
  });
});

describe("hasPermission", () => {
  const roles: readonly RoleCode[] = ["LEVEL_1_ANALYST"];

  it("returns true when any role grants the permission", () => {
    expect(hasPermission(roles, "INCIDENT_MODIFY")).toBe(true);
  });

  it("returns false when no role grants the permission", () => {
    expect(hasPermission(roles, "CHANGE_APPROVE")).toBe(false);
  });

  it("aggregates across multiple roles", () => {
    const multi: readonly RoleCode[] = ["LEVEL_1_ANALYST", "CHANGE_MANAGER"];
    expect(hasPermission(multi, "CHANGE_APPROVE")).toBe(true);
  });

  it("returns false for empty role list", () => {
    expect(hasPermission([], "INCIDENT_VIEW")).toBe(false);
  });
});
