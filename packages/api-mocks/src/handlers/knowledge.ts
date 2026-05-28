import { http, HttpResponse } from "msw";
import { store } from "../db";
import type { KbArticle, KbContentBlock } from "@sdm/domain";
import { paginate, readPageParams } from "../utils/pagination";
import { parseTenantFromRequest } from "../utils/tenant";
import { correlationIdFrom } from "../utils/correlation";
import { badRequest, notFound } from "../utils/errors";

function tenantArticles(tenant: string): KbArticle[] {
  return store.kbArticles.filter((a) => a.tenantId === tenant);
}

/**
 * Convert the domain `KbContentBlock[]` body into GFM markdown for the read
 * surface. The portal Markdown component (`react-markdown` + `remark-gfm` +
 * `rehype-sanitize`) is the only place markdown is rendered — every
 * structured block has a markdown equivalent that survives the sanitizer
 * allowlist documented in `owasp-mitigations.md §Markdown sanitizer
 * whitelist`. Keeps the FE blissfully unaware of the underlying block model
 * (KB editor is v1+; this is read-only MVP).
 */
function blocksToMarkdown(blocks: readonly KbContentBlock[]): string {
  const out: string[] = [];
  for (const block of blocks) {
    switch (block.kind) {
      case "heading":
        out.push(`${"#".repeat(block.level)} ${block.text}`);
        break;
      case "paragraph":
        out.push(block.text);
        break;
      case "code":
        out.push("```" + block.language + "\n" + block.code + "\n```");
        break;
      case "list": {
        const marker = block.ordered ? (i: number) => `${i + 1}.` : () => "-";
        out.push(block.items.map((item, i) => `${marker(i)} ${item}`).join("\n"));
        break;
      }
      case "image":
        out.push(`![${block.alt}](/api/attachments/${block.attachmentId})`);
        break;
      case "callout":
        out.push(`> [!${block.severity}] ${block.text}`);
        break;
    }
  }
  return out.join("\n\n");
}

function snippetFor(article: KbArticle, q: string | undefined): string {
  const text = (article.summary ?? "").trim();
  if (!q || text.length === 0) {
    return text.length > 160 ? `${text.slice(0, 159).trimEnd()}…` : text;
  }
  const lower = text.toLowerCase();
  const at = lower.indexOf(q.toLowerCase());
  if (at < 0) return text.length > 160 ? `${text.slice(0, 159).trimEnd()}…` : text;
  const start = Math.max(0, at - 40);
  const end = Math.min(text.length, at + q.length + 80);
  const slice = text.slice(start, end);
  return `${start > 0 ? "…" : ""}${slice}${end < text.length ? "…" : ""}`;
}

function readTimeMin(blocks: readonly KbContentBlock[]): number {
  const words = blocks.reduce((acc, b) => {
    if (b.kind === "paragraph") return acc + b.text.split(/\s+/).filter(Boolean).length;
    if (b.kind === "heading") return acc + b.text.split(/\s+/).filter(Boolean).length;
    if (b.kind === "list") return acc + b.items.reduce((s, it) => s + it.split(/\s+/).length, 0);
    return acc;
  }, 0);
  return Math.max(1, Math.round(words / 220));
}

interface KbSearchRow {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly snippet: string;
  readonly categoryId: string;
  readonly categoryName: string | null;
  readonly helpfulCount: number;
  readonly readTimeMin: number;
  readonly language: "sk" | "en";
}

function rowFor(article: KbArticle, q: string | undefined): KbSearchRow {
  const cat = store.kbCategories.find((c) => c.id === article.categoryId);
  return {
    id: article.id,
    title: article.title,
    summary: article.summary ?? "",
    snippet: snippetFor(article, q),
    categoryId: article.categoryId,
    categoryName: cat?.name ?? null,
    // No CA SDM attribute for helpfulness; derive a stable count from
    // `acceptedHits` so the UI has something to show. Real-backend
    // contract gap tracked in wireframe `[GAP-4]`.
    helpfulCount: article.acceptedHits,
    readTimeMin: readTimeMin(article.body.blocks),
    // Domain doesn't yet carry a language attribute; treat every fixture as
    // SK by default so the "EN only" badge stays dormant until the editor
    // lands (v1+). Edge case is documented in the wireframe.
    language: "sk",
  };
}

interface KbArticleDetail extends KbSearchRow {
  readonly markdown: string;
  readonly updatedAt: string;
  readonly related: ReadonlyArray<{
    readonly id: string;
    readonly title: string;
    readonly readTimeMin: number;
  }>;
}

function relatedFor(article: KbArticle, tenant: string): KbArticleDetail["related"] {
  // Same category, exclude self, deterministic sort by hits desc — capped at 4.
  return store.kbArticles
    .filter(
      (a) => a.tenantId === tenant && a.categoryId === article.categoryId && a.id !== article.id,
    )
    .slice()
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 4)
    .map((a) => ({ id: a.id, title: a.title, readTimeMin: readTimeMin(a.body.blocks) }));
}

interface HelpfulnessPayload {
  readonly vote: "up" | "down";
  readonly comment?: string;
}

const helpfulnessLedger = new Map<string, { up: number; down: number }>();

export const knowledgeHandlers = [
  http.get("*/api/kb", ({ request }) => {
    const tenant = parseTenantFromRequest(request);
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.toLowerCase().trim();
    const all = tenantArticles(tenant);
    const filtered = q
      ? all.filter(
          (a) => a.title.toLowerCase().includes(q) || (a.summary ?? "").toLowerCase().includes(q),
        )
      : all;
    const params = readPageParams(url);
    const page = paginate(filtered, params);
    return HttpResponse.json({
      ...page,
      results: page.results.map((a) => rowFor(a, q)),
    });
  }),

  http.get("*/api/kb/categories", ({ request }) => {
    const tenant = parseTenantFromRequest(request);
    const categories = store.kbCategories.filter((c) => c.tenantId === tenant);
    return HttpResponse.json({ categories });
  }),

  http.get("*/api/kb/:id", ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const id = String(params["id"] ?? "");
    const found = tenantArticles(tenant).find((a) => a.id === id);
    if (!found) return notFound("kb article", id, correlationIdFrom(request));
    const detail: KbArticleDetail = {
      ...rowFor(found, undefined),
      markdown: blocksToMarkdown(found.body.blocks),
      updatedAt: found.lastModifiedAt,
      related: relatedFor(found, tenant),
    };
    return HttpResponse.json(detail);
  }),

  /**
   * Helpfulness signal — mock-only (CA SDM doesn't expose a KB feedback
   * endpoint; tracked as `[GAP-4]` in `wireframes/portal/05-kb-search.md`).
   * Validates payload shape and accumulates an in-memory ledger so the
   * browser test can assert the vote was recorded.
   */
  http.post("*/api/kb/articles/:id/helpfulness", async ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const id = String(params["id"] ?? "");
    const found = tenantArticles(tenant).find((a) => a.id === id);
    if (!found) return notFound("kb article", id, correlationIdFrom(request));
    let body: HelpfulnessPayload;
    try {
      body = (await request.json()) as HelpfulnessPayload;
    } catch {
      return badRequest("malformed JSON body", correlationIdFrom(request));
    }
    if (body.vote !== "up" && body.vote !== "down") {
      return badRequest("vote must be 'up' or 'down'", correlationIdFrom(request));
    }
    const tally = helpfulnessLedger.get(id) ?? { up: 0, down: 0 };
    tally[body.vote] += 1;
    helpfulnessLedger.set(id, tally);
    return HttpResponse.json({ ok: true, tally });
  }),
];
