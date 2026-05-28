import type { QueryClient } from "@tanstack/react-query";
import type { TenantId } from "@sdm/domain";
import type { TicketStatus } from "@sdm/design-system";
import type { KbSuggestion, MyTicketSummary } from "./types";

/**
 * Home dashboard data plumbing.
 *
 * Two query factories — `myTicketsQuery` and `kbSuggestionsQuery` — both keyed
 * by the active tenant (matches H.1 invalidation strategy: tenant switch nukes
 * every non-`["me"]` query so the new tenant's data is refetched).
 *
 * Both query functions normalise the two paginated shapes that can land on
 * the same `/api/*` endpoint:
 *  - BFF entity route → `{ data: [...], page: { total, start, size } }`
 *  - MSW dev mode    → `{ results: [...], totalCount, start, size }`
 * The home feature only needs a slim row projection (`MyTicketSummary` /
 * `KbSuggestion`), so the normalisation is a 1-pass map at the network edge.
 */

const MY_TICKETS_PAGE_SIZE = 5;
const KB_SUGGESTIONS_PAGE_SIZE = 3;
const KB_EXCERPT_MAX = 140;

interface PaginatedShape<T> {
  readonly data?: ReadonlyArray<T>;
  readonly results?: ReadonlyArray<T>;
}

function rowsOf<T>(payload: PaginatedShape<T>): ReadonlyArray<T> {
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.results)) return payload.results;
  return [];
}

async function jsonOrThrow<T>(resp: Response, op: string): Promise<T> {
  if (!resp.ok) throw new Error(`[${op}] HTTP ${resp.status}`);
  return (await resp.json()) as T;
}

// ─── My recent tickets ──────────────────────────────────────────────────────

/**
 * Maps both incident shapes (BFF `IncidentRowFe.status: FkRef` and MSW
 * `Incident.status: IncidentStatus` literal) into the design-system
 * `TicketStatus` vocabulary the `<StatusBadge>` understands. Unknown codes
 * fall back to `"open"` so the badge never crashes a render.
 */
function normaliseStatus(raw: unknown): TicketStatus {
  const code =
    typeof raw === "string"
      ? raw
      : raw &&
          typeof raw === "object" &&
          "code" in raw &&
          typeof (raw as { code: unknown }).code === "string"
        ? (raw as { code: string }).code
        : "";
  switch (code) {
    case "OP":
      return "open";
    case "WIP":
      return "in_progress";
    case "HLD":
      return "hold";
    case "AWU":
    case "AWV":
      return "pending";
    case "RES":
      return "resolved";
    case "CL":
    case "CD":
      return "closed";
    case "ESC":
      return "open";
    default:
      return "open";
  }
}

interface IncidentRowMixed {
  readonly id: string;
  readonly ref?: string;
  readonly summary?: string;
  readonly status?: unknown;
  readonly openedAt?: string | null;
  readonly lastModifiedAt?: string | null;
  readonly resolvedAt?: string | null;
}

function toMyTicketSummary(row: IncidentRowMixed): MyTicketSummary {
  return {
    id: row.id,
    ref: row.ref ?? row.id,
    summary: row.summary ?? "",
    status: normaliseStatus(row.status),
    updatedAt: row.lastModifiedAt ?? row.openedAt ?? null,
  };
}

async function fetchMyTickets(): Promise<ReadonlyArray<MyTicketSummary>> {
  const params = new URLSearchParams({
    customer: "me",
    size: String(MY_TICKETS_PAGE_SIZE),
    sort: "open_date DESC",
  });
  const resp = await fetch(`/api/incidents?${params.toString()}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const payload = await jsonOrThrow<PaginatedShape<IncidentRowMixed>>(resp, "my-tickets");
  return rowsOf(payload).slice(0, MY_TICKETS_PAGE_SIZE).map(toMyTicketSummary);
}

export function myTicketsQuery(tenantId: TenantId) {
  return {
    queryKey: ["tickets", tenantId, "my-recent"] as const,
    queryFn: fetchMyTickets,
    staleTime: 60_000,
  };
}

// ─── KB suggestions ─────────────────────────────────────────────────────────

interface KbRowMixed {
  readonly id: string;
  readonly title?: string;
  readonly summary?: string | null;
  readonly resolution?: string;
}

function shortExcerpt(text: string | null | undefined): string {
  if (!text) return "";
  const stripped = text.replace(/\s+/g, " ").trim();
  if (stripped.length <= KB_EXCERPT_MAX) return stripped;
  return `${stripped.slice(0, KB_EXCERPT_MAX - 1).trimEnd()}…`;
}

function toKbSuggestion(row: KbRowMixed): KbSuggestion {
  return {
    id: row.id,
    title: row.title ?? "",
    excerpt: shortExcerpt(row.summary ?? row.resolution ?? ""),
  };
}

async function fetchKbSuggestions(): Promise<ReadonlyArray<KbSuggestion>> {
  // Per H.2.md open items: `?context=home` is not implemented by the BFF, so
  // the fallback is a sized, sorted list. `helpfulness` is not a CA SDM `KD`
  // attribute (real-backend-contracts.md §16) so we keep the URL clean: just
  // a small page. The MSW handler ignores `sort` and returns the first N
  // tenant articles, which mirrors what a real "popular articles" endpoint
  // would do once the BFF gains a dedicated `/api/kb/popular` route.
  const params = new URLSearchParams({
    size: String(KB_SUGGESTIONS_PAGE_SIZE),
    context: "home",
  });
  const resp = await fetch(`/api/kb?${params.toString()}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const payload = await jsonOrThrow<PaginatedShape<KbRowMixed>>(resp, "kb-suggestions");
  return rowsOf(payload).slice(0, KB_SUGGESTIONS_PAGE_SIZE).map(toKbSuggestion);
}

export function kbSuggestionsQuery(tenantId: TenantId) {
  return {
    queryKey: ["kb", tenantId, "home-suggestions"] as const,
    queryFn: fetchKbSuggestions,
    staleTime: 5 * 60_000,
  };
}

// ─── Loader prefetch ────────────────────────────────────────────────────────

export async function prefetchHome(queryClient: QueryClient, tenantId: TenantId): Promise<void> {
  await Promise.all([
    queryClient.ensureQueryData(myTicketsQuery(tenantId)),
    queryClient.ensureQueryData(kbSuggestionsQuery(tenantId)),
  ]);
}
