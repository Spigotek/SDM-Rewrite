import { http, HttpResponse } from "msw";
import { store } from "../db";
import type { CabApproval, Change } from "@sdm/domain";
import { paginate, readPageParams } from "../utils/pagination";
import { parseTenantFromRequest } from "../utils/tenant";
import { correlationIdFrom } from "../utils/correlation";
import { badRequest, notFound } from "../utils/errors";

interface ApproveBody {
  /** Legacy H.9 shape — `{ decision: "approve" | "reject" }` still accepted for back-compat. */
  decision?: "approve" | "reject";
  approverId?: string;
  comment?: string;
}

interface RejectBody {
  approverId?: string;
  reason?: string;
}

interface ReminderBody {
  approverId?: string;
}

function tenantChanges(tenant: string): Change[] {
  return store.changes.filter((c) => c.tenantId === tenant);
}

function applyDecision(
  approvers: readonly CabApproval[],
  approverId: string | undefined,
  decision: "APPROVED" | "REJECTED",
  comment: string | null,
  ts: string,
): readonly CabApproval[] {
  if (!approverId) {
    return approvers.map((a) => ({ ...a, decision, decidedAt: ts, comment }));
  }
  return approvers.map((a) =>
    a.approverId === approverId ? { ...a, decision, decidedAt: ts, comment } : a,
  );
}

function rollupApprovalState(approvers: readonly CabApproval[]): Change["approvalState"] {
  if (approvers.some((a) => a.decision === "REJECTED")) return "REJECTED";
  if (approvers.every((a) => a.decision === "APPROVED")) return "APPROVED";
  return "PENDING";
}

export const changeHandlers = [
  http.get("*/api/changes", ({ request }) => {
    const tenant = parseTenantFromRequest(request);
    const url = new URL(request.url);
    const all = tenantChanges(tenant);
    const status = url.searchParams.get("status");
    const filtered = status ? all.filter((c) => c.status === status) : all;
    return HttpResponse.json(paginate(filtered, readPageParams(url)));
  }),

  http.get("*/api/changes/:id", ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const id = String(params["id"] ?? "");
    const found = tenantChanges(tenant).find((c) => c.id === id);
    if (!found) return notFound("change", id, correlationIdFrom(request));
    return HttpResponse.json(found);
  }),

  /**
   * Approve. H.11 augments the H.9 baseline:
   *  - Accepts the new shape `{ approverId, comment? }` (decision implied).
   *  - Preserves the legacy `{ decision: "approve" | "reject" }` payload so
   *    the existing `modules.test.ts` integration test still passes.
   *  - Per-approver row update when `approverId` is provided; falls back to
   *    "all rows" (legacy behaviour) when absent.
   */
  http.post("*/api/changes/:id/approve", async ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const correlationId = correlationIdFrom(request);
    const id = String(params["id"] ?? "");
    const idx = store.changes.findIndex((c) => c.id === id && c.tenantId === tenant);
    if (idx === -1) return notFound("change", id, correlationId);
    const body = (await request.json().catch(() => ({}))) as ApproveBody;
    // Back-compat: legacy callers may send `decision: "reject"` on /approve.
    const isReject = body.decision === "reject";
    if (body.decision !== undefined && body.decision !== "approve" && body.decision !== "reject") {
      return badRequest("decision must be 'approve' or 'reject'", correlationId);
    }
    const ts = new Date().toISOString();
    const existing = store.changes[idx]!;
    const decision = isReject ? "REJECTED" : "APPROVED";
    const approvers = applyDecision(
      existing.cabApprovers,
      body.approverId,
      decision,
      body.comment ?? null,
      ts,
    );
    const approvalState = rollupApprovalState(approvers);
    const updated: Change = {
      ...existing,
      // Legacy contract returned `status: APPROVED|REJECTED` — keep so the
      // existing `modules.test.ts` assertion (`expect(body.status).toBe("APPROVED")`)
      // continues to pass.
      status: decision,
      approvalState,
      cabApprovers: approvers,
      lastModifiedAt: ts,
    };
    store.changes[idx] = updated;
    return HttpResponse.json(updated);
  }),

  http.post("*/api/changes/:id/reject", async ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const correlationId = correlationIdFrom(request);
    const id = String(params["id"] ?? "");
    const idx = store.changes.findIndex((c) => c.id === id && c.tenantId === tenant);
    if (idx === -1) return notFound("change", id, correlationId);
    const body = (await request.json().catch(() => ({}))) as RejectBody;
    if (!body.approverId || !body.approverId.trim()) {
      return badRequest("approverId is required", correlationId);
    }
    if (!body.reason || !body.reason.trim()) {
      return badRequest("reason is required", correlationId);
    }
    const ts = new Date().toISOString();
    const existing = store.changes[idx]!;
    const approvers = applyDecision(
      existing.cabApprovers,
      body.approverId,
      "REJECTED",
      body.reason.trim(),
      ts,
    );
    const updated: Change = {
      ...existing,
      status: "REJECTED",
      approvalState: rollupApprovalState(approvers),
      cabApprovers: approvers,
      lastModifiedAt: ts,
    };
    store.changes[idx] = updated;
    return HttpResponse.json(updated);
  }),

  http.post("*/api/changes/:id/reminder", async ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const correlationId = correlationIdFrom(request);
    const id = String(params["id"] ?? "");
    const found = tenantChanges(tenant).find((c) => c.id === id);
    if (!found) return notFound("change", id, correlationId);
    const body = (await request.json().catch(() => ({}))) as ReminderBody;
    if (!body.approverId || !body.approverId.trim()) {
      return badRequest("approverId is required", correlationId);
    }
    return HttpResponse.json({ ok: true, approverId: body.approverId.trim() });
  }),
];
