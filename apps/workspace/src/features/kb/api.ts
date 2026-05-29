import type { TenantId } from "@sdm/domain";
import type {
  KbArticleDetail,
  KbArticleStats,
  KbBrowseRow,
  KbCategoryOption,
  KbLanguage,
} from "./types";

/**
 * Workspace KB data plumbing — read-only MVP (H.15, Jana flow).
 *
 * List:      `GET /api/kb?size=<n>`                       → all published articles
 * Detail:    `GET /api/kb/:id`                            → article + stats + markdown
 * Categories:`GET /api/kb/categories`                     → filter chip source
 *
 * The detail handler bakes the structured `KbContentBlock[]` body into GFM
 * markdown server-side so the FE has a single, sanitized render path
 * (`react-markdown` + `remark-gfm` + `rehype-sanitize` via the `vendor-markdown`
 * chunk — same approach as the portal H.6 + workspace H.9 rollback tab).
 *
 * MSW (H.15 augmentation) augments the search/detail row with `viewCount` (CA
 * SDM `hits`), `helpfulCount` (`acceptedHits`), and the derived `helpfulnessRatio`.
 * Real BFF contract gap tracked in wireframe `[GAP-4]`.
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

interface KbBrowseRowMixed {
  readonly id: string;
  readonly title?: string;
  readonly categoryId?: string | null;
  readonly categoryName?: string | null;
  readonly helpfulCount?: number;
  readonly viewCount?: number;
  readonly acceptedHits?: number;
  readonly hits?: number;
  readonly helpfulnessRatio?: number | null;
  readonly lastModifiedAt?: string;
  readonly updatedAt?: string;
  readonly language?: KbLanguage;
}

function toBrowseRow(row: KbBrowseRowMixed): KbBrowseRow {
  const viewCount = row.viewCount ?? row.hits ?? 0;
  const helpfulCount = row.helpfulCount ?? row.acceptedHits ?? 0;
  const ratio =
    typeof row.helpfulnessRatio === "number"
      ? row.helpfulnessRatio
      : viewCount > 0
        ? helpfulCount / viewCount
        : null;
  return {
    id: row.id,
    title: row.title ?? "",
    categoryId: row.categoryId ?? null,
    categoryName: row.categoryName ?? null,
    viewCount,
    helpfulCount,
    helpfulnessRatio: ratio,
    lastModifiedAt: row.lastModifiedAt ?? row.updatedAt ?? "",
    language: row.language ?? "sk",
  };
}

const PAGE_SIZE = 100;

async function fetchKbBrowse(): Promise<ReadonlyArray<KbBrowseRow>> {
  const resp = await fetch(`/api/kb?size=${PAGE_SIZE}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const payload = await jsonOrThrow<PaginatedShape<KbBrowseRowMixed>>(resp, "kb-browse");
  return rowsOf(payload).map(toBrowseRow);
}

export function kbBrowseQuery(tenantId: TenantId) {
  return {
    queryKey: ["kb-browse", tenantId] as const,
    queryFn: fetchKbBrowse,
    staleTime: 60_000,
  };
}

interface KbCategoryMixed {
  readonly id: string;
  readonly name?: string;
}

interface KbCategoriesResponse {
  readonly categories?: ReadonlyArray<KbCategoryMixed>;
}

async function fetchKbCategories(): Promise<ReadonlyArray<KbCategoryOption>> {
  const resp = await fetch(`/api/kb/categories`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const payload = await jsonOrThrow<KbCategoriesResponse>(resp, "kb-categories");
  return (payload.categories ?? []).map((c) => ({ id: c.id, name: c.name ?? c.id }));
}

export function kbCategoriesQuery(tenantId: TenantId) {
  return {
    queryKey: ["kb-categories", tenantId] as const,
    queryFn: fetchKbCategories,
    staleTime: 5 * 60_000,
  };
}

interface KbArticleDetailMixed {
  readonly id: string;
  readonly title?: string;
  readonly markdown?: string;
  readonly categoryId?: string | null;
  readonly categoryName?: string | null;
  readonly authorId?: string | null;
  readonly lastModifiedAt?: string;
  readonly updatedAt?: string;
  readonly readTimeMin?: number;
  readonly helpfulCount?: number;
  readonly acceptedHits?: number;
  readonly viewCount?: number;
  readonly hits?: number;
  readonly helpfulnessRatio?: number | null;
  readonly language?: KbLanguage;
}

function toArticleDetail(row: KbArticleDetailMixed): KbArticleDetail {
  const viewCount = row.viewCount ?? row.hits ?? 0;
  const helpfulCount = row.helpfulCount ?? row.acceptedHits ?? 0;
  const ratio =
    typeof row.helpfulnessRatio === "number"
      ? row.helpfulnessRatio
      : viewCount > 0
        ? helpfulCount / viewCount
        : null;
  const stats: KbArticleStats = { viewCount, helpfulCount, helpfulnessRatio: ratio };
  return {
    id: row.id,
    title: row.title ?? "",
    markdown: row.markdown ?? "",
    categoryId: row.categoryId ?? null,
    categoryName: row.categoryName ?? null,
    authorId: row.authorId ?? null,
    lastModifiedAt: row.lastModifiedAt ?? row.updatedAt ?? "",
    readTimeMin: row.readTimeMin ?? 1,
    language: row.language ?? "sk",
    stats,
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
    queryKey: ["kb-article", tenantId, id] as const,
    queryFn: () => fetchKbArticle(id),
    staleTime: 5 * 60_000,
  };
}
