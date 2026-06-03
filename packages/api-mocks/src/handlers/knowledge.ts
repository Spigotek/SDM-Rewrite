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
  readonly viewCount: number;
  readonly helpfulnessRatio: number | null;
  readonly lastModifiedAt: string;
  readonly readTimeMin: number;
  readonly language: "sk" | "en";
}

function rowFor(article: KbArticle, q: string | undefined): KbSearchRow {
  const cat = store.kbCategories.find((c) => c.id === article.categoryId);
  // `hits` and `acceptedHits` come from the domain `KbArticle` fixture. The
  // workspace KB browse (H.15) exposes them as view count + helpfulness ratio
  // for the agent persona. Real-backend contract gap tracked in wireframe
  // `[GAP-4]` — the portal H.6 surface ignores them by design.
  const viewCount = article.hits;
  const helpfulCount = article.acceptedHits;
  return {
    id: article.id,
    title: article.title,
    summary: article.summary ?? "",
    snippet: snippetFor(article, q),
    categoryId: article.categoryId,
    categoryName: cat?.name ?? null,
    helpfulCount,
    viewCount,
    helpfulnessRatio: viewCount > 0 ? helpfulCount / viewCount : null,
    lastModifiedAt: article.lastModifiedAt,
    readTimeMin: readTimeMin(article.body.blocks),
    // Domain doesn't yet carry a language attribute; treat every fixture as
    // SK by default so the "EN only" badge stays dormant until the editor
    // lands (v1+). Edge case is documented in the wireframe.
    language: "sk",
  };
}

interface KbArticleDetail extends KbSearchRow {
  readonly markdown: string;
  readonly authorId: string;
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

// =============================================================================
// I.4 — KB authoring (write / publish / draft / analytics) mock state
// =============================================================================

/**
 * Per-tenant in-memory KB write store. Mirrors `apps/bff/src/api/endpoints/
 * kb-write.ts` shape so the FE behaves identically between dev (BFF in the
 * loop) and `vite preview` (MSW standalone).
 */
type KbVisibility = "public" | "tenant" | "sp_only";
type KbDraftStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

interface KbDraftRecord {
  id: string;
  tenantId: string;
  title: string;
  body: string;
  draftBody: string | null;
  categoryId: string | null;
  tags: readonly string[];
  visibility: KbVisibility;
  language: "sk" | "en";
  status: KbDraftStatus;
  publishedAt: string | null;
  publishedBy: string | null;
  authorId: string;
  lastModifiedAt: string;
}

/**
 * Per-tab persistence: `kbDrafts` lives in `localStorage` so the state
 * survives SPA navigations (each `page.goto` re-evaluates the module so
 * an in-memory `Map` would reset after every route change — published
 * drafts must be visible on `/kb` AFTER the editor navigates away).
 * The map is rehydrated on every read + persisted on every write; the
 * cost is negligible since drafts are rare.
 */
const KB_DRAFTS_STORAGE_KEY = "sdm.msw.kbDrafts.v1";
const kbDraftKey = (tenant: string, id: string): string => `${tenant}::${id}`;

function readKbDrafts(): Map<string, KbDraftRecord> {
  if (typeof globalThis.localStorage === "undefined") return new Map();
  try {
    const raw = globalThis.localStorage.getItem(KB_DRAFTS_STORAGE_KEY);
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as Record<string, KbDraftRecord>;
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

function writeKbDrafts(map: Map<string, KbDraftRecord>): void {
  if (typeof globalThis.localStorage === "undefined") return;
  try {
    const obj: Record<string, KbDraftRecord> = {};
    for (const [k, v] of map.entries()) obj[k] = v;
    globalThis.localStorage.setItem(KB_DRAFTS_STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // localStorage may be full / disabled — silently drop.
  }
}

function kbDraftsGet(key: string): KbDraftRecord | undefined {
  return readKbDrafts().get(key);
}

function kbDraftsSet(key: string, value: KbDraftRecord): void {
  const map = readKbDrafts();
  map.set(key, value);
  writeKbDrafts(map);
}

function kbDraftsDelete(key: string): boolean {
  const map = readKbDrafts();
  const ok = map.delete(key);
  if (ok) writeKbDrafts(map);
  return ok;
}

function kbDraftsValues(): IterableIterator<KbDraftRecord> {
  return readKbDrafts().values();
}

function nextKbId(): string {
  return `kb:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

const ALLOWED_VISIBILITY: ReadonlySet<KbVisibility> = new Set(["public", "tenant", "sp_only"]);
function asVisibility(value: unknown, fallback: KbVisibility): KbVisibility {
  return typeof value === "string" && ALLOWED_VISIBILITY.has(value as KbVisibility)
    ? (value as KbVisibility)
    : fallback;
}
function asTags(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

/**
 * MSW-side sanitization mirror of `apps/workspace/.../lib/sanitizer.ts`. The
 * full DOMPurify dependency lives in the workspace + BFF; here we just strip
 * the highest-impact attack surfaces so the journey-13 XSS assertion still
 * holds when MSW is the only backend in the loop.
 */
function sanitizeMock(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/\]\((\s*javascript:[^)]*)\)/gi, "](#)");
}

function fixtureAnalytics(range: "7d" | "30d" | "90d") {
  const m = range === "7d" ? 1 : range === "30d" ? 4 : 12;
  return {
    range,
    top: [
      { id: "kb:50000", title: "Reset VPN klienta", views: 1247 * m },
      { id: "kb:50001", title: "Pripojenie na firemnú VPN", views: 893 * m },
      { id: "kb:50002", title: "Outlook offline mode", views: 712 * m },
      { id: "kb:50003", title: "MFA setup", views: 654 * m },
      { id: "kb:50004", title: "Password reset", views: 521 * m },
      { id: "kb:50005", title: "Wifi enterprise login", views: 410 * m },
      { id: "kb:50006", title: "Printer setup", views: 387 * m },
      { id: "kb:50007", title: "Známe problémy VPN klienta v5", views: 290 * m },
      { id: "kb:50008", title: "Office 365 reinstall", views: 245 * m },
      { id: "kb:50009", title: "Disk space cleanup", views: 198 * m },
    ],
    bottom: [
      { id: "kb:50020", title: "Legacy IE6 fallback", helpfulnessRatio: 0.12, views: 84 * m },
      { id: "kb:50021", title: "On-prem CRM migration", helpfulnessRatio: 0.21, views: 67 * m },
      { id: "kb:50022", title: "DOS prompt cheatsheet", helpfulnessRatio: 0.18, views: 55 * m },
      { id: "kb:50023", title: "Floppy disk recovery", helpfulnessRatio: 0.09, views: 42 * m },
      { id: "kb:50024", title: "Token ring config", helpfulnessRatio: null, views: 3 * m },
    ],
    searchMiss: [
      { query: "vpn nefunguje", hits: 42 * m },
      { query: "teams crash", hits: 31 * m },
      { query: "macbook pro vpn", hits: 28 * m },
      { query: "outlook ssl error", hits: 19 * m },
      { query: "sso slow", hits: 14 * m },
    ],
  };
}

function toEditorShape(rec: KbDraftRecord) {
  return {
    id: rec.id,
    title: rec.title,
    body: rec.body,
    draftBody: rec.draftBody,
    categoryId: rec.categoryId,
    tags: rec.tags,
    visibility: rec.visibility,
    language: rec.language,
    status: rec.status,
    publishedAt: rec.publishedAt,
    publishedBy: rec.publishedBy,
    authorId: rec.authorId,
    lastModifiedAt: rec.lastModifiedAt,
  };
}

export const knowledgeHandlers = [
  // ── I.4 KB authoring handlers ───────────────────────────────────────────
  // Registered FIRST so the specific `/api/kb/articles/...` and
  // `/api/kb/analytics` matchers win over the read-side `/api/kb/:id`
  // fallback below. MSW evaluates handlers in registration order.

  http.get("*/api/kb/analytics", ({ request }) => {
    const url = new URL(request.url);
    const raw = url.searchParams.get("range") ?? "30d";
    const range: "7d" | "30d" | "90d" = raw === "7d" || raw === "90d" ? raw : "30d";
    return HttpResponse.json(fixtureAnalytics(range));
  }),

  http.post("*/api/kb/articles", async ({ request }) => {
    const tenant = parseTenantFromRequest(request);
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return badRequest("malformed JSON body", correlationIdFrom(request));
    }
    const title = typeof body["title"] === "string" ? body["title"].trim() : "";
    if (title.length === 0) {
      return badRequest("title is required", correlationIdFrom(request));
    }
    const rawBody = typeof body["body"] === "string" ? sanitizeMock(body["body"]) : "";
    const record: KbDraftRecord = {
      id: nextKbId(),
      tenantId: tenant,
      title: sanitizeMock(title),
      body: rawBody,
      draftBody: rawBody,
      categoryId: typeof body["categoryId"] === "string" ? body["categoryId"] : null,
      tags: asTags(body["tags"]),
      visibility: asVisibility(body["visibility"], "tenant"),
      language: body["language"] === "en" ? "en" : "sk",
      status: "DRAFT",
      publishedAt: null,
      publishedBy: null,
      authorId: "mock-user",
      lastModifiedAt: new Date().toISOString(),
    };
    kbDraftsSet(kbDraftKey(tenant, record.id), record);
    return HttpResponse.json(toEditorShape(record), { status: 201 });
  }),

  http.get("*/api/kb/articles/:id/editor", ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const id = String(params["id"] ?? "");
    const rec = kbDraftsGet(kbDraftKey(tenant, id));
    if (!rec) return notFound("kb article", id, correlationIdFrom(request));
    return HttpResponse.json(toEditorShape(rec));
  }),

  http.patch("*/api/kb/articles/:id/draft", async ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const id = String(params["id"] ?? "");
    const rec = kbDraftsGet(kbDraftKey(tenant, id));
    if (!rec) return notFound("kb article", id, correlationIdFrom(request));
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return badRequest("malformed JSON body", correlationIdFrom(request));
    }
    const draft = sanitizeMock(typeof body["draftBody"] === "string" ? body["draftBody"] : "");
    rec.draftBody = draft;
    rec.lastModifiedAt = new Date().toISOString();
    kbDraftsSet(kbDraftKey(tenant, id), rec);
    return HttpResponse.json({ savedAt: rec.lastModifiedAt });
  }),

  http.post("*/api/kb/articles/:id/publish", async ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const id = String(params["id"] ?? "");
    const rec = kbDraftsGet(kbDraftKey(tenant, id));
    if (!rec) return notFound("kb article", id, correlationIdFrom(request));
    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      // empty body is ok
    }
    rec.visibility = asVisibility(body["visibility"], rec.visibility);
    if (Array.isArray(body["tags"])) rec.tags = asTags(body["tags"]);
    rec.status = "PUBLISHED";
    rec.body = rec.draftBody ?? rec.body;
    rec.publishedAt = new Date().toISOString();
    rec.publishedBy = "mock-user";
    rec.lastModifiedAt = rec.publishedAt;
    kbDraftsSet(kbDraftKey(tenant, id), rec);
    return HttpResponse.json(toEditorShape(rec));
  }),

  http.patch("*/api/kb/articles/:id", async ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const id = String(params["id"] ?? "");
    const rec = kbDraftsGet(kbDraftKey(tenant, id));
    if (!rec) return notFound("kb article", id, correlationIdFrom(request));
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return badRequest("malformed JSON body", correlationIdFrom(request));
    }
    if (typeof body["title"] === "string") rec.title = sanitizeMock(body["title"]);
    if (typeof body["body"] === "string") rec.body = sanitizeMock(body["body"]);
    if (typeof body["categoryId"] === "string" || body["categoryId"] === null) {
      rec.categoryId = typeof body["categoryId"] === "string" ? body["categoryId"] : null;
    }
    if (Array.isArray(body["tags"])) rec.tags = asTags(body["tags"]);
    if (typeof body["visibility"] === "string")
      rec.visibility = asVisibility(body["visibility"], rec.visibility);
    rec.lastModifiedAt = new Date().toISOString();
    kbDraftsSet(kbDraftKey(tenant, id), rec);
    return HttpResponse.json(toEditorShape(rec));
  }),

  http.delete("*/api/kb/articles/:id", ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const id = String(params["id"] ?? "");
    const ok = kbDraftsDelete(kbDraftKey(tenant, id));
    if (!ok) return notFound("kb article", id, correlationIdFrom(request));
    return HttpResponse.json({ id });
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

  // ── Read-side handlers (H.6 / H.15) ────────────────────────────────────

  http.get("*/api/kb/categories", ({ request }) => {
    const tenant = parseTenantFromRequest(request);
    const categories = store.kbCategories.filter((c) => c.tenantId === tenant);
    return HttpResponse.json({ categories });
  }),

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
    // Surface I.4 newly-published drafts alongside the fixture set so the
    // journey-13 author flow can assert their KB row appears in `/kb` after
    // publish. Drafts use the editor-shape; we project them into the
    // read-side `KbSearchRow` so the TanStack Table renders consistently.
    const publishedDrafts: KbSearchRow[] = [];
    for (const r of kbDraftsValues()) {
      if (r.tenantId !== tenant || r.status !== "PUBLISHED") continue;
      publishedDrafts.push({
        id: r.id,
        title: r.title,
        summary: "",
        snippet: "",
        categoryId: r.categoryId ?? "",
        categoryName: null,
        helpfulCount: 0,
        viewCount: 0,
        helpfulnessRatio: null,
        lastModifiedAt: r.lastModifiedAt,
        readTimeMin: 1,
        language: r.language,
      });
    }
    const params = readPageParams(url);
    const page = paginate(filtered, params);
    return HttpResponse.json({
      ...page,
      totalCount: page.totalCount + publishedDrafts.length,
      results: [...publishedDrafts, ...page.results.map((a) => rowFor(a, q))],
    });
  }),

  http.get("*/api/kb/:id", ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const id = String(params["id"] ?? "");
    // First try the I.4 draft store (newly-published articles).
    const draft = kbDraftsGet(kbDraftKey(tenant, id));
    if (draft && draft.status === "PUBLISHED") {
      return HttpResponse.json({
        id: draft.id,
        title: draft.title,
        summary: "",
        snippet: "",
        categoryId: draft.categoryId ?? "",
        categoryName: null,
        helpfulCount: 0,
        viewCount: 0,
        helpfulnessRatio: null,
        lastModifiedAt: draft.lastModifiedAt,
        readTimeMin: 1,
        language: draft.language,
        markdown: draft.body,
        authorId: draft.authorId,
        updatedAt: draft.lastModifiedAt,
        related: [],
      });
    }
    const found = tenantArticles(tenant).find((a) => a.id === id);
    if (!found) return notFound("kb article", id, correlationIdFrom(request));
    const detail: KbArticleDetail = {
      ...rowFor(found, undefined),
      markdown: blocksToMarkdown(found.body.blocks),
      authorId: found.authorId,
      updatedAt: found.lastModifiedAt,
      related: relatedFor(found, tenant),
    };
    return HttpResponse.json(detail);
  }),
];
