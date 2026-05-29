import { http, HttpResponse } from "msw";
import { store } from "../db";
import {
  incidentId as toIncidentId,
  problemId as toProblemId,
  type Incident,
  type IncidentId,
  type Problem,
  type ProblemId,
} from "@sdm/domain";
import { paginate, readPageParams } from "../utils/pagination";
import { parseTenantFromRequest } from "../utils/tenant";
import { correlationIdFrom } from "../utils/correlation";
import { badRequest, notFound } from "../utils/errors";

/**
 * Problem handlers — H.12 augments the read-only F.2 baseline with the
 * link / unlink / convert mutations the FE needs for the RCA workflow.
 *
 * - `GET /api/problems/:id/linked-incidents` — returns the resolved
 *   incident summaries (was `related-incidents` pre-H.12; we keep the
 *   legacy alias so the existing integration tests don't break).
 * - `POST /api/problems/:id/linked-incidents` — link N incidents.
 * - `DELETE /api/problems/:id/linked-incidents` — unlink a single incident.
 * - `POST /api/problems` — convert-from-incident shim (`from_incident_id`).
 *
 * The linked side-effect runs both ways so the new linkage shows up in the
 * incident's `linkedProblemIds` too — that's how the RCA navigation surface
 * works once Phase I wires the BFF endpoint.
 */

function tenantProblems(tenant: string): Problem[] {
  return store.problems.filter((p) => p.tenantId === tenant);
}

function resolveLinkedIncidents(problem: Problem): Incident[] {
  return store.incidents.filter(
    (i) => i.tenantId === problem.tenantId && problem.linkedIncidentIds.includes(i.id),
  );
}

function patchProblemLinkage(
  tenant: string,
  problemId: ProblemId,
  incidentIds: ReadonlyArray<IncidentId>,
): Problem | null {
  const idx = store.problems.findIndex((p) => p.id === problemId && p.tenantId === tenant);
  if (idx === -1) return null;
  const existing = store.problems[idx]!;
  const merged = Array.from(new Set([...existing.linkedIncidentIds, ...incidentIds]));
  const updated: Problem = {
    ...existing,
    linkedIncidentIds: merged,
    lastModifiedAt: new Date().toISOString(),
  };
  store.problems[idx] = updated;
  // Backlink: the incident's `linkedProblemIds` mirrors the problem side so
  // the agent can navigate either direction once the BFF surfaces both.
  for (const iid of incidentIds) {
    const ii = store.incidents.findIndex((i) => i.id === iid && i.tenantId === tenant);
    if (ii === -1) continue;
    const inc = store.incidents[ii]!;
    if (!inc.linkedProblemIds.includes(problemId)) {
      store.incidents[ii] = {
        ...inc,
        linkedProblemIds: [...inc.linkedProblemIds, problemId],
        lastModifiedAt: new Date().toISOString(),
      };
    }
  }
  return updated;
}

function removeProblemLinkage(
  tenant: string,
  problemId: ProblemId,
  incidentId: IncidentId,
): Problem | null {
  const idx = store.problems.findIndex((p) => p.id === problemId && p.tenantId === tenant);
  if (idx === -1) return null;
  const existing = store.problems[idx]!;
  const updated: Problem = {
    ...existing,
    linkedIncidentIds: existing.linkedIncidentIds.filter((id) => id !== incidentId),
    lastModifiedAt: new Date().toISOString(),
  };
  store.problems[idx] = updated;
  const ii = store.incidents.findIndex((i) => i.id === incidentId && i.tenantId === tenant);
  if (ii !== -1) {
    const inc = store.incidents[ii]!;
    store.incidents[ii] = {
      ...inc,
      linkedProblemIds: inc.linkedProblemIds.filter((id) => id !== problemId),
      lastModifiedAt: new Date().toISOString(),
    };
  }
  return updated;
}

interface LinkBody {
  incidentIds?: unknown;
}

interface UnlinkBody {
  incidentId?: unknown;
}

interface ConvertBody {
  from_incident_id?: unknown;
  summary?: unknown;
}

function readIncidentIds(body: LinkBody): IncidentId[] | null {
  if (!Array.isArray(body.incidentIds)) return null;
  const out: IncidentId[] = [];
  for (const raw of body.incidentIds) {
    if (typeof raw !== "string" || raw.length === 0) return null;
    out.push(toIncidentId(raw));
  }
  return out;
}

function nextProblemRefNumber(): number {
  let max = 0;
  for (const p of store.problems) {
    const match = /^PR-(\d+)$/.exec(p.ref);
    if (match) {
      const n = Number.parseInt(match[1]!, 10);
      if (n > max) max = n;
    }
  }
  return max + 1;
}

function nextProblemId(): ProblemId {
  let max = 30000;
  for (const p of store.problems) {
    const match = /^problem:(\d+)$/.exec(p.id);
    if (match) {
      const n = Number.parseInt(match[1]!, 10);
      if (n > max) max = n;
    }
  }
  return toProblemId(`problem:${max + 1}`);
}

export const problemHandlers = [
  http.get("*/api/problems", ({ request }) => {
    const tenant = parseTenantFromRequest(request);
    const url = new URL(request.url);
    const all = tenantProblems(tenant);
    const status = url.searchParams.get("status");
    const filtered = status ? all.filter((p) => p.status === status) : all;
    return HttpResponse.json(paginate(filtered, readPageParams(url)));
  }),

  http.get("*/api/problems/:id", ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const id = String(params["id"] ?? "");
    const found = tenantProblems(tenant).find((p) => p.id === id);
    if (!found) return notFound("problem", id, correlationIdFrom(request));
    return HttpResponse.json(found);
  }),

  /**
   * Legacy `related-incidents` alias — pre-H.12 the BFF naming was inconsistent
   * (related vs linked). We keep both so existing tests + the H.12 FE keep
   * working off one source of truth.
   */
  http.get("*/api/problems/:id/related-incidents", ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const id = String(params["id"] ?? "");
    const problem = tenantProblems(tenant).find((p) => p.id === id);
    if (!problem) return notFound("problem", id, correlationIdFrom(request));
    return HttpResponse.json({ incidents: resolveLinkedIncidents(problem) });
  }),

  http.get("*/api/problems/:id/linked-incidents", ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const id = String(params["id"] ?? "");
    const problem = tenantProblems(tenant).find((p) => p.id === id);
    if (!problem) return notFound("problem", id, correlationIdFrom(request));
    return HttpResponse.json({ incidents: resolveLinkedIncidents(problem) });
  }),

  http.post("*/api/problems/:id/linked-incidents", async ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const correlationId = correlationIdFrom(request);
    const id = String(params["id"] ?? "");
    const body = (await request.json().catch(() => ({}))) as LinkBody;
    const incidentIds = readIncidentIds(body);
    if (!incidentIds || incidentIds.length === 0) {
      return badRequest("incidentIds[] is required", correlationId);
    }
    const updated = patchProblemLinkage(tenant, toProblemId(id), incidentIds);
    if (!updated) return notFound("problem", id, correlationId);
    return HttpResponse.json({
      problem: updated,
      incidents: resolveLinkedIncidents(updated),
    });
  }),

  http.delete("*/api/problems/:id/linked-incidents", async ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const correlationId = correlationIdFrom(request);
    const id = String(params["id"] ?? "");
    const body = (await request.json().catch(() => ({}))) as UnlinkBody;
    if (typeof body.incidentId !== "string" || body.incidentId.length === 0) {
      return badRequest("incidentId is required", correlationId);
    }
    const updated = removeProblemLinkage(tenant, toProblemId(id), toIncidentId(body.incidentId));
    if (!updated) return notFound("problem", id, correlationId);
    return HttpResponse.json({
      problem: updated,
      incidents: resolveLinkedIncidents(updated),
    });
  }),

  /**
   * Convert-from-incident shim. CA SDM doesn't accept `from_incident_id` on a
   * `pr` POST today, so the real BFF will translate this into a two-step
   * (create problem + patch `in.rootcause_id`). Here we just synth a new
   * problem in-store and link it back to the source incident.
   */
  http.post("*/api/problems", async ({ request }) => {
    const tenant = parseTenantFromRequest(request);
    const correlationId = correlationIdFrom(request);
    const body = (await request.json().catch(() => ({}))) as ConvertBody;
    if (typeof body.summary !== "string" || body.summary.trim().length === 0) {
      return badRequest("summary is required", correlationId);
    }
    if (typeof body.from_incident_id !== "string" || body.from_incident_id.length === 0) {
      return badRequest("from_incident_id is required", correlationId);
    }
    const sourceIncident = store.incidents.find(
      (i) => i.id === body.from_incident_id && i.tenantId === tenant,
    );
    if (!sourceIncident) {
      return notFound("incident", String(body.from_incident_id), correlationId);
    }
    const newId = nextProblemId();
    const refNum = nextProblemRefNumber();
    const now = new Date().toISOString();
    const newProblem: Problem = {
      id: newId,
      ref: `PR-${String(refNum).padStart(5, "0")}`,
      summary: body.summary.trim(),
      description: sourceIncident.description ?? "",
      priority: sourceIncident.priority,
      urgency: sourceIncident.urgency,
      impact: sourceIncident.impact,
      status: "IDENTIFIED",
      category: null,
      rootCause: null,
      isMajor: sourceIncident.isMajor,
      linkedIncidentIds: [sourceIncident.id],
      linkedChangeIds: [],
      linkedKbArticleIds: [],
      assigneeId: sourceIncident.assigneeId,
      assignedGroupId: sourceIncident.assignedGroupId,
      openedAt: now,
      targetStartAt: null,
      resolvedAt: null,
      closedAt: null,
      createdAt: now,
      lastModifiedAt: now,
      tenantId: sourceIncident.tenantId,
    };
    store.problems.push(newProblem);
    // Backlink on the source incident.
    const ii = store.incidents.findIndex((i) => i.id === sourceIncident.id);
    if (ii !== -1) {
      const inc = store.incidents[ii]!;
      store.incidents[ii] = {
        ...inc,
        linkedProblemIds: [...inc.linkedProblemIds, newId],
        rootCause: inc.rootCause ?? body.summary.trim(),
        lastModifiedAt: now,
      };
    }
    return HttpResponse.json(
      { problem: newProblem, incidentId: sourceIncident.id },
      { status: 201 },
    );
  }),
];
