import type { QueryClient } from "@tanstack/react-query";
import type { Incident, ProblemId, TenantId } from "@sdm/domain";
import type { LinkedIncidentSummary, ProblemDetail, ProblemRow } from "./types";

/**
 * Problems data plumbing — `/api/problems` (list), `/api/problems/:id` (detail),
 * `/api/problems/:id/linked-incidents` (list/link/unlink), and a small convert
 * shim `POST /api/problems { from_incident_id }`.
 *
 * Linked-incidents BFF surface is **MSW-only in H.12** — per F.6 §24 the CA
 * SDM BREL nav doesn't work on this instance, so a real BFF mutation needs a
 * WC-query approach. That ships in a Phase I follow-up; today MSW gives the
 * FE the round-trip it needs for the link flow and the tests prove it end-to-end.
 *
 * Query keys mirror H.9/H.8: `tenantId` is part of the list key so the H.1
 * cross-tab tenant switch flush behaves the same as `/api/queue` and
 * `/api/changes`. Detail uses a stable 2-tuple so a linked-incidents mutation
 * can `setQueryData` directly.
 */

interface PageResponse<T> {
  readonly results: ReadonlyArray<T>;
  readonly totalCount: number;
  readonly start: number;
  readonly size: number;
}

async function jsonOrThrow<T>(resp: Response, op: string): Promise<T> {
  if (!resp.ok) {
    let detail = "";
    try {
      const body = (await resp.json()) as { message?: string };
      detail = body.message ? `: ${body.message}` : "";
    } catch {
      // body wasn't JSON — ignore.
    }
    throw new Error(`[${op}] HTTP ${resp.status}${detail}`);
  }
  return (await resp.json()) as T;
}

const PAGE_SIZE = 100;

async function fetchProblems(): Promise<ReadonlyArray<ProblemRow>> {
  const resp = await fetch(`/api/problems?page=0&size=${PAGE_SIZE}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const body = await jsonOrThrow<PageResponse<ProblemRow>>(resp, "problems-list");
  return body.results;
}

export function problemsListQuery(tenantId: TenantId) {
  return {
    queryKey: ["problems-list", tenantId] as const,
    queryFn: fetchProblems,
    refetchInterval: 30_000,
    staleTime: 15_000,
  };
}

export async function prefetchProblemsList(qc: QueryClient, tenantId: TenantId): Promise<void> {
  await qc.prefetchQuery(problemsListQuery(tenantId));
}

export function problemDetailQueryKey(id: string): readonly unknown[] {
  return ["problem-detail", id] as const;
}

export function problemDetailQuery(id: string) {
  return {
    queryKey: problemDetailQueryKey(id),
    queryFn: async (): Promise<ProblemDetail> => {
      const resp = await fetch(`/api/problems/${encodeURIComponent(id)}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      return jsonOrThrow<ProblemDetail>(resp, "problem-detail");
    },
    staleTime: 15_000,
  };
}

export function linkedIncidentsQueryKey(id: string): readonly unknown[] {
  return ["problem-linked-incidents", id] as const;
}

export function linkedIncidentsQuery(id: string) {
  return {
    queryKey: linkedIncidentsQueryKey(id),
    queryFn: async (): Promise<ReadonlyArray<LinkedIncidentSummary>> => {
      const resp = await fetch(`/api/problems/${encodeURIComponent(id)}/linked-incidents`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const body = await jsonOrThrow<{ incidents: ReadonlyArray<Incident> }>(
        resp,
        "linked-incidents",
      );
      return body.incidents.map((i) => ({
        id: i.id,
        ref: i.ref,
        summary: i.summary,
        status: i.status,
      }));
    },
    staleTime: 15_000,
  };
}

async function postJson<T>(path: string, body: unknown, op: string): Promise<T> {
  const resp = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  return jsonOrThrow<T>(resp, op);
}

async function patchJson<T>(path: string, body: unknown, op: string): Promise<T> {
  const resp = await fetch(path, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  return jsonOrThrow<T>(resp, op);
}

/**
 * L.1.C — Best-effort status PATCH for a problem. The BFF `/api/problems`
 * factory currently only exposes GET/PUT/DELETE via the generic entity-routes
 * registrar; this hits a PATCH path that is **not yet wired** in production —
 * the FE catches the failure and surfaces the `status.transition.unsupported`
 * toast so the UI is ready for backend catch-up without crashing.
 */
export function patchProblem(
  id: string,
  patch: { readonly statusCode?: string },
): Promise<ProblemDetail> {
  return patchJson<ProblemDetail>(
    `/api/problems/${encodeURIComponent(id)}`,
    patch,
    "problem-patch",
  );
}

async function deleteJson<T>(path: string, body: unknown, op: string): Promise<T> {
  const resp = await fetch(path, {
    method: "DELETE",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  return jsonOrThrow<T>(resp, op);
}

export interface LinkIncidentsResult {
  readonly problem: ProblemDetail;
  readonly incidents: ReadonlyArray<LinkedIncidentSummary>;
}

export function linkIncidents(
  id: string,
  incidentIds: ReadonlyArray<string>,
): Promise<LinkIncidentsResult> {
  return postJson<LinkIncidentsResult>(
    `/api/problems/${encodeURIComponent(id)}/linked-incidents`,
    { incidentIds },
    "problem-link-incidents",
  );
}

export function unlinkIncident(id: string, incidentId: string): Promise<LinkIncidentsResult> {
  return deleteJson<LinkIncidentsResult>(
    `/api/problems/${encodeURIComponent(id)}/linked-incidents`,
    { incidentId },
    "problem-unlink-incident",
  );
}

export interface ConvertIncidentBody {
  readonly fromIncidentId: string;
  readonly summary: string;
}

export interface ConvertIncidentResult {
  readonly problem: ProblemDetail;
  readonly incidentId: string;
}

/**
 * `POST /api/problems` with `{ from_incident_id, summary }` — MSW creates a
 * new problem seeded from the incident and links it back. In a real BFF the
 * shape would be a two-step (create problem + patch `in.rootcause_id`) when
 * the CA SDM `pr` factory doesn't accept `from_incident_id` directly.
 */
export function convertIncidentToProblem(
  body: ConvertIncidentBody,
): Promise<ConvertIncidentResult> {
  return postJson<ConvertIncidentResult>(
    `/api/problems`,
    { from_incident_id: body.fromIncidentId, summary: body.summary },
    "problem-convert-from-incident",
  );
}

async function fetchIncidents(): Promise<ReadonlyArray<Incident>> {
  const resp = await fetch(`/api/incidents?page=0&size=${PAGE_SIZE}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const body = await jsonOrThrow<PageResponse<Incident>>(resp, "incidents-list");
  return body.results;
}

/**
 * Incident search for the LinkIncidentModal. Reuses `/api/incidents` (already
 * tenant-scoped server-side) and filters client-side — MVP fixture sizes (<100
 * rows per tenant) make a dedicated search endpoint unnecessary.
 */
export function incidentSearchQuery() {
  return {
    queryKey: ["problem-link-modal-incidents"] as const,
    queryFn: fetchIncidents,
    staleTime: 30_000,
  };
}

export type { ProblemId };
