import type { Hono } from "hono";
import type { RestProxyDeps } from "../rest-proxy";
import { registerEntityRoutes } from "./_entity-routes";
import { liftAttrs, toFkRef, type CaSdmFk } from "./_shape";

/**
 * /api/cmdb — proxies to CA SDM factory `nr` (configuration items).
 *
 *  - PK is a GUID `U'...'` (§17, §21 item 8) — URL-encode `%27` in path segments.
 *  - `class` FK is required on POST (§17.2).
 *  - Soft-delete path: `PUT /nr/<id>` with `<delete_flag REL_ATTR="1"/>` →
 *    `delete_flag.@COMMON_NAME = "Inactive"` (§17.2).
 *  - `nr.link` is an array — §21 item 18 — the XML→JSON adapter already
 *    surfaces both single and array shapes; remap below doesn't read it.
 */

const DEFAULT_ATTRS = "name,description,class,family,serial_number,delete_flag";

export interface CiRowFe {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly serialNumber: string;
  readonly class: ReturnType<typeof toFkRef>;
  readonly family: ReturnType<typeof toFkRef>;
  readonly deleteFlag: ReturnType<typeof toFkRef>;
}

export interface CiCreateFe {
  readonly name: string;
  readonly description?: string;
  readonly serialNumber?: string;
  readonly classId: string;
  readonly familyId?: string;
}

export interface CiUpdateFe {
  readonly name?: string;
  readonly description?: string;
  readonly serialNumber?: string;
  readonly classId?: string;
  readonly familyId?: string;
}

function mapRow(raw: Record<string, unknown>): CiRowFe {
  const top = liftAttrs(raw);
  return {
    id: top.id,
    name:
      typeof raw["name"] === "string" ? raw["name"] : String(raw["name"] ?? top.displayName ?? ""),
    description:
      typeof raw["description"] === "string"
        ? raw["description"]
        : raw["description"] !== undefined && raw["description"] !== null
          ? String(raw["description"])
          : "",
    serialNumber: typeof raw["serial_number"] === "string" ? raw["serial_number"] : "",
    class: toFkRef(raw["class"] as CaSdmFk | undefined),
    family: toFkRef(raw["family"] as CaSdmFk | undefined),
    deleteFlag: toFkRef(raw["delete_flag"] as CaSdmFk | undefined),
  };
}

function mapCreate(body: CiCreateFe): Record<string, unknown> {
  return {
    name: body.name,
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.serialNumber !== undefined ? { serial_number: body.serialNumber } : {}),
    class: { relAttr: body.classId },
    ...(body.familyId !== undefined ? { family: { relAttr: body.familyId } } : {}),
  };
}

function mapUpdate(body: CiUpdateFe): Record<string, unknown> {
  return {
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.serialNumber !== undefined ? { serial_number: body.serialNumber } : {}),
    ...(body.classId !== undefined ? { class: { relAttr: body.classId } } : {}),
    ...(body.familyId !== undefined ? { family: { relAttr: body.familyId } } : {}),
  };
}

export function registerCmdbRoutes(app: Hono, deps: RestProxyDeps): void {
  registerEntityRoutes<CiRowFe, CiCreateFe, CiUpdateFe>(app, deps, {
    factory: "nr",
    route: "/api/cmdb",
    defaultAttrs: DEFAULT_ATTRS,
    pkIsGuid: true,
    softClose: { kind: "delete-flag-1" },
    mapRow,
    mapCreate,
    mapUpdate,
  });
}
