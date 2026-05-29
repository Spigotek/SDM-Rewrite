/**
 * Workspace-shaped KB types — read-only MVP for the Jana flow (kb_editor).
 *
 * Mirror of `apps/portal/src/features/kb/types.ts` (H.6) but the workspace
 * surface is agent-facing: the browse list is a DataTable (denser metadata)
 * and the article view exposes `viewCount` + `helpfulnessRatio` for the agent
 * to read while triaging an incident.
 *
 * Editor is v1+; this file deliberately does not model `KbContentBlock`.
 */

export type KbLanguage = "sk" | "en";

export interface KbBrowseRow {
  readonly id: string;
  readonly title: string;
  readonly categoryId: string | null;
  readonly categoryName: string | null;
  readonly viewCount: number;
  readonly helpfulCount: number;
  /** acceptedHits / max(hits, 1) — `null` if `hits == 0`. */
  readonly helpfulnessRatio: number | null;
  readonly lastModifiedAt: string;
  readonly language: KbLanguage;
}

export interface KbCategoryOption {
  readonly id: string;
  readonly name: string;
}

export interface KbArticleStats {
  readonly viewCount: number;
  readonly helpfulCount: number;
  readonly helpfulnessRatio: number | null;
}

export interface KbArticleDetail {
  readonly id: string;
  readonly title: string;
  readonly markdown: string;
  readonly categoryId: string | null;
  readonly categoryName: string | null;
  readonly authorId: string | null;
  readonly lastModifiedAt: string;
  readonly readTimeMin: number;
  readonly language: KbLanguage;
  readonly stats: KbArticleStats;
}

export interface KbFilters {
  readonly category: string | null;
  readonly language: KbLanguage | null;
}
