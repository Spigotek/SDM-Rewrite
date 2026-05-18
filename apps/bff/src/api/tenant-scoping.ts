import { AppErrorException } from "../auth/errors";

/**
 * Tenant scoping for the BFF REST proxy.
 *
 * Two enforcement points (per `multi-tenancy-security.md §3` — defence in depth):
 *
 *  1. **Read queries** — inject a `tenant=U'<id>'` predicate into the CA SDM
 *     `WC` query parameter on every entity read. The injection is merged with
 *     any FE-supplied filter using ` AND `, URL-encoded.
 *  2. **Mutating bodies** — when an FE-supplied payload carries a `tenantId`
 *     (or nested `tenant.id`) field, validate it against the session's
 *     `activeTenantId`. Mismatched bodies throw `TENANT_FORBIDDEN`.
 *
 * **Single-tenant placeholder skip**: the dev/test CA SDM instance we probe
 * (`10.11.35.35:8050`) is single-tenant (`real-backend-contracts.md §6` —
 * `<collection_tenant COUNT="0"/>`). F.1's session loader hardcodes
 * `activeTenantId = "default"` because the real `tenant` factory is empty.
 * Injecting `WC=tenant=U'default'` on a single-tenant instance returns 0 rows
 * (the filter never matches the absent column).
 *
 * Therefore: when `activeTenantId === "default"`, both enforcement points are
 * no-ops. As soon as a real multi-tenant instance is wired up (session loader
 * starts populating a real tenant FK), the same code activates automatically.
 *
 * Forward-compat: this module never reads from a global; the placeholder is
 * compared literally and the constant lives next to the placeholder seed in
 * F.1 (`auth/routes.ts`). If the placeholder name changes, change both.
 */

const SINGLE_TENANT_PLACEHOLDER = "default";

export interface TenantScope {
  readonly activeTenantId: string;
}

export interface TenantScopingDeps {
  readonly log?: { warn: (obj: object, msg: string) => void };
}

/**
 * Inject `tenant=U'<id>'` into the WC parameter of a CA SDM REST path.
 * No-op when on the single-tenant placeholder.
 */
export function scopeReadQuery(
  caSdmPath: string,
  scope: TenantScope,
  deps: TenantScopingDeps = {},
): string {
  if (scope.activeTenantId === SINGLE_TENANT_PLACEHOLDER) {
    deps.log?.warn(
      { event: "bff.tenant_scoping.placeholder_skip" },
      "tenant scoping skipped: activeTenantId is the single-tenant placeholder",
    );
    return caSdmPath;
  }

  const [pathPart, queryPart = ""] = caSdmPath.split("?", 2);
  const params = new URLSearchParams(queryPart);
  const existingWc = params.get("WC");
  const tenantPredicate = `tenant=${formatGuidLiteral(scope.activeTenantId)}`;
  const merged = existingWc ? `${existingWc} AND ${tenantPredicate}` : tenantPredicate;
  params.set("WC", merged);
  return `${pathPart}?${params.toString()}`;
}

/**
 * Validate that a mutating request body's tenant field matches the session.
 * Accepts:
 *  - `{ tenantId: "U'...'" }`
 *  - `{ tenant: { id: "U'...'" } }` (CA SDM-style nested FK)
 *  - `{ tenant: { "@REL_ATTR": "U'...'" } }` (XML-attribute style after JSON marshalling)
 *
 * Bodies without any tenant field are accepted (the proxy will not inject one).
 * No-op when on the single-tenant placeholder.
 *
 * @throws AppErrorException(TENANT_FORBIDDEN) on mismatch.
 */
export function assertBodyTenantMatchesSession(body: unknown, scope: TenantScope): void {
  if (scope.activeTenantId === SINGLE_TENANT_PLACEHOLDER) return;
  const bodyTenant = extractBodyTenant(body);
  if (bodyTenant === null) return;
  if (bodyTenant !== scope.activeTenantId) {
    throw new AppErrorException({
      code: "TENANT_FORBIDDEN",
      httpStatus: 403,
      message: "Request body tenant does not match the active session tenant",
      details: { bodyTenant, activeTenantId: scope.activeTenantId },
    });
  }
}

function extractBodyTenant(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const obj = body as Record<string, unknown>;
  if (typeof obj["tenantId"] === "string") return obj["tenantId"];
  const tenant = obj["tenant"];
  if (tenant && typeof tenant === "object") {
    const t = tenant as Record<string, unknown>;
    if (typeof t["id"] === "string") return t["id"];
    if (typeof t["@REL_ATTR"] === "string") return t["@REL_ATTR"];
  }
  return null;
}

/**
 * Wrap a tenant id as a CA SDM WC literal. GUID-prefixed ids (`U'...'`) pass
 * through verbatim; other strings get `'`-wrapped.
 */
function formatGuidLiteral(id: string): string {
  if (id.startsWith("U'") && id.endsWith("'")) return id;
  return `'${id.replace(/'/g, "''")}'`;
}
