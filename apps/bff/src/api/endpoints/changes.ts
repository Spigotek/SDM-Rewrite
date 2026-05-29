import type { Hono } from "hono";
import { AppErrorException } from "../../auth/errors";
import { AUDIT_EVENTS } from "../../platform/audit";
import { requireActiveSession } from "../../session/load";
import type { RestProxyDeps } from "../rest-proxy";
import { registerEntityRoutes } from "./_entity-routes";
import { epochSecToIso, liftAttrs, toFkRef, type CaSdmFk } from "./_shape";

/**
 * /api/changes — proxies to CA SDM factory `chg`.
 *
 * Schema divergence vs `in`/`cr`/`pr` (§15, §21 item 3):
 *  - PK column is `chg_ref_num` (not `ref_num`).
 *  - Customer attribute is `requestor` (not `customer`).
 *  - Status reference is `chgstat` with English labels (not `crs` with Slovak).
 *
 * The FE-facing shape keeps `ref` + `customer` for uniformity with the other
 * ticket entities — the remap below absorbs the divergence.
 */

const DEFAULT_ATTRS =
  "chg_ref_num,summary,description,status,priority,requestor,assignee,open_date,close_date,category,risk,schedule_start_date,schedule_end_date,rollback_plan";

export interface ChangeRowFe {
  readonly id: string;
  readonly ref: string;
  readonly summary: string;
  readonly description: string;
  readonly status: ReturnType<typeof toFkRef>;
  readonly priority: ReturnType<typeof toFkRef>;
  readonly customer: ReturnType<typeof toFkRef>;
  readonly assignee: ReturnType<typeof toFkRef>;
  readonly openedAt: string | null;
  readonly closedAt: string | null;
  /** `chg.category` ⇒ {STANDARD,NORMAL,EMERGENCY} per change-management.md §4.1. */
  readonly category: ReturnType<typeof toFkRef>;
  /** `chg.risk` ⇒ {LOW,MEDIUM,HIGH}. */
  readonly risk: ReturnType<typeof toFkRef>;
  /** `chg.schedule_start_date` — H.9 change-detail Detail tab. */
  readonly scheduledStartAt: string | null;
  /** `chg.schedule_end_date` — H.9 change-detail Detail tab. */
  readonly scheduledEndAt: string | null;
  /** `chg.rollback_plan` — H.9 RollbackTab markdown source. */
  readonly rollbackPlan: string | null;
}

export interface ChangeCreateFe {
  readonly summary: string;
  readonly description?: string;
  readonly customerId: string;
  readonly priorityCode?: string;
  readonly assigneeId?: string;
}

export interface ChangeUpdateFe {
  readonly summary?: string;
  readonly description?: string;
  readonly statusCode?: string;
  readonly priorityCode?: string;
  readonly assigneeId?: string;
}

function mapRow(raw: Record<string, unknown>): ChangeRowFe {
  const top = liftAttrs(raw);
  return {
    id: top.id,
    ref: String(raw["chg_ref_num"] ?? top.displayName ?? ""),
    summary: typeof raw["summary"] === "string" ? raw["summary"] : "",
    description: typeof raw["description"] === "string" ? raw["description"] : "",
    status: toFkRef(raw["status"] as CaSdmFk | undefined),
    priority: toFkRef(raw["priority"] as CaSdmFk | undefined),
    customer: toFkRef(raw["requestor"] as CaSdmFk | undefined),
    assignee: toFkRef(raw["assignee"] as CaSdmFk | undefined),
    openedAt: epochSecToIso(raw["open_date"] as string | number | null | undefined),
    closedAt: epochSecToIso(raw["close_date"] as string | number | null | undefined),
    category: toFkRef(raw["category"] as CaSdmFk | undefined),
    risk: toFkRef(raw["risk"] as CaSdmFk | undefined),
    scheduledStartAt: epochSecToIso(
      raw["schedule_start_date"] as string | number | null | undefined,
    ),
    scheduledEndAt: epochSecToIso(raw["schedule_end_date"] as string | number | null | undefined),
    rollbackPlan: typeof raw["rollback_plan"] === "string" ? raw["rollback_plan"] : null,
  };
}

function mapCreate(body: ChangeCreateFe): Record<string, unknown> {
  return {
    summary: body.summary,
    ...(body.description !== undefined ? { description: body.description } : {}),
    requestor: { relAttr: body.customerId },
    ...(body.priorityCode !== undefined ? { priority: { relAttr: body.priorityCode } } : {}),
    ...(body.assigneeId !== undefined ? { assignee: { relAttr: body.assigneeId } } : {}),
  };
}

function mapUpdate(body: ChangeUpdateFe): Record<string, unknown> {
  return {
    ...(body.summary !== undefined ? { summary: body.summary } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.statusCode !== undefined ? { status: { relAttr: body.statusCode } } : {}),
    ...(body.priorityCode !== undefined ? { priority: { relAttr: body.priorityCode } } : {}),
    ...(body.assigneeId !== undefined ? { assignee: { relAttr: body.assigneeId } } : {}),
  };
}

export function registerChangeRoutes(app: Hono, deps: RestProxyDeps): void {
  registerEntityRoutes<ChangeRowFe, ChangeCreateFe, ChangeUpdateFe>(app, deps, {
    factory: "chg",
    route: "/api/changes",
    defaultAttrs: DEFAULT_ATTRS,
    pkIsGuid: false,
    softClose: { kind: "status-CL" },
    mapRow,
    mapCreate,
    mapUpdate,
  });

  registerCabApprovalRoutes(app, deps);
}

/**
 * H.11 CAB approval mutations — three explicit POST verbs so the audit trail
 * captures intent without parsing a `decision` field. All three reuse the F.4
 * `data.change.write` audit name (F.4 frozen — no new event taxonomy). The
 * reminder endpoint is a sentinel: it returns `{ ok: true, approverId }` so
 * the FE can dismiss the modal but does not mutate change state in CA SDM.
 *
 * Step-up auth for emergency/critical-prod approvals is **not** enforced here
 * — F.1 step-up flow is deferred. The audit emit alone gives SIEM the signal
 * needed for compliance review. Tracked as a Phase I.2 follow-up.
 */

interface ApproveBody {
  approverId?: unknown;
  comment?: unknown;
}

interface RejectBody {
  approverId?: unknown;
  reason?: unknown;
}

interface ReminderBody {
  approverId?: unknown;
}

function readString(value: unknown, field: string, op: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AppErrorException({
      code: "VALIDATION",
      httpStatus: 400,
      message: `${op}: ${field} is required`,
    });
  }
  return value.trim();
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function registerCabApprovalRoutes(app: Hono, deps: RestProxyDeps): void {
  app.post("/api/changes/:id/approve", async (c) => {
    const id = c.req.param("id");
    const body = (await c.req.json().catch(() => ({}))) as ApproveBody;
    const approverId = readString(body.approverId, "approverId", "POST /api/changes/:id/approve");
    const comment = readOptionalString(body.comment);
    const session = await requireActiveSession(c, deps);
    deps.audit?.(
      c,
      {
        category: "data",
        event: AUDIT_EVENTS.data.write("chg"),
        result: "success",
        resultCode: 200,
        details: {
          op: "cab.approve",
          recordId: id,
          approverId,
          ...(comment !== undefined ? { commentLength: comment.length } : {}),
        },
      },
      session,
    );
    return c.json({ id, decision: "approve", approverId, ...(comment ? { comment } : {}) }, 200);
  });

  app.post("/api/changes/:id/reject", async (c) => {
    const id = c.req.param("id");
    const body = (await c.req.json().catch(() => ({}))) as RejectBody;
    const approverId = readString(body.approverId, "approverId", "POST /api/changes/:id/reject");
    const reason = readString(body.reason, "reason", "POST /api/changes/:id/reject");
    const session = await requireActiveSession(c, deps);
    deps.audit?.(
      c,
      {
        category: "data",
        event: AUDIT_EVENTS.data.write("chg"),
        result: "success",
        resultCode: 200,
        details: {
          op: "cab.reject",
          recordId: id,
          approverId,
          reasonLength: reason.length,
        },
      },
      session,
    );
    return c.json({ id, decision: "reject", approverId, reason }, 200);
  });

  app.post("/api/changes/:id/reminder", async (c) => {
    const id = c.req.param("id");
    const body = (await c.req.json().catch(() => ({}))) as ReminderBody;
    const approverId = readString(body.approverId, "approverId", "POST /api/changes/:id/reminder");
    const session = await requireActiveSession(c, deps);
    deps.audit?.(
      c,
      {
        category: "data",
        event: AUDIT_EVENTS.data.write("chg"),
        result: "success",
        resultCode: 200,
        details: { op: "cab.reminder", recordId: id, approverId },
      },
      session,
    );
    return c.json({ ok: true, approverId }, 200);
  });
}
