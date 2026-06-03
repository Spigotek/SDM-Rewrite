import type { Hono } from "hono";
import sanitizeHtmlLib from "sanitize-html";
import { hasPermission, type Permission, type UIRole } from "@sdm/domain";
import { AppErrorException } from "../../auth/errors";
import { AUDIT_EVENTS } from "../../platform/audit";
import { requireActiveSession } from "../../session/load";
import type { SessionPayload } from "../../session/types";
import type { RestProxyDeps } from "../rest-proxy";

/**
 * I.4 — KB authoring mutation endpoints. Sit alongside the F.2 `kb.ts`
 * read-side proxy (factory `KD`). Every endpoint:
 *
 *   - requires an active session (cookie + idle expiry checks),
 *   - re-validates the `kb.write` permission server-side (defense in depth;
 *     the FE `<RouteGuard>` is a UX optimisation only),
 *   - sanitizes the body with `sanitize-html` (Node-side pure-JS sanitizer
 *     using the same allowlist the FE uses via `isomorphic-dompurify`, per
 *     `owasp-mitigations.md §A03`). We deliberately avoid `isomorphic-
 *     dompurify` on the server: it pulls `jsdom@28` which transitively
 *     requires the ESM-only `@exodus/bytes` and breaks CJS test loaders
 *     under Node 22.11. `sanitize-html` is pure JS (htmlparser2) — no jsdom,
 *     no dual-package hazard, identical effective allowlist.
 *   - emits `data.kd.write` (factory name lowercased per the F.4 convention
 *     used by `_entity-routes.ts`) with `details.op` discriminating
 *     create / update / publish / draft / delete (audit taxonomy frozen
 *     per `I.md §D6`).
 *
 * Persistence today is **in-memory** (BFF doesn't own a database). The real
 * CA SDM factory `KD` is read-only via the entity proxy; KB write API is a
 * gap tracked in `wireframes/.../04-kb-editor.md` `[GAP-4]`. The in-memory
 * store gives MSW-equivalent semantics so the journey-13/14/15 tests pass
 * against both `pnpm dev` (workspace + BFF) and `vite preview` (MSW
 * standalone). When the real backend lands, swap the `store` calls for
 * CA SDM REST proxy calls — the audit + sanitize + permission gates stay.
 */

const ALLOWED_TAGS = [
  "p",
  "br",
  "h1",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "u",
  "s",
  "code",
  "pre",
  "blockquote",
  "a",
  "img",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
  "hr",
  "span",
];
const ALLOWED_ATTR = ["href", "src", "alt", "title", "target", "rel", "class"];

/**
 * Server-side sanitization — same effective allowlist as
 * `apps/workspace/.../lib/sanitizer.ts`. Implementation differs (sanitize-html
 * vs DOMPurify) but the contract is identical:
 *   - only the allowlisted tags survive,
 *   - the listed attributes survive (on any tag),
 *   - inline event handlers (`on*`) and `style` are stripped,
 *   - `<script>` / `<style>` / etc. are removed along with their text content,
 *   - URLs in `href` / `src` are restricted to http(s) / mailto / relative
 *     paths / anchors — `javascript:` is dropped,
 *   - markdown-style `[text](javascript:…)` links are rewritten to `](#)`.
 */
function sanitize(input: string): string {
  const cleaned = sanitizeHtmlLib(input, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { "*": ALLOWED_ATTR },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: {},
    allowedSchemesAppliedToAttributes: ["href", "src", "cite"],
    allowProtocolRelative: false,
    // `<script>`, `<style>`, `<iframe>` etc. are not in allowedTags, so they
    // are stripped by default. Listing them in `nonTextTags` tells the parser
    // to discard their text content as well (matching the DOMPurify forbid
    // behaviour for these tags specifically — `<script>alert(1)</script>`
    // leaves nothing behind, not the literal string `alert(1)`).
    nonTextTags: [
      "script",
      "style",
      "iframe",
      "object",
      "embed",
      "form",
      "input",
      "textarea",
      "noscript",
    ],
  });
  // Belt-and-suspenders for markdown link syntax: `[text](javascript:…)` —
  // sanitize-html doesn't process markdown source, only HTML, so this regex
  // catches the markdown form before storage.
  return cleaned.replace(/\]\((\s*javascript:[^)]*)\)/gi, "](#)");
}

export type KbVisibility = "public" | "tenant" | "sp_only";

export interface KbWriteRecord {
  id: string;
  tenantId: string;
  title: string;
  body: string;
  draftBody: string | null;
  categoryId: string | null;
  tags: readonly string[];
  visibility: KbVisibility;
  language: "sk" | "en";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  publishedAt: string | null;
  publishedBy: string | null;
  authorId: string;
  lastModifiedAt: string;
}

/**
 * Per-tenant in-memory store. Reset on process restart. The MSW handler
 * mirrors this shape so the FE behaves identically in both runtimes.
 */
export interface KbWriteStore {
  list(tenantId: string): KbWriteRecord[];
  get(tenantId: string, id: string): KbWriteRecord | null;
  insert(record: KbWriteRecord): KbWriteRecord;
  update(tenantId: string, id: string, patch: Partial<KbWriteRecord>): KbWriteRecord | null;
  delete(tenantId: string, id: string): boolean;
}

function createInMemoryStore(): KbWriteStore {
  const records = new Map<string, KbWriteRecord>();
  const keyFor = (tenant: string, id: string) => `${tenant}::${id}`;
  return {
    list(tenant) {
      const out: KbWriteRecord[] = [];
      for (const r of records.values()) if (r.tenantId === tenant) out.push(r);
      return out;
    },
    get(tenant, id) {
      return records.get(keyFor(tenant, id)) ?? null;
    },
    insert(record) {
      records.set(keyFor(record.tenantId, record.id), record);
      return record;
    },
    update(tenant, id, patch) {
      const existing = records.get(keyFor(tenant, id));
      if (!existing) return null;
      const next = { ...existing, ...patch, lastModifiedAt: new Date().toISOString() };
      records.set(keyFor(tenant, id), next);
      return next;
    },
    delete(tenant, id) {
      return records.delete(keyFor(tenant, id));
    },
  };
}

function rolesOf(session: SessionPayload): readonly UIRole[] {
  const active = session.tenants.find((t) => t.id === session.activeTenantId);
  return active ? active.roles.map((r) => r.uiRole) : [];
}

function requirePermission(session: SessionPayload, permission: Permission): void {
  if (!hasPermission(rolesOf(session), permission)) {
    throw new AppErrorException({
      code: "AUTH_FORBIDDEN",
      httpStatus: 403,
      message: `permission ${permission} required`,
    });
  }
}

interface CreateBody {
  title?: unknown;
  body?: unknown;
  categoryId?: unknown;
  tags?: unknown;
  visibility?: unknown;
  language?: unknown;
}

type UpdateBody = CreateBody;

interface DraftBody {
  draftBody?: unknown;
}

interface PublishBody {
  visibility?: unknown;
  tags?: unknown;
}

function readString(value: unknown, field: string, op: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AppErrorException({
      code: "VALIDATION",
      httpStatus: 400,
      message: `${op}: ${field} is required`,
    });
  }
  return value.trim();
}

function readOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readTags(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

const ALLOWED_VISIBILITY: ReadonlySet<KbVisibility> = new Set(["public", "tenant", "sp_only"]);

function readVisibility(value: unknown, fallback: KbVisibility): KbVisibility {
  if (typeof value === "string" && ALLOWED_VISIBILITY.has(value as KbVisibility)) {
    return value as KbVisibility;
  }
  return fallback;
}

function readLanguage(value: unknown): "sk" | "en" {
  return value === "en" ? "en" : "sk";
}

function nextId(): string {
  return `kb:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

function toEditorShape(rec: KbWriteRecord): Record<string, unknown> {
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

const KB_FACTORY = "kd";

export interface KbWriteDeps extends RestProxyDeps {
  /** Optional injection for tests — defaults to the module-level singleton. */
  readonly store?: KbWriteStore;
}

const defaultStore = createInMemoryStore();

export function registerKbWriteRoutes(app: Hono, deps: KbWriteDeps): void {
  const store = deps.store ?? defaultStore;

  app.post("/api/kb/articles", async (c) => {
    const session = await requireActiveSession(c, deps);
    requirePermission(session, "kb.write");
    const body = (await c.req.json().catch(() => ({}))) as CreateBody;
    const title = readString(body.title, "title", "POST /api/kb/articles");
    const md = sanitize(typeof body.body === "string" ? body.body : "");
    const record: KbWriteRecord = {
      id: nextId(),
      tenantId: String(session.activeTenantId),
      title: sanitize(title),
      body: md,
      draftBody: md,
      categoryId: readOptionalString(body.categoryId),
      tags: readTags(body.tags),
      visibility: readVisibility(body.visibility, "tenant"),
      language: readLanguage(body.language),
      status: "DRAFT",
      publishedAt: null,
      publishedBy: null,
      authorId: String(session.userId),
      lastModifiedAt: new Date().toISOString(),
    };
    store.insert(record);
    deps.audit?.(
      c,
      {
        category: "data",
        event: AUDIT_EVENTS.data.write(KB_FACTORY),
        result: "success",
        resultCode: 201,
        details: { op: "kb.create", recordId: record.id },
      },
      session,
    );
    return c.json(toEditorShape(record), 201);
  });

  app.get("/api/kb/articles/:id/editor", async (c) => {
    const id = c.req.param("id");
    const session = await requireActiveSession(c, deps);
    requirePermission(session, "kb.write");
    const record = store.get(String(session.activeTenantId), id);
    if (!record) {
      throw new AppErrorException({
        code: "NOT_FOUND",
        httpStatus: 404,
        message: `kb article ${id} not found`,
      });
    }
    return c.json(toEditorShape(record));
  });

  app.patch("/api/kb/articles/:id", async (c) => {
    const id = c.req.param("id");
    const session = await requireActiveSession(c, deps);
    requirePermission(session, "kb.write");
    const body = (await c.req.json().catch(() => ({}))) as UpdateBody;
    const existing = store.get(String(session.activeTenantId), id);
    if (!existing) {
      throw new AppErrorException({
        code: "NOT_FOUND",
        httpStatus: 404,
        message: `kb article ${id} not found`,
      });
    }
    const patch: Partial<KbWriteRecord> = {};
    if (typeof body.title === "string") patch.title = sanitize(body.title);
    if (typeof body.body === "string") patch.body = sanitize(body.body);
    if (typeof body.categoryId === "string" || body.categoryId === null)
      patch.categoryId = readOptionalString(body.categoryId);
    if (Array.isArray(body.tags)) patch.tags = readTags(body.tags);
    if (typeof body.visibility === "string")
      patch.visibility = readVisibility(body.visibility, existing.visibility);
    const next = store.update(String(session.activeTenantId), id, patch);
    deps.audit?.(
      c,
      {
        category: "data",
        event: AUDIT_EVENTS.data.write(KB_FACTORY),
        result: "success",
        resultCode: 200,
        details: { op: "kb.update", recordId: id },
      },
      session,
    );
    return c.json(toEditorShape(next!));
  });

  app.patch("/api/kb/articles/:id/draft", async (c) => {
    const id = c.req.param("id");
    const session = await requireActiveSession(c, deps);
    requirePermission(session, "kb.write");
    const body = (await c.req.json().catch(() => ({}))) as DraftBody;
    const draft = sanitize(typeof body.draftBody === "string" ? body.draftBody : "");
    const next = store.update(String(session.activeTenantId), id, { draftBody: draft });
    if (!next) {
      throw new AppErrorException({
        code: "NOT_FOUND",
        httpStatus: 404,
        message: `kb article ${id} not found`,
      });
    }
    const savedAt = next.lastModifiedAt;
    deps.audit?.(
      c,
      {
        category: "data",
        event: AUDIT_EVENTS.data.write(KB_FACTORY),
        result: "success",
        resultCode: 200,
        details: { op: "kb.draft", recordId: id },
      },
      session,
    );
    return c.json({ savedAt });
  });

  app.post("/api/kb/articles/:id/publish", async (c) => {
    const id = c.req.param("id");
    const session = await requireActiveSession(c, deps);
    requirePermission(session, "kb.write");
    const existing = store.get(String(session.activeTenantId), id);
    if (!existing) {
      throw new AppErrorException({
        code: "NOT_FOUND",
        httpStatus: 404,
        message: `kb article ${id} not found`,
      });
    }
    const body = (await c.req.json().catch(() => ({}))) as PublishBody;
    const visibility = readVisibility(body.visibility, existing.visibility);
    const tags = Array.isArray(body.tags) ? readTags(body.tags) : existing.tags;
    const next = store.update(String(session.activeTenantId), id, {
      status: "PUBLISHED",
      visibility,
      tags,
      body: existing.draftBody ?? existing.body,
      publishedAt: new Date().toISOString(),
      publishedBy: String(session.userId),
    })!;
    deps.audit?.(
      c,
      {
        category: "data",
        event: AUDIT_EVENTS.data.write(KB_FACTORY),
        result: "success",
        resultCode: 200,
        details: { op: "kb.publish", recordId: id, visibility },
      },
      session,
    );
    return c.json(toEditorShape(next));
  });

  app.delete("/api/kb/articles/:id", async (c) => {
    const id = c.req.param("id");
    const session = await requireActiveSession(c, deps);
    requirePermission(session, "kb.write");
    const ok = store.delete(String(session.activeTenantId), id);
    if (!ok) {
      throw new AppErrorException({
        code: "NOT_FOUND",
        httpStatus: 404,
        message: `kb article ${id} not found`,
      });
    }
    deps.audit?.(
      c,
      {
        category: "data",
        event: AUDIT_EVENTS.data.delete(KB_FACTORY),
        result: "success",
        resultCode: 200,
        details: { op: "kb.delete", recordId: id },
      },
      session,
    );
    return c.json({ id });
  });
}
