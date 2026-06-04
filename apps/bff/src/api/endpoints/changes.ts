import type { Hono } from "hono";
import { z } from "zod";
import { AppErrorException } from "../../auth/errors";
import { consumeStepUpToken } from "../../auth/step-up-token";
import { AUDIT_EVENTS } from "../../platform/audit";
import { requireActiveSession } from "../../session/load";
import type { RestProxyDeps } from "../rest-proxy";
import { registerEntityRoutes } from "./_entity-routes";
import { epochSecToIso, liftAttrs, toFkRef, type CaSdmFk } from "./_shape";
import { hasPermission, type Permission, type UIRole } from "@sdm/domain";
import type { SessionPayload } from "../../session/types";

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

function rolesOf(session: SessionPayload): readonly UIRole[] {
  const active = session.tenants.find((t) => t.id === session.activeTenantId);
  return active ? active.roles.map((r) => r.uiRole) : [];
}

function requirePermission(session: SessionPayload, permission: Permission): void {
  if (!hasPermission(rolesOf(session), permission)) {
    throw new AppErrorException({
      code: "AUTH_FORBIDDEN",
      httpStatus: 403,
      message: `permission ${permission} required`,
    });
  }
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
  registerScheduleRoute(app, deps);
}

/**
 * H.11 CAB approval mutations — three explicit POST verbs so the audit trail
 * captures intent without parsing a `decision` field. All three reuse the F.4
 * `data.change.write` audit name (F.4 frozen — no new event taxonomy). The
 * reminder endpoint is a sentinel: it returns `{ ok: true, approverId }` so
 * the FE can dismiss the modal but does not mutate change state in CA SDM.
 *
 * I.1 step-up gate: approvals on changes with `category === "EMERGENCY"`
 * require an `X-Step-Up-Token` header minted by `POST /auth/step-up`. Tokens
 * are single-use, 15-min TTL, session-bound (see `step-up-token.ts`). A
 * missing/invalid token produces a 401 + `data.chg.write` audit with
 * `details.op = "cab.approve.denied_step_up"` so SIEM can flag failed
 * elevation attempts without expanding the F.4 event taxonomy. The
 * `tenant.environment === "production"` half of the policy is enforced
 * client-side (FE only prompts the modal in prod tenants) — defense-in-depth
 * is the EMERGENCY category check, which is the journey #11 trigger.
 */

interface ApproveBody {
  approverId?: unknown;
  comment?: unknown;
  /** I.1 step-up policy hint — FE passes the change's `category` so the BFF
   *  can decide whether to require `X-Step-Up-Token` without a CA SDM
   *  round-trip. EMERGENCY ⇒ require token. */
  category?: unknown;
}

const STEP_UP_REQUIRED_CATEGORIES = new Set<string>(["EMERGENCY"]);
const STEP_UP_HEADER = "x-step-up-token";

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
    const category = readOptionalString(body.category);
    const session = await requireActiveSession(c, deps);

    if (category !== undefined && STEP_UP_REQUIRED_CATEGORIES.has(category)) {
      const token = c.req.header(STEP_UP_HEADER);
      const ok =
        typeof token === "string" && token.length > 0
          ? consumeStepUpToken(token, session.sid)
          : false;
      if (!ok) {
        deps.audit?.(
          c,
          {
            category: "data",
            event: AUDIT_EVENTS.data.write("chg"),
            result: "denied",
            resultCode: 401,
            details: {
              op: "cab.approve.denied_step_up",
              recordId: id,
              approverId,
              category,
              reason: token ? "invalid_or_replayed" : "missing",
            },
          },
          session,
        );
        throw new AppErrorException({
          code: "STEP_UP_REQUIRED",
          httpStatus: 401,
          message: "Step-up authentication required for emergency change approval",
          details: { reason: token ? "invalid_or_replayed" : "missing" },
        });
      }
    }

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
          ...(category !== undefined ? { category } : {}),
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

/**
 * J.6 — calendar drag-resize PATCH endpoint.
 *
 * Graduates H.10 `editable: false`. Requires `change.schedule` permission
 * (semantically tighter than `change.update.plan`). Pre-fetches the current
 * change BEFORE writing so `previous_start_at` / `previous_end_at` are
 * captured for audit completeness per F.4 frozen taxonomy.
 *
 * No new audit event names — composes under `data.chg.write` factory with
 * `details.op="schedule.update"` discriminator.
 */

const ScheduleBody = z
  .object({
    scheduledStartAt: z.string().datetime(),
    scheduledEndAt: z.string().datetime(),
  })
  .refine((d) => new Date(d.scheduledEndAt) > new Date(d.scheduledStartAt), {
    message: "scheduledEndAt must be after scheduledStartAt",
    path: ["scheduledEndAt"],
  });

function registerScheduleRoute(app: Hono, deps: RestProxyDeps): void {
  app.patch("/api/changes/:id/schedule", async (c) => {
    const session = await requireActiveSession(c, deps);
    requirePermission(session, "change.schedule");

    const id = c.req.param("id");

    let bodyRaw: unknown;
    try {
      bodyRaw = await c.req.json();
    } catch {
      throw new AppErrorException({
        code: "VALIDATION",
        httpStatus: 400,
        message: "Request body must be valid JSON",
      });
    }

    const parsed = ScheduleBody.safeParse(bodyRaw);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const field = firstIssue?.path?.join(".") ?? "unknown";
      throw new AppErrorException({
        code: "VALIDATION",
        httpStatus: 400,
        message: firstIssue?.message ?? "Invalid schedule body",
        details: { field },
      });
    }

    const { scheduledStartAt, scheduledEndAt } = parsed.data;

    // Pre-fetch current change to capture previous timestamps for audit.
    // F.2 entity proxy returns 404 for cross-tenant or missing IDs — bubble up.
    const getResp = await deps.client.request({
      method: "GET",
      path: `/chg/${encodeURIComponent(id)}?attrs=${DEFAULT_ATTRS}`,
      headers: {
        "X-AccessKey": session.accessKey,
        Accept: "application/json",
      },
    });

    if (getResp.status === 404) {
      throw new AppErrorException({
        code: "NOT_FOUND",
        httpStatus: 404,
        message: `Change ${id} not found`,
      });
    }
    if (getResp.status < 200 || getResp.status >= 300) {
      throw new AppErrorException({
        code: "BACKEND_UNAVAILABLE",
        httpStatus: 502,
        message: `CA SDM GET /chg/${id} returned HTTP ${getResp.status}`,
      });
    }

    let currentRaw: Record<string, unknown>;
    try {
      currentRaw = JSON.parse(getResp.text) as Record<string, unknown>;
    } catch {
      currentRaw = {};
    }
    // Extract attributes (CA SDM wraps in { chg: { ... } })
    const currentAttrs = (currentRaw["chg"] as Record<string, unknown> | undefined) ?? currentRaw;
    const previousStartAt = epochSecToIso(
      currentAttrs["schedule_start_date"] as string | number | null | undefined,
    );
    const previousEndAt = epochSecToIso(
      currentAttrs["schedule_end_date"] as string | number | null | undefined,
    );

    // Convert ISO timestamps to epoch seconds for CA SDM PATCH.
    const startEpoch = Math.floor(new Date(scheduledStartAt).getTime() / 1000);
    const endEpoch = Math.floor(new Date(scheduledEndAt).getTime() / 1000);

    const patchBody = JSON.stringify({
      chg: {
        schedule_start_date: startEpoch,
        schedule_end_date: endEpoch,
      },
    });

    const patchResp = await deps.client.request({
      method: "PUT",
      path: `/chg/${encodeURIComponent(id)}`,
      headers: {
        "X-AccessKey": session.accessKey,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: patchBody,
    });

    if (patchResp.status < 200 || patchResp.status >= 300) {
      throw new AppErrorException({
        code: "BACKEND_UNAVAILABLE",
        httpStatus: 502,
        message: `CA SDM PUT /chg/${id} returned HTTP ${patchResp.status}`,
      });
    }

    // Emit audit under frozen F.4 taxonomy.
    deps.audit?.(
      c,
      {
        category: "data",
        event: AUDIT_EVENTS.data.write("chg"),
        result: "success",
        resultCode: 200,
        details: {
          op: "schedule.update",
          recordId: id,
          scheduled_start_at: scheduledStartAt,
          scheduled_end_at: scheduledEndAt,
          previous_start_at: previousStartAt,
          previous_end_at: previousEndAt,
        },
      },
      session,
    );

    // Build updated DTO from current attrs + new schedule.
    const updatedDto: ChangeRowFe = {
      ...mapRow(currentAttrs),
      scheduledStartAt,
      scheduledEndAt,
    };

    return c.json(updatedDto, 200);
  });
}
