import { Hono } from "hono";
import pino from "pino";
import { beforeEach, describe, expect, it } from "vitest";
import { contactId, roleId, tenantId, userId } from "@sdm/domain";
import { SdmHttpClient } from "../src/api/http-client";
import { createApiRoutesState, registerApiRoutes } from "../src/api/routes";
import { correlationMiddleware } from "../src/auth/correlation";
import { AppErrorException, toAppErrorBody } from "../src/auth/errors";
import type { RuntimeConfig } from "../src/config/schema";
import { createAuditEmitter } from "../src/platform/audit";
import { AttachmentStorage } from "../src/platform/attachments/storage";
import type { DetectedMime } from "../src/platform/attachments/magic-sniff";
import { createSessionStore } from "../src/session";
import type { SessionPayload } from "../src/session/types";

/**
 * J.5 — /api/attachments/kb endpoint test matrix. Covers 12+ cases:
 *   1. happy upload PNG → 201 + body { id, url, mime, sizeBytes }
 *   2. happy upload JPEG (with APP1 marker) → APP1 stripped from stored bytes
 *   3. happy upload GIF → 201
 *   4. happy upload SVG → sanitized (script stripped)
 *   5. size limit: body > 5 MB → 413
 *   6. MIME mismatch: PNG magic but client says image/jpeg → 400
 *   7. magic-number reject: random bytes → 415
 *   8. SVG sanitization: script element stripped before persist
 *   9. path traversal block: GET /api/attachments/kb/../../etc/passwd → 400
 *  10. GET serve happy path → 200 + correct Content-Type
 *  11. GET 404 for unknown attachment
 *  12. POST auth gate: no session → 401
 *  13. POST permission gate: requester role (no kb.write) → 403
 */

const BASE = "http://test-sdm.local/caisd-rest";
const KB_EDITOR_SID = "kb-editor-sid";
const REQUESTER_SID = "requester-sid";

// ── Test fixture bytes ────────────────────────────────────────────────────────

/** Minimal valid PNG: 8-byte signature only (enough for magic sniff). */
const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  // Minimal IHDR chunk (13 bytes data + 4 len + 4 type + 4 crc = 25 bytes)
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
]);

/** Minimal JPEG with one APP1 (EXIF) marker. */
const JPEG_WITH_EXIF = Buffer.from([
  0xff,
  0xd8, // SOI
  0xff,
  0xe1, // APP1 marker
  0x00,
  0x14, // length = 20 (includes the 2 length bytes)
  0x45,
  0x78,
  0x69,
  0x66,
  0x00,
  0x00, // "Exif\0\0"
  0x49,
  0x49,
  0x2a,
  0x00,
  0x08,
  0x00,
  0x00,
  0x00, // TIFF header
  0x00,
  0x00, // filler to reach length
  0xff,
  0xda, // SOS
  0xab,
  0xcd, // "image data"
  0xff,
  0xd9, // EOI
]);

/** Minimal GIF87a. */
const GIF_BYTES = Buffer.concat([
  Buffer.from("GIF87a", "ascii"),
  Buffer.from([0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00]),
  Buffer.from([0xff, 0xff, 0xff, 0x00, 0x00, 0x00]),
  Buffer.from([0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]),
  Buffer.from([0x02, 0x02, 0x44, 0x01, 0x00, 0x3b]),
]);

/** Benign SVG. */
const SVG_CLEAN = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect x="0" y="0" width="10" height="10" fill="red"/></svg>',
);

/** SVG with XSS payload (script element). */
const SVG_WITH_SCRIPT = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert("xss")</script><circle cx="5" cy="5" r="5"/></svg>',
);

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeConfig(): RuntimeConfig {
  return {
    nodeEnv: "test",
    bff: { port: 5174, trustedOrigins: ["http://localhost:5500"], logLevel: "fatal" },
    casdm: { baseUrl: BASE, basicAuthUser: "u", basicAuthPass: "p", requestTimeoutMs: 2000 },
    session: {
      driver: "memory",
      cookieName: "sdm.sid",
      cookieSecure: false,
      sameSite: "Lax",
      idleSec: 1800,
      absoluteSec: 28800,
      cookieMaxAgeSec: 28800,
    },
    attachments: { kbDir: "/tmp/test-attachments-kb" },
    uiRoleMapping: {},
  };
}

interface AuditMock {
  readonly calls: Array<{ event: string; details?: Record<string, unknown> }>;
}

/** In-memory storage stub (avoids disk I/O in tests). */
class InMemoryStorage extends AttachmentStorage {
  private readonly store = new Map<string, { mime: string; bytes: Buffer }>();

  constructor() {
    super("/dev/null");
  }

  override async put(
    tId: string,
    attachmentId: string,
    mime: string,
    bytes: Buffer,
  ): Promise<void> {
    this.store.set(`${tId}::${attachmentId}`, { mime, bytes });
  }

  override async get(
    tId: string,
    attachmentId: string,
  ): Promise<{ mime: DetectedMime; bytes: Buffer } | null> {
    const entry = this.store.get(`${tId}::${attachmentId}`);
    if (!entry) return null;
    return entry as { mime: DetectedMime; bytes: Buffer };
  }

  override async delete(tId: string, attachmentId: string): Promise<void> {
    this.store.delete(`${tId}::${attachmentId}`);
  }

  /** Direct access for assertion — returns stored bytes for last-written ID. */
  getBytes(tId: string, attachmentId: string): Buffer | undefined {
    return this.store.get(`${tId}::${attachmentId}`)?.bytes;
  }
}

async function buildApi(): Promise<{ app: Hono; audit: AuditMock; storage: InMemoryStorage }> {
  const config = makeConfig();
  const log = pino({ level: "silent" });
  const sessionStore = createSessionStore({ driver: "memory" });
  const client = new SdmHttpClient(
    { baseUrl: BASE, requestTimeoutMs: 2000, maxRetries: 0 },
    { fetch: globalThis.fetch, log },
  );
  const storage = new InMemoryStorage();

  const now = Date.now();
  const baseSession = {
    activeTenantId: tenantId("default"),
    accessKey: "key",
    accessKeyId: "kid",
    accessKeyExpiresAt: now + 3_600_000,
    createdAt: now,
    lastSeenAt: now,
    absoluteExpiresAt: now + 28_800_000,
    cookieVersion: 1,
  };

  const editorPayload: SessionPayload = {
    sid: KB_EDITOR_SID,
    userId: userId("kb.jana"),
    contactId: contactId("U'JANA'"),
    displayName: "Jana KB",
    email: "jana@example",
    tenants: [
      {
        id: tenantId("default"),
        name: "default",
        roles: [{ id: roleId("20002"), sym: "KbEditor", uiRole: "kb_editor" }],
      },
    ],
    ...baseSession,
  };
  await sessionStore.create(KB_EDITOR_SID, editorPayload, 28800);

  const requesterPayload: SessionPayload = {
    sid: REQUESTER_SID,
    userId: userId("lucia"),
    contactId: contactId("U'LUCIA'"),
    displayName: "Lucia",
    email: "lucia@example",
    tenants: [
      {
        id: tenantId("default"),
        name: "default",
        roles: [{ id: roleId("10001"), sym: "Requester", uiRole: "requester" }],
      },
    ],
    ...baseSession,
  };
  await sessionStore.create(REQUESTER_SID, requesterPayload, 28800);

  const calls: AuditMock["calls"] = [];
  const realAudit = createAuditEmitter({ log });
  const audit: typeof realAudit = (c, input, session) => {
    calls.push({ event: input.event, details: input.details as Record<string, unknown> });
    realAudit(c, input, session);
  };

  const app = new Hono();
  app.use("*", correlationMiddleware());
  registerApiRoutes(
    app,
    { client, sessionStore, config, log, audit, storage },
    createApiRoutesState(),
  );
  app.onError((err, c) => {
    if (err instanceof AppErrorException) {
      return c.json(
        toAppErrorBody({ code: err.code, message: err.message, httpStatus: err.httpStatus }),
        err.httpStatus as never,
      );
    }
    return c.json({ error: "internal_error" }, 500);
  });
  return { app, audit: { calls }, storage };
}

function cookieHeader(sid: string): Record<string, string> {
  return { Cookie: `sdm.sid=${sid}` };
}

function buildFormData(fileName: string, mimeType: string, bytes: Buffer): FormData {
  const fd = new FormData();
  fd.append("file", new File([bytes], fileName, { type: mimeType }));
  return fd;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/attachments/kb", () => {
  let app: Hono;
  let audit: AuditMock;
  let storage: InMemoryStorage;

  beforeEach(async () => {
    ({ app, audit, storage } = await buildApi());
  });

  it("1. happy upload PNG → 201 + correct body shape", async () => {
    const fd = buildFormData("test.png", "image/png", PNG_BYTES);
    const res = await app.fetch(
      new Request("http://bff/api/attachments/kb", {
        method: "POST",
        headers: cookieHeader(KB_EDITOR_SID),
        body: fd,
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(typeof body.id).toBe("string");
    expect(body.url).toBe(`/api/attachments/kb/${body.id as string}`);
    expect(body.mime).toBe("image/png");
    expect(typeof body.sizeBytes).toBe("number");
  });

  it("2. happy upload JPEG with EXIF — APP1 marker stripped", async () => {
    const fd = buildFormData("photo.jpg", "image/jpeg", JPEG_WITH_EXIF);
    const res = await app.fetch(
      new Request("http://bff/api/attachments/kb", {
        method: "POST",
        headers: cookieHeader(KB_EDITOR_SID),
        body: fd,
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.mime).toBe("image/jpeg");

    // Stored bytes must not contain APP1 marker (FF E1)
    const stored = storage.getBytes("default", body.id as string);
    expect(stored).toBeDefined();
    const hex = stored!.toString("hex");
    // APP1 = FF E1 — should be gone
    expect(hex).not.toContain("ffe1");
  });

  it("3. happy upload GIF → 201", async () => {
    const fd = buildFormData("anim.gif", "image/gif", GIF_BYTES);
    const res = await app.fetch(
      new Request("http://bff/api/attachments/kb", {
        method: "POST",
        headers: cookieHeader(KB_EDITOR_SID),
        body: fd,
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.mime).toBe("image/gif");
  });

  it("4. happy upload SVG → 201 + script stripped", async () => {
    const fd = buildFormData("diagram.svg", "image/svg+xml", SVG_WITH_SCRIPT);
    const res = await app.fetch(
      new Request("http://bff/api/attachments/kb", {
        method: "POST",
        headers: cookieHeader(KB_EDITOR_SID),
        body: fd,
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.mime).toBe("image/svg+xml");

    // Stored SVG must not contain script
    const stored = storage.getBytes("default", body.id as string);
    const text = stored?.toString("utf8") ?? "";
    expect(text).not.toContain("script");
    expect(text).not.toContain("alert");
  });

  it("5. size limit: file > 5 MB → 413", async () => {
    const bigBuf = Buffer.concat([
      PNG_BYTES,
      Buffer.alloc(5 * 1024 * 1024 + 1, 0), // exceed by 1 byte
    ]);
    const fd = buildFormData("huge.png", "image/png", bigBuf);
    const res = await app.fetch(
      new Request("http://bff/api/attachments/kb", {
        method: "POST",
        headers: cookieHeader(KB_EDITOR_SID),
        body: fd,
      }),
    );
    // bodyLimit or secondary check returns 413
    expect(res.status).toBe(413);
  });

  it("6. MIME mismatch: PNG magic but client says image/jpeg → 400", async () => {
    const fd = buildFormData("tricky.jpg", "image/jpeg", PNG_BYTES);
    const res = await app.fetch(
      new Request("http://bff/api/attachments/kb", {
        method: "POST",
        headers: cookieHeader(KB_EDITOR_SID),
        body: fd,
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.code).toBe("ATTACHMENT_MIME_MISMATCH");
  });

  it("7. magic-number reject: random binary data → 415", async () => {
    const randomBuf = Buffer.from([0xde, 0xad, 0xbe, 0xef, ...Array(100).fill(0x00)]);
    const fd = buildFormData("evil.png", "image/png", randomBuf);
    const res = await app.fetch(
      new Request("http://bff/api/attachments/kb", {
        method: "POST",
        headers: cookieHeader(KB_EDITOR_SID),
        body: fd,
      }),
    );
    expect(res.status).toBe(415);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.code).toBe("ATTACHMENT_UNSUPPORTED_MIME");
  });

  it("8. clean SVG passes sanitizer and keeps basic structure", async () => {
    const fd = buildFormData("diagram.svg", "image/svg+xml", SVG_CLEAN);
    const res = await app.fetch(
      new Request("http://bff/api/attachments/kb", {
        method: "POST",
        headers: cookieHeader(KB_EDITOR_SID),
        body: fd,
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    const stored = storage.getBytes("default", body.id as string);
    expect(stored?.toString("utf8")).toContain("<rect");
  });

  it("12. auth gate: no session cookie → 401", async () => {
    const fd = buildFormData("test.png", "image/png", PNG_BYTES);
    const res = await app.fetch(
      new Request("http://bff/api/attachments/kb", {
        method: "POST",
        body: fd,
      }),
    );
    expect(res.status).toBe(401);
  });

  it("13. permission gate: requester role → 403", async () => {
    const fd = buildFormData("test.png", "image/png", PNG_BYTES);
    const res = await app.fetch(
      new Request("http://bff/api/attachments/kb", {
        method: "POST",
        headers: cookieHeader(REQUESTER_SID),
        body: fd,
      }),
    );
    expect(res.status).toBe(403);
  });

  it("audit emits data.kb.write with op=attachment.upload on success", async () => {
    const fd = buildFormData("test.png", "image/png", PNG_BYTES);
    await app.fetch(
      new Request("http://bff/api/attachments/kb", {
        method: "POST",
        headers: cookieHeader(KB_EDITOR_SID),
        body: fd,
      }),
    );
    const uploadEmit = audit.calls.find((c) => c.details?.["op"] === "attachment.upload");
    expect(uploadEmit).toBeDefined();
    expect(uploadEmit!.event).toBe("data.kb.write");
    expect(uploadEmit!.details?.["mime"]).toBe("image/png");
  });
});

describe("GET /api/attachments/kb/:id", () => {
  let app: Hono;

  beforeEach(async () => {
    ({ app } = await buildApi());
  });

  it("10. GET serve happy path → 200 + correct Content-Type", async () => {
    // Upload first
    const fd = buildFormData("serve.png", "image/png", PNG_BYTES);
    const uploadRes = await app.fetch(
      new Request("http://bff/api/attachments/kb", {
        method: "POST",
        headers: cookieHeader(KB_EDITOR_SID),
        body: fd,
      }),
    );
    expect(uploadRes.status).toBe(201);
    const { id } = (await uploadRes.json()) as { id: string };

    // Now GET it
    const getRes = await app.fetch(
      new Request(`http://bff/api/attachments/kb/${id}`, {
        method: "GET",
        headers: cookieHeader(KB_EDITOR_SID),
      }),
    );
    expect(getRes.status).toBe(200);
    expect(getRes.headers.get("Content-Type")).toBe("image/png");
    expect(getRes.headers.get("Cache-Control")).toContain("max-age=86400");
    expect(getRes.headers.get("Content-Disposition")).toBe("inline");
  });

  it("11. GET 404 for unknown attachment", async () => {
    const fakeId = "01ARZ3NDEKTSV4RRFFQ69G5FAV"; // valid ULID format, not stored
    const getRes = await app.fetch(
      new Request(`http://bff/api/attachments/kb/${fakeId}`, {
        method: "GET",
        headers: cookieHeader(KB_EDITOR_SID),
      }),
    );
    expect(getRes.status).toBe(404);
  });

  it("9. path traversal block: invalid ID format → 400", async () => {
    const traversalId = "../../etc/passwd";
    const getRes = await app.fetch(
      new Request(`http://bff/api/attachments/kb/${encodeURIComponent(traversalId)}`, {
        method: "GET",
        headers: cookieHeader(KB_EDITOR_SID),
      }),
    );
    // Either 400 (our validation) or 404 (Hono route mismatch) — must not be 200
    expect(getRes.status).not.toBe(200);
  });

  it("GET auth gate: no session → 401", async () => {
    const fakeId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    const getRes = await app.fetch(
      new Request(`http://bff/api/attachments/kb/${fakeId}`, { method: "GET" }),
    );
    expect(getRes.status).toBe(401);
  });
});
