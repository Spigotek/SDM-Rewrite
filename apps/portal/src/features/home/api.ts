import type { QueryClient } from "@tanstack/react-query";
import type { TenantId } from "@sdm/domain";
import type { Severity, TicketStatus } from "@sdm/design-system";
import type { HomeStats, KbAutocompleteHit, MyTicketSummary, RecentActivityEvent } from "./types";

/**
 * Home dashboard data plumbing.
 *
 * Three query factories — `myTicketsQuery` (top-5 for the open-tickets card),
 * `myAllTicketsQuery` (top-50, drives KPI stats + recent activity + the
 * `/tickets` route), and `kbAutocompleteQuery` (search dropdown). All keyed
 * by the active tenant (matches H.1 invalidation strategy: tenant switch
 * nukes every non-`["me"]` query so the new tenant's data is refetched).
 *
 * Query functions normalise the two paginated shapes that can land on
 * the same `/api/*` endpoint:
 *  - BFF entity route → `{ data: [...], page: { total, start, size } }`
 *  - MSW dev mode    → `{ results: [...], totalCount, start, size }`
 * The home feature only needs slim row projections (`MyTicketSummary` /
 * `KbAutocompleteHit`), so normalisation is a 1-pass map at the network edge.
 */

const MY_TICKETS_PAGE_SIZE = 5;
const MY_ALL_TICKETS_PAGE_SIZE = 50;
const KB_AUTOCOMPLETE_PAGE_SIZE = 6;
const KB_SNIPPET_MAX = 80;
const RECENT_ACTIVITY_LIMIT = 10;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

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
  readonly priority?: unknown;
  readonly openedAt?: string | null;
  readonly lastModifiedAt?: string | null;
  readonly resolvedAt?: string | null;
}

/**
 * Best-effort `priority.code` extraction — BFF emits `FkRef { code, label }`
 * shape. CA SDM uses `pri` 1..5 (`pri:500`, `pri:400`, ...) or string codes.
 */
function readCode(raw: unknown): string | null {
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object" && "code" in raw) {
    const code = (raw as { code: unknown }).code;
    if (typeof code === "string") return code;
    if (typeof code === "number") return String(code);
  }
  return null;
}

function normalisePriority(raw: unknown): Severity | null {
  const code = readCode(raw);
  if (!code) return null;
  // CA SDM priority codes: pri:500=1 critical, pri:400=2 high, pri:300=3 medium,
  // pri:200=4 low, pri:100=5 none. Real-tenant deployments sometimes emit the
  // bare integer or the legacy "P1".."P4" alias — handle all three flavours.
  const norm = code.toUpperCase();
  if (norm === "P1" || norm === "1" || norm === "PRI:500" || norm === "CRITICAL") return "critical";
  if (norm === "P2" || norm === "2" || norm === "PRI:400" || norm === "HIGH") return "high";
  if (norm === "P3" || norm === "3" || norm === "PRI:300" || norm === "MEDIUM") return "medium";
  if (norm === "P4" || norm === "4" || norm === "PRI:200" || norm === "LOW") return "low";
  if (norm === "P5" || norm === "5" || norm === "PRI:100" || norm === "NONE") return "none";
  return null;
}

function toMyTicketSummary(row: IncidentRowMixed): MyTicketSummary {
  return {
    id: row.id,
    ref: row.ref ?? row.id,
    summary: row.summary ?? "",
    status: normaliseStatus(row.status),
    statusCode: readCode(row.status),
    priority: normalisePriority(row.priority),
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

async function fetchAllMyTickets(): Promise<ReadonlyArray<MyTicketSummary>> {
  const params = new URLSearchParams({
    customer: "me",
    size: String(MY_ALL_TICKETS_PAGE_SIZE),
    sort: "open_date DESC",
  });
  const resp = await fetch(`/api/incidents?${params.toString()}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const payload = await jsonOrThrow<PaginatedShape<IncidentRowMixed>>(resp, "my-all-tickets");
  return rowsOf(payload).slice(0, MY_ALL_TICKETS_PAGE_SIZE).map(toMyTicketSummary);
}

export function myAllTicketsQuery(tenantId: TenantId) {
  return {
    queryKey: ["tickets", tenantId, "my-all"] as const,
    queryFn: fetchAllMyTickets,
    staleTime: 60_000,
  };
}

// ─── KB autocomplete (home search box) ──────────────────────────────────────

interface KbRowMixed {
  readonly id: string;
  readonly title?: string;
  readonly summary?: string | null;
  readonly resolution?: string;
  readonly snippet?: string;
}

function toKbAutocompleteHit(row: KbRowMixed): KbAutocompleteHit {
  const snippetSource = row.snippet ?? row.summary ?? row.resolution ?? "";
  const stripped = snippetSource.replace(/\s+/g, " ").trim();
  const snippet =
    stripped.length <= KB_SNIPPET_MAX
      ? stripped
      : `${stripped.slice(0, KB_SNIPPET_MAX - 1).trimEnd()}…`;
  return {
    id: row.id,
    title: row.title ?? "",
    snippet,
  };
}

async function fetchKbAutocomplete(q: string): Promise<ReadonlyArray<KbAutocompleteHit>> {
  const trimmed = q.trim();
  const params = new URLSearchParams({ size: String(KB_AUTOCOMPLETE_PAGE_SIZE) });
  if (trimmed.length > 0) params.set("q", trimmed);
  const resp = await fetch(`/api/kb?${params.toString()}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const payload = await jsonOrThrow<PaginatedShape<KbRowMixed>>(resp, "kb-autocomplete");
  return rowsOf(payload).slice(0, KB_AUTOCOMPLETE_PAGE_SIZE).map(toKbAutocompleteHit);
}

export function kbAutocompleteQuery(tenantId: TenantId, q: string) {
  return {
    queryKey: ["kb", tenantId, "home-autocomplete", q.trim()] as const,
    queryFn: () => fetchKbAutocomplete(q),
    staleTime: 60_000,
  };
}

// ─── Client-side derivations (stats + activity feed) ────────────────────────

const OPEN_STATUSES: ReadonlyArray<TicketStatus> = ["new", "open", "in_progress", "reopened"];
const AWAITING_STATUSES: ReadonlyArray<TicketStatus> = [
  "pending",
  "waiting_customer",
  "waiting_vendor",
  "hold",
];
const RESOLVED_STATUSES: ReadonlyArray<TicketStatus> = ["resolved", "closed"];

/**
 * Bucket the user's tickets into the three KPI strips Lucia sees on the
 * home dashboard. Pure projection — no network calls; safe to call inside
 * `useMemo`. `now` is injected for test determinism.
 */
export function deriveHomeStats(
  tickets: ReadonlyArray<MyTicketSummary>,
  now: number = Date.now(),
): HomeStats {
  let open = 0;
  let awaiting = 0;
  let resolvedThisWeek = 0;
  for (const t of tickets) {
    if (OPEN_STATUSES.includes(t.status)) {
      open += 1;
    } else if (AWAITING_STATUSES.includes(t.status)) {
      awaiting += 1;
    } else if (RESOLVED_STATUSES.includes(t.status)) {
      const ts = t.updatedAt ? Date.parse(t.updatedAt) : NaN;
      if (Number.isFinite(ts) && now - ts <= WEEK_MS) {
        resolvedThisWeek += 1;
      }
    }
  }
  return { open, awaiting, resolvedThisWeek };
}

/**
 * Synthesise an activity feed by ordering the user's tickets newest-first and
 * surfacing a single status-change row per ticket. The BFF doesn't expose a
 * dedicated activity endpoint yet (K.1 §10.1 explicitly permits the client-
 * side fallback), so this is the cheapest "Posledná aktivita" placeholder.
 */
export function deriveRecentActivity(
  tickets: ReadonlyArray<MyTicketSummary>,
): ReadonlyArray<RecentActivityEvent> {
  const events: RecentActivityEvent[] = [];
  for (const t of tickets) {
    if (!t.updatedAt) continue;
    events.push({
      id: `${t.id}-${t.updatedAt}`,
      ticketId: t.id,
      ticketRef: t.ref,
      status: t.status,
      timestamp: t.updatedAt,
    });
  }
  events.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  return events.slice(0, RECENT_ACTIVITY_LIMIT);
}

// ─── Loader prefetch ────────────────────────────────────────────────────────

export async function prefetchHome(queryClient: QueryClient, tenantId: TenantId): Promise<void> {
  await Promise.all([
    queryClient.ensureQueryData(myTicketsQuery(tenantId)),
    queryClient.ensureQueryData(myAllTicketsQuery(tenantId)),
  ]);
}
