import { http, HttpResponse } from "msw";
import { store } from "../db";
import type { Change } from "@sdm/domain";
import { paginate, readPageParams } from "../utils/pagination";
import { parseTenantFromRequest } from "../utils/tenant";
import { correlationIdFrom } from "../utils/correlation";
import { badRequest, notFound } from "../utils/errors";

interface ApprovalBody {
  decision?: "approve" | "reject";
  comment?: string;
}

function tenantChanges(tenant: string): Change[] {
  return store.changes.filter((c) => c.tenantId === tenant);
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

  http.post("*/api/changes/:id/approve", async ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const correlationId = correlationIdFrom(request);
    const id = String(params["id"] ?? "");
    const idx = store.changes.findIndex((c) => c.id === id && c.tenantId === tenant);
    if (idx === -1) return notFound("change", id, correlationIdFrom(request));
    const body = (await request.json().catch(() => ({}))) as ApprovalBody;
    if (body.decision !== "approve" && body.decision !== "reject") {
      return badRequest("decision must be 'approve' or 'reject'", correlationId);
    }
    const existing = store.changes[idx]!;
    const updated: Change = {
      ...existing,
      status: body.decision === "approve" ? "APPROVED" : "REJECTED",
      approvalState: body.decision === "approve" ? "APPROVED" : "REJECTED",
      lastModifiedAt: new Date().toISOString(),
    };
    store.changes[idx] = updated;
    return HttpResponse.json(updated);
  }),
];
