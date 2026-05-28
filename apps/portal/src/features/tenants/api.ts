/**
 * H.1 — tenant switch API surface.
 *
 * Thin wrapper over `bootstrap/session.postActiveTenant` so the feature folder
 * has a single import point for the mutation hook + browser tests.
 */
import type { TenantId } from "@sdm/domain";
import { postActiveTenant, type SessionLoadResult } from "../../bootstrap/session";

export async function switchTenantRequest(tenantId: TenantId): Promise<SessionLoadResult> {
  return postActiveTenant(tenantId);
}
