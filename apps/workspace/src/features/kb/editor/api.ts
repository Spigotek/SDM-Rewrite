import type { TenantId } from "@sdm/domain";
import type { KbAnalyticsSnapshot, KbEditorArticle, KbEditorDraft } from "./types";

/**
 * KB editor data plumbing — write surface (I.4).
 *
 * Endpoints (mirrored by MSW + BFF `kb-write.ts`):
 *   POST    /api/kb/articles                          → create draft
 *   GET     /api/kb/articles/:id/editor               → load for editor
 *   PATCH   /api/kb/articles/:id                      → update fields
 *   PATCH   /api/kb/articles/:id/draft                → debounced auto-save
 *   POST    /api/kb/articles/:id/publish              → set published state
 *   DELETE  /api/kb/articles/:id                      → soft delete
 *   GET     /api/kb/analytics?range=7d|30d|90d        → dashboard fixtures
 *
 * Every mutation includes CSRF + cookie credentials (handled by the BFF
 * defaults). The body is sanitized client-side BEFORE POST (defense
 * in-depth; the BFF re-sanitizes server-side regardless).
 */

async function jsonOrThrow<T>(resp: Response, op: string): Promise<T> {
  if (!resp.ok) {
    const error = new Error(`[${op}] HTTP ${resp.status}`) as Error & { status?: number };
    error.status = resp.status;
    throw error;
  }
  return (await resp.json()) as T;
}

async function fetchArticleForEditor(id: string): Promise<KbEditorArticle> {
  const resp = await fetch(`/api/kb/articles/${encodeURIComponent(id)}/editor`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  return jsonOrThrow<KbEditorArticle>(resp, "kb-editor-load");
}

export function kbEditorArticleQuery(tenantId: TenantId, id: string) {
  return {
    queryKey: ["kb-editor-article", tenantId, id] as const,
    queryFn: () => fetchArticleForEditor(id),
    staleTime: 30_000,
  };
}

export async function createArticle(input: KbEditorDraft): Promise<KbEditorArticle> {
  const resp = await fetch(`/api/kb/articles`, {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return jsonOrThrow<KbEditorArticle>(resp, "kb-editor-create");
}

export async function updateArticle(
  id: string,
  input: Partial<KbEditorDraft>,
): Promise<KbEditorArticle> {
  const resp = await fetch(`/api/kb/articles/${encodeURIComponent(id)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return jsonOrThrow<KbEditorArticle>(resp, "kb-editor-update");
}

export async function saveDraft(id: string, body: string): Promise<{ savedAt: string }> {
  const resp = await fetch(`/api/kb/articles/${encodeURIComponent(id)}/draft`, {
    method: "PATCH",
    credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ draftBody: body }),
  });
  return jsonOrThrow<{ savedAt: string }>(resp, "kb-editor-draft");
}

export interface PublishInput {
  readonly visibility: "public" | "tenant" | "sp_only";
  readonly tags: readonly string[];
}

export async function publishArticle(id: string, input: PublishInput): Promise<KbEditorArticle> {
  const resp = await fetch(`/api/kb/articles/${encodeURIComponent(id)}/publish`, {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return jsonOrThrow<KbEditorArticle>(resp, "kb-editor-publish");
}

export async function deleteArticle(id: string): Promise<{ id: string }> {
  const resp = await fetch(`/api/kb/articles/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  return jsonOrThrow<{ id: string }>(resp, "kb-editor-delete");
}

export function kbAnalyticsQuery(tenantId: TenantId, range: "7d" | "30d" | "90d") {
  return {
    queryKey: ["kb-analytics", tenantId, range] as const,
    queryFn: async (): Promise<KbAnalyticsSnapshot> => {
      const resp = await fetch(`/api/kb/analytics?range=${range}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      return jsonOrThrow<KbAnalyticsSnapshot>(resp, "kb-analytics");
    },
    staleTime: 5 * 60_000,
  };
}
