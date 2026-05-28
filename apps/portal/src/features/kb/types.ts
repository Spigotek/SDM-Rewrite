import type { TenantId } from "@sdm/domain";

/**
 * Portal-shaped KB types. We rebuild slim DTOs at the network edge in
 * `api.ts` so the UI doesn't depend on the structured `KbArticleBody` /
 * `KbContentBlock` shape — read-only MVP renders a single `markdown`
 * string and shows the article shell + meta. The KB editor (v1+) will
 * own the structured representation.
 */

export type KbLanguage = "sk" | "en";

export interface KbSearchResult {
  readonly id: string;
  readonly title: string;
  readonly snippet: string;
  readonly categoryName: string | null;
  readonly helpfulCount: number;
  readonly readTimeMin: number;
  readonly language: KbLanguage;
}

export interface KbRelatedArticle {
  readonly id: string;
  readonly title: string;
  readonly readTimeMin: number;
}

export interface KbArticleDetail {
  readonly id: string;
  readonly title: string;
  readonly markdown: string;
  readonly categoryName: string | null;
  readonly updatedAt: string;
  readonly readTimeMin: number;
  readonly helpfulCount: number;
  readonly language: KbLanguage;
  readonly related: ReadonlyArray<KbRelatedArticle>;
}

export type HelpfulnessVote = "up" | "down";

export interface HelpfulnessSubmission {
  readonly vote: HelpfulnessVote;
  readonly comment?: string;
}

export interface KbQueryDeps {
  readonly tenantId: TenantId;
}
