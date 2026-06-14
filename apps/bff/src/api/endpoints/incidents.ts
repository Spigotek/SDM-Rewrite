import type { Hono } from "hono";
import type { RestProxyDeps } from "../rest-proxy";
import { registerEntityRoutes } from "./_entity-routes";
import { epochSecToIso, liftAttrs, toFkRef, type CaSdmFk } from "./_shape";

/**
 * /api/incidents — proxies to CA SDM factory `in`.
 *
 * `in` is a logical view over `cr` filtered to type=Incident (§13 — every probe
 * returns `REL_ATTR="cr:<id>"`). Use `/in/*` for Incident operations to avoid
 * accidentally treating a Request (`type=R`) as an Incident.
 */

const DEFAULT_ATTRS =
  "ref_num,summary,description,status,priority,impact,urgency,customer,assignee,open_date,close_date,active,category";

export interface IncidentRowFe {
  readonly id: string;
  readonly ref: string;
  readonly summary: string;
  readonly description: string;
  readonly status: ReturnType<typeof toFkRef>;
  readonly priority: ReturnType<typeof toFkRef>;
  readonly impact: ReturnType<typeof toFkRef>;
  readonly urgency: ReturnType<typeof toFkRef>;
  readonly customer: ReturnType<typeof toFkRef>;
  readonly assignee: ReturnType<typeof toFkRef>;
  readonly category: ReturnType<typeof toFkRef>;
  readonly openedAt: string | null;
  readonly closedAt: string | null;
  readonly isActive: boolean;
}

export interface IncidentCreateFe {
  readonly summary: string;
  readonly description?: string;
  /**
   * Concrete CA SDM contact GUID (`U'…'`). Operator/agent callers that already
   * hold the contact GUID pass it here. The portal does NOT — it passes
   * `customer: "me"` (or omits both) and the BFF resolves the session contact.
   */
  readonly customerId?: string;
  /** Portal "me" signal — `"me"` ⇒ resolve to `session.contactId` server-side. */
  readonly customer?: string;
  readonly priorityCode?: string;
  readonly statusCode?: string;
  readonly assigneeId?: string;
  /** Portal taxonomy code (hardware/software/…) — folded into description. */
  readonly categoryCode?: string;
  /** Portal urgency radio (1=cannot work … 3=minor) — folded into description. */
  readonly urgencyCode?: string;
}

export interface IncidentUpdateFe {
  readonly summary?: string;
  readonly description?: string;
  readonly statusCode?: string;
  readonly priorityCode?: string;
  readonly assigneeId?: string;
}

export function mapIncidentRow(raw: Record<string, unknown>): IncidentRowFe {
  return mapRow(raw);
}

function mapRow(raw: Record<string, unknown>): IncidentRowFe {
  const top = liftAttrs(raw);
  const active = (raw["active"] as CaSdmFk | undefined)?.["@COMMON_NAME"];
  return {
    id: top.id,
    ref:
      typeof raw["ref_num"] === "string"
        ? raw["ref_num"]
        : String(raw["ref_num"] ?? top.displayName),
    summary: typeof raw["summary"] === "string" ? raw["summary"] : "",
    description: typeof raw["description"] === "string" ? raw["description"] : "",
    status: toFkRef(raw["status"] as CaSdmFk | undefined),
    priority: toFkRef(raw["priority"] as CaSdmFk | undefined),
    impact: toFkRef(raw["impact"] as CaSdmFk | undefined),
    urgency: toFkRef(raw["urgency"] as CaSdmFk | undefined),
    customer: toFkRef(raw["customer"] as CaSdmFk | undefined),
    assignee: toFkRef(raw["assignee"] as CaSdmFk | undefined),
    category: toFkRef(raw["category"] as CaSdmFk | undefined),
    openedAt: epochSecToIso(raw["open_date"] as string | number | null | undefined),
    closedAt: epochSecToIso(raw["close_date"] as string | number | null | undefined),
    isActive: active === "YES" || active === 1,
  };
}

function mapCreate(body: IncidentCreateFe): Record<string, unknown> {
  const concreteCustomer =
    typeof body.customerId === "string" && body.customerId.length > 0 && body.customer !== "me";
  const description = foldIncidentDescription(body);
  return {
    summary: body.summary,
    ...(description !== undefined ? { description } : {}),
    // Concrete GUID only — the "me" / omitted case is filled by the BFF's
    // create-time customer resolver from `session.contactId`.
    ...(concreteCustomer ? { customer: { relAttr: body.customerId } } : {}),
    ...(body.priorityCode !== undefined ? { priority: { relAttr: body.priorityCode } } : {}),
    ...(body.statusCode !== undefined ? { status: { relAttr: body.statusCode } } : {}),
    ...(body.assigneeId !== undefined ? { assignee: { relAttr: body.assigneeId } } : {}),
  };
}

const CATEGORY_LABELS: Readonly<Record<string, string>> = {
  hardware: "Hardvér",
  software: "Softvér",
  network: "Sieť / VPN / Wi-Fi",
  account: "Účet / Heslo / Prístup",
  other: "Iné",
};

const URGENCY_LABELS: Readonly<Record<string, string>> = {
  "1": "Nemôžem pracovať",
  "2": "Pracujem, ale s problémami",
  "3": "Drobnosť, nie je to akútne",
};

/**
 * Fold the portal taxonomy (category / urgency) into a human-readable Slovak
 * description so the requester's selections survive to CA SDM — the portal
 * codes are not CA SDM category/priority REL_ATTRs and would be rejected as
 * FKs, so we carry them as text rather than dropping them.
 */
function foldIncidentDescription(body: IncidentCreateFe): string | undefined {
  const lines: string[] = [];
  if (typeof body.categoryCode === "string" && body.categoryCode.length > 0) {
    lines.push(`Kategória: ${CATEGORY_LABELS[body.categoryCode] ?? body.categoryCode}`);
  }
  if (typeof body.urgencyCode === "string" && body.urgencyCode.length > 0) {
    lines.push(`Súrnosť: ${URGENCY_LABELS[body.urgencyCode] ?? body.urgencyCode}`);
  }
  const base = body.description?.trim();
  if (lines.length === 0) return base !== undefined && base.length > 0 ? base : undefined;
  const header = lines.join("\n");
  return base !== undefined && base.length > 0 ? `${header}\n\n${base}` : header;
}

function mapUpdate(body: IncidentUpdateFe): Record<string, unknown> {
  return {
    ...(body.summary !== undefined ? { summary: body.summary } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.statusCode !== undefined ? { status: { relAttr: body.statusCode } } : {}),
    ...(body.priorityCode !== undefined ? { priority: { relAttr: body.priorityCode } } : {}),
    ...(body.assigneeId !== undefined ? { assignee: { relAttr: body.assigneeId } } : {}),
  };
}

export function registerIncidentRoutes(app: Hono, deps: RestProxyDeps): void {
  registerEntityRoutes<IncidentRowFe, IncidentCreateFe, IncidentUpdateFe>(app, deps, {
    factory: "in",
    route: "/api/incidents",
    defaultAttrs: DEFAULT_ATTRS,
    pkIsGuid: false,
    softClose: { kind: "status-CL" },
    customerMeAttr: "customer",
    mapRow,
    mapCreate,
    mapUpdate,
  });
}
