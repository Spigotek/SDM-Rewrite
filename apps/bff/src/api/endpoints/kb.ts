import type { Hono } from "hono";
import type { RestProxyDeps } from "../rest-proxy";
import { registerEntityRoutes } from "./_entity-routes";
import { epochSecToIso, liftAttrs } from "./_shape";

/**
 * /api/kb — proxies to CA SDM factory **`KD`** (uppercase! §16, §21 items 1+2).
 *
 *  - URL factory name is `KD`, not `kd` (`GET /caisd-rest/kd` → 404).
 *  - Attribute names are UPPERCASE: `TITLE`, `SUMMARY`, `RESOLUTION`,
 *    `CREATION_DATE`, `KEYWORDS`. Snake-case attrs from other factories don't
 *    apply here.
 *  - No DELETE path on this instance — `delete_flag` is not an attribute of
 *    `KD`. Soft-close strategy is `"none"`; the BFF refuses to expose DELETE
 *    (the FE should hide the option for KB).
 */

const DEFAULT_ATTRS = "TITLE,SUMMARY,RESOLUTION,KEYWORDS,CREATION_DATE";

export interface KbRowFe {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly resolution: string;
  readonly keywords: string;
  readonly createdAt: string | null;
}

export interface KbCreateFe {
  readonly title: string;
  readonly summary?: string;
  readonly resolution?: string;
  readonly keywords?: string;
}

export interface KbUpdateFe {
  readonly title?: string;
  readonly summary?: string;
  readonly resolution?: string;
  readonly keywords?: string;
}

function mapRow(raw: Record<string, unknown>): KbRowFe {
  const top = liftAttrs(raw);
  return {
    id: top.id,
    title:
      typeof raw["TITLE"] === "string"
        ? raw["TITLE"]
        : String(raw["TITLE"] ?? top.displayName ?? ""),
    summary: typeof raw["SUMMARY"] === "string" ? raw["SUMMARY"] : "",
    resolution: typeof raw["RESOLUTION"] === "string" ? raw["RESOLUTION"] : "",
    keywords: typeof raw["KEYWORDS"] === "string" ? raw["KEYWORDS"] : "",
    createdAt: epochSecToIso(raw["CREATION_DATE"] as string | number | null | undefined),
  };
}

function mapCreate(body: KbCreateFe): Record<string, unknown> {
  return {
    TITLE: body.title,
    ...(body.summary !== undefined ? { SUMMARY: body.summary } : {}),
    ...(body.resolution !== undefined ? { RESOLUTION: body.resolution } : {}),
    ...(body.keywords !== undefined ? { KEYWORDS: body.keywords } : {}),
  };
}

function mapUpdate(body: KbUpdateFe): Record<string, unknown> {
  return {
    ...(body.title !== undefined ? { TITLE: body.title } : {}),
    ...(body.summary !== undefined ? { SUMMARY: body.summary } : {}),
    ...(body.resolution !== undefined ? { RESOLUTION: body.resolution } : {}),
    ...(body.keywords !== undefined ? { KEYWORDS: body.keywords } : {}),
  };
}

export function registerKbRoutes(app: Hono, deps: RestProxyDeps): void {
  registerEntityRoutes<KbRowFe, KbCreateFe, KbUpdateFe>(app, deps, {
    factory: "KD",
    route: "/api/kb",
    defaultAttrs: DEFAULT_ATTRS,
    pkIsGuid: false,
    softClose: { kind: "none" },
    mapRow,
    mapCreate,
    mapUpdate,
  });
}
