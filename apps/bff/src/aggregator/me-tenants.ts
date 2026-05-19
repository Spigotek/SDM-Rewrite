import type { Hono } from "hono";
import type { Logger } from "pino";
import type { MyTenantsResponse } from "@sdm/api-types";
import { TtlCache } from "../api/cache";
import { AppErrorException } from "../auth/errors";
import type { RuntimeConfig } from "../config/schema";
import { requireActiveSession } from "../session/load";
import type { SessionPayload, SessionStore } from "../session/types";

/**
 * GET /me/tenants — refresh the tenant + role list independently of `/me`.
 *
 * D4 carry-over (see docs/plans/F.md): `/me` returns the canonical shape with
 * tenants[] embedded; `/me/tenants` is a separate cache-friendly endpoint so
 * the FE can re-fetch tenant membership after admin operations without a full
 * `/me` round-trip.
 *
 * On this CA SDM 17.4 instance the tenant factory is empty
 * (real-backend-contracts.md §6 — single-tenant) and `cnt_role` is empty for
 * vueuser (§5), so the multi-tenancy.md §3.1 fan-out degenerates to reading
 * `session.tenants[]` which F.1 already hydrated at login. The endpoint stays
 * future-proof: switching to the real fan-out is local to this file.
 *
 * Cache key is `userId` (TTL 5 min). Tenant switch does NOT invalidate
 * because the list of *available* tenants doesn't change on switch — only the
 * `activeTenantId` does, and that field is recomputed per-request.
 */

const TENANTS_TTL_SEC = 5 * 60;

export interface MeTenantsDeps {
  readonly config: RuntimeConfig;
  readonly sessionStore: SessionStore;
  readonly log: Logger;
}

export interface MeTenantsState {
  readonly cache: TtlCache<ReadonlyArray<MyTenantsResponse["tenants"][number]>>;
}

export function createMeTenantsState(): MeTenantsState {
  return { cache: new TtlCache({ maxEntries: 256 }) };
}

export function registerMeTenantsRoutes(
  app: Hono,
  deps: MeTenantsDeps,
  state: MeTenantsState = createMeTenantsState(),
): void {
  app.get("/me/tenants", async (c) => {
    let session: SessionPayload;
    try {
      session = await requireActiveSession(c, deps);
    } catch (err) {
      if (err instanceof AppErrorException) {
        throw err;
      }
      throw err;
    }

    let tenants = state.cache.get(session.userId);
    if (!tenants) {
      tenants = session.tenants.map((t) => ({
        id: t.id,
        name: t.name,
        isServiceProvider: false,
        roles: t.roles.map((r) => ({ id: r.id, name: r.sym, uiRole: r.uiRole })),
      }));
      state.cache.set(session.userId, tenants, TENANTS_TTL_SEC);
    }

    const body: MyTenantsResponse = {
      tenants,
      defaultTenantId: tenants[0]?.id ?? session.activeTenantId,
      activeTenantId: session.activeTenantId,
    };
    return c.json(body, 200);
  });
}
