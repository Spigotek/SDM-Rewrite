import type { TenantId } from "@sdm/domain";
import { tenantId as toTenantId } from "@sdm/domain";

const HEADER = "X-CA-SDM-Tenant";
const COOKIE_RE = /(?:^|; )sdm-active-tenant=([^;]+)/;

export const DEFAULT_TENANT_ID: TenantId = toTenantId("acme-corp");

export function parseTenantFromRequest(req: Request): TenantId {
  const header = req.headers.get(HEADER);
  if (header) return toTenantId(header);
  const cookie = req.headers.get("Cookie");
  if (cookie) {
    const match = COOKIE_RE.exec(cookie);
    if (match?.[1]) return toTenantId(decodeURIComponent(match[1]));
  }
  return DEFAULT_TENANT_ID;
}
