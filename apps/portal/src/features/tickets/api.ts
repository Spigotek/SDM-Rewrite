import type { UiTicketDetail } from "@sdm/api-types";
import type { QueryClient } from "@tanstack/react-query";
import type { PortalTicketType } from "./types";

/**
 * Portal ticket-detail data plumbing.
 *
 * Mirrors the workspace `tickets/api.ts` (H.8) for the shared
 * `/api/tickets/:type/:id` aggregator. The portal subset is read-only +
 * public-comment POST — none of the mutation helpers (`take`, `resolve`,
 * `escalate`, `patchTicket`) are exposed here because Lucia's persona is the
 * requester, not an agent.
 *
 * Query key shape stays compatible with the workspace key — both apps share
 * the BFF cache contract and the H.1 tenant invalidation handler nukes
 * `["ticket-detail", *, *]` on tenant switch.
 */

const BASE = "/api/tickets";

async function jsonOrThrow<T>(resp: Response, op: string): Promise<T> {
  if (!resp.ok) {
    let detail = "";
    try {
      const body = (await resp.json()) as { message?: string };
      detail = body.message ? `: ${body.message}` : "";
    } catch {
      // Body wasn't JSON — ignore.
    }
    const error = new Error(`[${op}] HTTP ${resp.status}${detail}`) as Error & {
      status?: number;
    };
    error.status = resp.status;
    throw error;
  }
  return (await resp.json()) as T;
}

export function ticketDetailQueryKey(type: PortalTicketType, id: string): readonly unknown[] {
  return ["ticket-detail", type, id] as const;
}

export function ticketDetailQuery(type: PortalTicketType, id: string) {
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

export function postPublicComment(
  type: PortalTicketType,
  id: string,
  text: string,
): Promise<UiTicketDetail> {
  return (async () => {
    const resp = await fetch(`${BASE}/${type}/${encodeURIComponent(id)}/comments`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ text, kind: "public" }),
    });
    return jsonOrThrow<UiTicketDetail>(resp, "ticket-detail.comment");
  })();
}

export async function prefetchTicketDetail(
  qc: QueryClient,
  type: PortalTicketType,
  id: string,
): Promise<void> {
  await qc.prefetchQuery(ticketDetailQuery(type, id));
}
