import type { TenantId } from "@sdm/domain";
import type { HelpfulnessSubmission, KbArticleDetail, KbSearchResult } from "./types";

/**
 * KB data plumbing — read-only MVP.
 *
 * Search:    `GET /api/kb?q=<term>&size=<n>`              → list shape
 * Detail:    `GET /api/kb/:id`                            → detail with markdown + related
 * Vote:      `POST /api/kb/articles/:id/helpfulness`      → mock-only signal
 *
 * The detail handler bakes the structured `KbContentBlock[]` body into
 * GFM markdown server-side so the FE has a single, sanitized render path
 * (`react-markdown` + `remark-gfm` + `rehype-sanitize`).
 *
 * The BFF entity route only exposes the slim list / detail shape today
 * (per `endpoints/kb.ts`, factory `KD`). The portal contract is therefore
 * loose-typed against the response payload — missing fields fall through
 * to safe defaults.
 */

interface PaginatedShape<T> {
  readonly data?: ReadonlyArray<T>;
  readonly results?: ReadonlyArray<T>;
}

async function jsonOrThrow<T>(resp: Response, op: string): Promise<T> {
  if (!resp.ok) {
    const error = new Error(`[${op}] HTTP ${resp.status}`) as Error & { status?: number };
    error.status = resp.status;
    throw error;
  }
  return (await resp.json()) as T;
}

function rowsOf<T>(payload: PaginatedShape<T>): ReadonlyArray<T> {
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.results)) return payload.results;
  return [];
}

interface KbSearchRowMixed {
  readonly id: string;
  readonly title?: string;
  readonly summary?: string | null;
  readonly snippet?: string;
  readonly categoryId?: string;
  readonly categoryName?: string | null;
  readonly helpfulCount?: number;
  readonly acceptedHits?: number;
  readonly readTimeMin?: number;
  readonly language?: "sk" | "en";
}

function toSearchResult(row: KbSearchRowMixed): KbSearchResult {
  return {
    id: row.id,
    title: row.title ?? "",
    snippet: row.snippet ?? (row.summary ?? "").slice(0, 160),
    categoryName: row.categoryName ?? null,
    helpfulCount: row.helpfulCount ?? row.acceptedHits ?? 0,
    readTimeMin: row.readTimeMin ?? 1,
    language: row.language ?? "sk",
  };
}

const SEARCH_PAGE_SIZE = 20;

async function fetchKbSearch(q: string): Promise<ReadonlyArray<KbSearchResult>> {
  const trimmed = q.trim();
  const params = new URLSearchParams({ size: String(SEARCH_PAGE_SIZE) });
  if (trimmed.length > 0) params.set("q", trimmed);
  const resp = await fetch(`/api/kb?${params.toString()}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const payload = await jsonOrThrow<PaginatedShape<KbSearchRowMixed>>(resp, "kb-search");
  return rowsOf(payload).map(toSearchResult);
}

export function kbSearchQuery(tenantId: TenantId, q: string) {
  return {
    queryKey: ["kb", tenantId, "search", q.trim()] as const,
    queryFn: () => fetchKbSearch(q),
    // Cache identical queries across re-mounts but invalidate when the
    // term changes — a stale page of results is still useful while the
    // user types the next character.
    staleTime: 60_000,
  };
}

interface KbArticleDetailMixed {
  readonly id: string;
  readonly title?: string;
  readonly markdown?: string;
  readonly categoryName?: string | null;
  readonly updatedAt?: string;
  readonly lastModifiedAt?: string;
  readonly readTimeMin?: number;
  readonly helpfulCount?: number;
  readonly acceptedHits?: number;
  readonly language?: "sk" | "en";
  readonly related?: ReadonlyArray<{
    readonly id: string;
    readonly title: string;
    readonly readTimeMin?: number;
  }>;
}

function toArticleDetail(row: KbArticleDetailMixed): KbArticleDetail {
  return {
    id: row.id,
    title: row.title ?? "",
    markdown: row.markdown ?? "",
    categoryName: row.categoryName ?? null,
    updatedAt: row.updatedAt ?? row.lastModifiedAt ?? "",
    readTimeMin: row.readTimeMin ?? 1,
    helpfulCount: row.helpfulCount ?? row.acceptedHits ?? 0,
    language: row.language ?? "sk",
    related: (row.related ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      readTimeMin: r.readTimeMin ?? 1,
    })),
  };
}

async function fetchKbArticle(id: string): Promise<KbArticleDetail> {
  const resp = await fetch(`/api/kb/${encodeURIComponent(id)}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const payload = await jsonOrThrow<KbArticleDetailMixed>(resp, "kb-article");
  return toArticleDetail(payload);
}

export function kbArticleQuery(tenantId: TenantId, id: string) {
  return {
    queryKey: ["kb", tenantId, "article", id] as const,
    queryFn: () => fetchKbArticle(id),
    staleTime: 5 * 60_000,
  };
}

export interface HelpfulnessResult {
  readonly ok: true;
  readonly tally: { readonly up: number; readonly down: number };
}

export async function postHelpfulness(
  id: string,
  payload: HelpfulnessSubmission,
): Promise<HelpfulnessResult> {
  const resp = await fetch(`/api/kb/articles/${encodeURIComponent(id)}/helpfulness`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow<HelpfulnessResult>(resp, "kb-helpfulness");
}
