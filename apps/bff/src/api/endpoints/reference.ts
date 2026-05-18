import type { Hono } from "hono";
import { proxyToSdm, readCollection, type RestProxyDeps } from "../rest-proxy";
import { TtlCache } from "../cache";
import { liftAttrs, type CaSdmFk } from "./_shape";

/**
 * /api/reference/* — proxies the CA SDM reference factories (priorities,
 * statuses, impact, urgency, types, access types, categories, CI families/classes).
 *
 * Each route caches its full collection for 15 minutes (§F.2.md plan;
 * TtlCache is per-process). Cache key is `(factory, REL_ATTR)` per §18
 * cross-factory observation — `crs` and `chgstat` share short codes (`OP`/`CL`)
 * but live in different reference tables.
 *
 * Tenant scoping is **disabled** on the reads (reference factories have no
 * tenant column; injecting one returns 0 rows on real B-E per §6).
 */

const REFERENCE_TTL_SEC = 15 * 60;
const REFERENCE_PAGE_SIZE = 200;

interface RefDef {
  readonly route: string;
  readonly factory: string;
}

const REFERENCES: ReadonlyArray<RefDef> = [
  { route: "/api/reference/priorities", factory: "pri" },
  { route: "/api/reference/statuses", factory: "crs" },
  { route: "/api/reference/change-statuses", factory: "chgstat" },
  { route: "/api/reference/impacts", factory: "imp" },
  { route: "/api/reference/urgencies", factory: "urg" },
  { route: "/api/reference/types", factory: "crt" },
  { route: "/api/reference/booleans", factory: "bool" },
  { route: "/api/reference/active-flags", factory: "actbool" },
  { route: "/api/reference/access-types", factory: "acctyp" },
  { route: "/api/reference/ci-families", factory: "nrf" },
  { route: "/api/reference/ci-classes", factory: "grc" },
  { route: "/api/reference/categories", factory: "pcat" },
];

export interface RefRowFe {
  readonly id: string;
  readonly code: string;
  readonly label: string;
}

function mapRow(raw: Record<string, unknown>): RefRowFe {
  const top = liftAttrs(raw);
  const relAttr = (raw as CaSdmFk)["@REL_ATTR"];
  return {
    id: top.id,
    code: relAttr !== undefined ? String(relAttr) : top.id,
    label: top.displayName,
  };
}

export interface ReferenceState {
  readonly cache: TtlCache<ReadonlyArray<RefRowFe>>;
}

export function createReferenceState(): ReferenceState {
  return { cache: new TtlCache<ReadonlyArray<RefRowFe>>({ maxEntries: REFERENCES.length * 2 }) };
}

export function registerReferenceRoutes(
  app: Hono,
  deps: RestProxyDeps,
  state: ReferenceState = createReferenceState(),
): void {
  for (const { route, factory } of REFERENCES) {
    app.get(route, async (c) => {
      const cached = state.cache.get(factory);
      if (cached) {
        return c.json({ data: cached, cached: true, factory });
      }
      const result = await proxyToSdm(c, deps, {
        method: "GET",
        caSdmPath: `/${factory}?start=1&size=${REFERENCE_PAGE_SIZE}`,
        op: `GET ${route}`,
        tenantScopeReadQuery: false,
      });
      const { rows } = readCollection<Record<string, unknown>>(result.body, factory);
      const mapped = rows.map(mapRow);
      state.cache.set(factory, mapped, REFERENCE_TTL_SEC);
      return c.json({ data: mapped, cached: false, factory });
    });
  }

  app.post("/api/reference/_invalidate", async (c) => {
    state.cache.clear();
    return c.json({ cleared: true, ttlSec: REFERENCE_TTL_SEC });
  });
}
