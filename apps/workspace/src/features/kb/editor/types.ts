/**
 * Workspace KB editor types — write surface (I.4). Mirror of the read
 * surface in `../types.ts` (H.15) plus the editor-specific fields:
 * `visibility`, `tags`, `draftBody`, `publishedAt`, `publishedBy`.
 *
 * Visibility scope (per `wireframes/workspace/04-kb-editor.md §Visibility`):
 *   - `public`   — anonymous portal read (post-MVP, rendered but gated).
 *   - `tenant`   — default; rendered in portal + workspace for tenant users.
 *   - `sp_only`  — service-provider admins only (cross-tenant visibility).
 */

export type KbVisibility = "public" | "tenant" | "sp_only";

export type KbLanguage = "sk" | "en";

export interface KbEditorDraft {
  readonly title: string;
  /** Canonical GFM markdown body. */
  readonly body: string;
  readonly categoryId: string | null;
  readonly tags: readonly string[];
  readonly visibility: KbVisibility;
  readonly language: KbLanguage;
}

export interface KbEditorArticle extends KbEditorDraft {
  readonly id: string;
  readonly draftBody: string | null;
  readonly publishedAt: string | null;
  readonly publishedBy: string | null;
  readonly lastModifiedAt: string;
  readonly authorId: string | null;
  readonly status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
}

export interface KbAnalyticsTopRow {
  readonly id: string;
  readonly title: string;
  readonly views: number;
}

export interface KbAnalyticsLowRow {
  readonly id: string;
  readonly title: string;
  readonly helpfulnessRatio: number | null;
  readonly views: number;
}

export interface KbAnalyticsSearchMissRow {
  readonly query: string;
  readonly hits: number;
}

export interface KbAnalyticsSnapshot {
  readonly range: "7d" | "30d" | "90d";
  readonly top: readonly KbAnalyticsTopRow[];
  readonly bottom: readonly KbAnalyticsLowRow[];
  readonly searchMiss: readonly KbAnalyticsSearchMissRow[];
}
