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
