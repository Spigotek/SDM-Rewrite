import type { UIRole } from "@sdm/domain";

/**
 * CA SDM role.sym → UIRole resolution with fallbacks.
 *
 * Real B-E evidence (docs/agents/devex-devops/real-backend-contracts.md):
 *  - role.sym lives in the @COMMON_NAME attribute on <role> elements.
 *  - The cnt_role.role FK is silently dropped from /cnt_role bodies on this
 *    instance, even with X-Obj-Attrs — so for some contacts (e.g. vueuser)
 *    we cannot enumerate CA roles at all.
 *  - Fallback: derive UIRole from cnt.access_type.COMMON_NAME
 *    ("Administration" → sp_admin, "Employee" → agent_l1, "Customer" → requester).
 *
 * Operators can override the per-role mapping via BFF env UI_ROLE_MAPPING_JSON.
 */

export interface RoleMappingConfig {
  /** CA SDM role.sym (COMMON_NAME) → UIRole */
  readonly explicit: Readonly<Record<string, UIRole>>;
  /** UIRole used when nothing else matches */
  readonly fallback: UIRole;
}

const DEFAULT_ACCESS_TYPE_MAP: Readonly<Record<string, UIRole>> = {
  Administration: "sp_admin",
  Employee: "agent_l1",
  Customer: "requester",
  "Vendor Analyst": "agent_l1",
};

export function resolveUiRolesFromSyms(
  symbols: ReadonlyArray<string>,
  cfg: RoleMappingConfig,
): UIRole[] {
  const out = new Set<UIRole>();
  for (const sym of symbols) {
    const mapped = cfg.explicit[sym];
    if (mapped) out.add(mapped);
  }
  return Array.from(out);
}

export function resolveUiRoleFromAccessType(
  accessTypeName: string,
  cfg: RoleMappingConfig,
): UIRole {
  return cfg.explicit[accessTypeName] ?? DEFAULT_ACCESS_TYPE_MAP[accessTypeName] ?? cfg.fallback;
}

/** Combined resolution: explicit role.sym matches first, fall back to access_type, else cfg.fallback. */
export function resolveUiRoles(opts: {
  roleSyms: ReadonlyArray<string>;
  accessTypeName: string;
  cfg: RoleMappingConfig;
}): UIRole[] {
  const fromRoles = resolveUiRolesFromSyms(opts.roleSyms, opts.cfg);
  if (fromRoles.length > 0) return fromRoles;
  return [resolveUiRoleFromAccessType(opts.accessTypeName, opts.cfg)];
}

/**
 * Role-as-workspace resolution: each CA SDM role the user can assume is its own
 * workspace, so we derive a UIRole per role NAME rather than per access type.
 * Custom deployments name roles by org + function (e.g. ".Pouzivatel_CAMP",
 * ".Riesitel_NBS", "Admin CAMP", "Configuration Analyst"). Operators pin exact
 * mappings via UI_ROLE_MAPPING_JSON (matched against both the raw and the
 * leading-dot-stripped name); otherwise keyword heuristics apply, then fallback.
 * Heuristics are ordered most-specific-first ("Configuration Administrator" →
 * cmdb_owner before the generic /admin/ → sp_admin rule fires).
 */
const ROLE_NAME_HEURISTICS: ReadonlyArray<readonly [RegExp, UIRole]> = [
  [/configuration/i, "cmdb_owner"],
  [/knowledge/i, "kb_editor"],
  [/change/i, "change_manager"],
  [/admin/i, "sp_admin"],
  [/manager/i, "agent_l2"],
  [/analyst|riesitel|level\s*2/i, "agent_l2"],
  [/operator|level\s*1/i, "agent_l1"],
  [/pouzivatel|customer|employee|zamestnanec/i, "requester"],
];

export function resolveUiRoleFromRoleName(roleName: string, cfg: RoleMappingConfig): UIRole {
  const raw = roleName.trim();
  const stripped = raw.replace(/^\.+/, "").trim();
  const explicit = cfg.explicit[raw] ?? cfg.explicit[stripped];
  if (explicit) return explicit;
  for (const [pattern, uiRole] of ROLE_NAME_HEURISTICS) {
    if (pattern.test(stripped)) return uiRole;
  }
  return cfg.fallback;
}
