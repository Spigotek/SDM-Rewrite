import type { UiTicketDetail, UiTicketType } from "@sdm/api-types";
import type { QueryClient } from "@tanstack/react-query";
import type { EscalatePayload, ResolvePayload } from "./types";

/**
 * Ticket-detail data plumbing.
 *
 * - `ticketDetailQuery` mirrors the BFF aggregator `/api/tickets/:type/:id`.
 *   The query key is `["ticket-detail", type, id]` — no tenant segment because
 *   the BFF scopes everything off the active session cookie, and switching
 *   tenants invalidates the entire cache via `H.1` cross-tab handler.
 * - Mutations all return the updated `UiTicketDetail` so the optimistic
 *   `setQueryData` after a successful round-trip swaps in the authoritative
 *   server state without a refetch.
 */

const BASE = "/api/tickets";

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

export interface TicketDetailKey {
  readonly type: UiTicketType;
  readonly id: string;
}

export function ticketDetailQueryKey(type: UiTicketType, id: string): readonly unknown[] {
  return ["ticket-detail", type, id] as const;
}

export function ticketDetailQuery(type: UiTicketType, id: string) {
  return {
    queryKey: ticketDetailQueryKey(type, id),
    queryFn: async (): Promise<UiTicketDetail> => {
      const resp = await fetch(`${BASE}/${type}/${encodeURIComponent(id)}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      return jsonOrThrow<UiTicketDetail>(resp, "ticket-detail");
    },
    staleTime: 15_000,
  };
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  return jsonOrThrow<T>(resp, path);
}

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(path, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  return jsonOrThrow<T>(resp, path);
}

export function take(type: UiTicketType, id: string): Promise<UiTicketDetail> {
  return postJson<UiTicketDetail>(`${BASE}/${type}/${encodeURIComponent(id)}/take`, {});
}

export function watch(type: UiTicketType, id: string): Promise<UiTicketDetail> {
  return postJson<UiTicketDetail>(`${BASE}/${type}/${encodeURIComponent(id)}/watch`, {});
}

export function resolve(
  type: UiTicketType,
  id: string,
  payload: ResolvePayload,
): Promise<UiTicketDetail> {
  return postJson<UiTicketDetail>(`${BASE}/${type}/${encodeURIComponent(id)}/resolve`, {
    solution: payload.solution,
    category: payload.category,
  });
}

export function escalate(
  type: UiTicketType,
  id: string,
  payload: EscalatePayload,
): Promise<UiTicketDetail> {
  return postJson<UiTicketDetail>(`${BASE}/${type}/${encodeURIComponent(id)}/escalate`, {
    note: payload.note,
    group: payload.group,
  });
}

export function postComment(
  type: UiTicketType,
  id: string,
  text: string,
  kind: "public" | "internal",
): Promise<UiTicketDetail> {
  return postJson<UiTicketDetail>(`${BASE}/${type}/${encodeURIComponent(id)}/comments`, {
    text,
    kind,
  });
}

export function patchTicket(
  type: UiTicketType,
  id: string,
  patch: Partial<{ status: string; priority: number }>,
): Promise<UiTicketDetail> {
  return patchJson<UiTicketDetail>(`${BASE}/${type}/${encodeURIComponent(id)}`, patch);
}

export async function prefetchTicketDetail(
  qc: QueryClient,
  type: UiTicketType,
  id: string,
): Promise<void> {
  await qc.prefetchQuery(ticketDetailQuery(type, id));
}
