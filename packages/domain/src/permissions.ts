import type { Permission, RoleCode } from "./model";

// Stub RBAC mapping — minimálna baseline pre Chunk 3. Reálne mapovanie
// per docs/agents/security/rbac.md (7 rolí × 25 obrazoviek) bude v Chunk 4+.
const ROLE_PERMISSIONS: Readonly<Record<RoleCode, readonly Permission[]>> = {
  ADMINISTRATOR: [
    "ADMINISTRATION_VIEW",
    "ADMINISTRATION_MODIFY",
    "CI_VIEW",
    "CI_MODIFY",
    "INCIDENT_VIEW",
    "INCIDENT_MODIFY",
    "PROBLEM_VIEW",
    "PROBLEM_MODIFY",
    "REQUEST_VIEW",
    "REQUEST_MODIFY",
    "CHANGE_VIEW",
    "CHANGE_MODIFY",
    "CHANGE_APPROVE",
    "KB_VIEW",
    "KB_MODIFY",
    "KB_PUBLISH",
  ],
  SYSTEM_ADMINISTRATOR: ["ADMINISTRATION_VIEW", "ADMINISTRATION_MODIFY"],
  CONFIG_ADMINISTRATOR: ["CI_VIEW", "CI_MODIFY"],
  CONFIG_ANALYST: ["CI_VIEW", "CI_MODIFY"],
  CONFIG_VIEWER: ["CI_VIEW"],
  CHANGE_MANAGER: [
    "CHANGE_VIEW",
    "CHANGE_MODIFY",
    "CHANGE_APPROVE",
    "INCIDENT_VIEW",
    "PROBLEM_VIEW",
  ],
  SERVICE_DESK_ADMINISTRATOR: [
    "INCIDENT_VIEW",
    "INCIDENT_MODIFY",
    "REQUEST_VIEW",
    "REQUEST_MODIFY",
    "PROBLEM_VIEW",
    "PROBLEM_MODIFY",
    "KB_VIEW",
    "KB_MODIFY",
    "KB_PUBLISH",
  ],
  SERVICE_DESK_MANAGER: [
    "INCIDENT_VIEW",
    "INCIDENT_MODIFY",
    "REQUEST_VIEW",
    "REQUEST_MODIFY",
    "PROBLEM_VIEW",
    "KB_VIEW",
    "KB_MODIFY",
  ],
  LEVEL_1_ANALYST: [
    "INCIDENT_VIEW",
    "INCIDENT_MODIFY",
    "REQUEST_VIEW",
    "REQUEST_MODIFY",
    "KB_VIEW",
  ],
  LEVEL_2_ANALYST: [
    "INCIDENT_VIEW",
    "INCIDENT_MODIFY",
    "REQUEST_VIEW",
    "REQUEST_MODIFY",
    "PROBLEM_VIEW",
    "PROBLEM_MODIFY",
    "KB_VIEW",
    "KB_MODIFY",
  ],
  INCIDENT_MANAGER: ["INCIDENT_VIEW", "INCIDENT_MODIFY", "REQUEST_VIEW", "PROBLEM_VIEW"],
  PROBLEM_MANAGER: ["PROBLEM_VIEW", "PROBLEM_MODIFY", "INCIDENT_VIEW", "CHANGE_VIEW"],
};

export const getPermissionsForRole = (role: RoleCode): readonly Permission[] =>
  ROLE_PERMISSIONS[role];

export const hasPermission = (roles: readonly RoleCode[], permission: Permission): boolean =>
  roles.some((role) => ROLE_PERMISSIONS[role].includes(permission));
