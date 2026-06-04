/**
 * J.5 — KB image attachment upload + serve endpoints.
 *
 * POST /api/attachments/kb
 *   - Requires active session + kb.edit permission (403 otherwise).
 *   - 5 MB body limit (Hono bodyLimit — 413 if exceeded).
 *   - Reads multipart `file` field via FormData.
 *   - Magic-number sniff determines MIME (server never trusts client Content-Type).
 *   - Cross-checks sniffed MIME against client Content-Type (400 on mismatch).
 *   - JPG: strips APP markers (EXIF/IPTC/XMP/vendor metadata).
 *   - SVG: sanitized via strict sanitize-html allowlist (no script, no
 *     foreignObject, no event handlers, no dangerous xlink:href).
 *   - Generates ULID attachment ID (no external dep).
 *   - Persists under BFF_ATTACHMENTS_DIR/<tenantId>/<attachmentId>.<ext>.
 *   - Emits audit under existing data.kb.write + details.op="attachment.upload"
 *     (F.4 frozen taxonomy — no new event names).
 *   - Returns 201 + { id, url, mime, sizeBytes }.
 *
 * GET /api/attachments/kb/:id
 *   - Requires active session (no specific permission — KB visibility gates the
 *     article URL; images inherit via referrer-based UX).
 *   - Looks up by (session.activeTenantId, id).
 *   - 404 if not found; never 403 (cross-tenant isolation via path lookup).
 *   - Streams with Content-Type + Content-Disposition: inline + Cache-Control.
 */
import type { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { hasPermission, type Permission, type UIRole } from "@sdm/domain";
import { AppErrorException } from "../../auth/errors";
import { AUDIT_EVENTS } from "../../platform/audit";
import { generateAttachmentId, AttachmentStorage } from "../../platform/attachments/storage";
import { sniffMime, ALLOWED_MIMES } from "../../platform/attachments/magic-sniff";
import { stripJpgMetadata } from "../../platform/attachments/exif-strip";
import { sanitizeSvg } from "../../platform/attachments/svg-sanitize";
import { requireActiveSession } from "../../session/load";
import type { SessionPayload } from "../../session/types";
import type { RestProxyDeps } from "../rest-proxy";

const KB_FACTORY = "kb";

// 5 MB
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

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

export interface AttachmentsKbDeps extends RestProxyDeps {
  /** Override for tests — defaults to the storage keyed on config.attachments.kbDir. */
  readonly storage?: AttachmentStorage;
}

export function registerAttachmentsKbRoutes(app: Hono, deps: AttachmentsKbDeps): void {
  const kbDir = deps.config.attachments?.kbDir ?? "./.attachments-kb";
  const storage = deps.storage ?? new AttachmentStorage(kbDir);

  // ─── POST /api/attachments/kb ────────────────────────────────────────────
  app.post(
    "/api/attachments/kb",
    bodyLimit({
      maxSize: MAX_SIZE_BYTES,
      onError: (c) =>
        c.json(
          {
            code: "ATTACHMENT_TOO_LARGE",
            message: `File exceeds the 5 MB limit`,
          },
          413,
        ),
    }),
    async (c) => {
      const session = await requireActiveSession(c, deps);
      requirePermission(session, "kb.write");

      let formData: FormData;
      try {
        formData = await c.req.formData();
      } catch {
        throw new AppErrorException({
          code: "VALIDATION",
          httpStatus: 400,
          message: "Request body must be multipart/form-data",
        });
      }

      const fileEntry = formData.get("file");
      if (!(fileEntry instanceof File)) {
        throw new AppErrorException({
          code: "VALIDATION",
          httpStatus: 400,
          message: "Missing 'file' field in form data",
        });
      }

      if (fileEntry.size > MAX_SIZE_BYTES) {
        return c.json(
          { code: "ATTACHMENT_TOO_LARGE", message: "File exceeds the 5 MB limit" },
          413,
        );
      }

      const rawBytes = Buffer.from(await fileEntry.arrayBuffer());

      // 1. Magic-number sniff — authoritative MIME (server never trusts client)
      const sniffed = sniffMime(rawBytes);
      if (!sniffed) {
        // Use VALIDATION code + code in details body to stay within AppErrorCode enum
        return c.json(
          {
            code: "ATTACHMENT_UNSUPPORTED_MIME",
            message: "Unsupported file type — only PNG, JPEG, GIF, SVG allowed",
            details: { detected_mime: null },
          },
          415,
        );
      }

      // 2. Cross-check client Content-Type against sniffed MIME
      const clientMime = fileEntry.type?.split(";")[0]?.trim() ?? "";
      if (clientMime && ALLOWED_MIMES.has(clientMime) && clientMime !== sniffed) {
        return c.json(
          {
            code: "ATTACHMENT_MIME_MISMATCH",
            message: `Client Content-Type (${clientMime}) does not match detected MIME (${sniffed})`,
          },
          400,
        );
      }

      // 3. Format-specific processing
      let processedBytes: Buffer;
      if (sniffed === "image/jpeg") {
        processedBytes = stripJpgMetadata(rawBytes);
      } else if (sniffed === "image/svg+xml") {
        const svgText = rawBytes.toString("utf8");
        const sanitized = sanitizeSvg(svgText);
        processedBytes = Buffer.from(sanitized, "utf8");
      } else {
        processedBytes = rawBytes;
      }

      // 4. Generate opaque ID + persist
      const attachmentId = generateAttachmentId();
      const tenantId = String(session.activeTenantId);
      await storage.put(tenantId, attachmentId, sniffed, processedBytes);

      // 5. Emit audit (frozen F.4 taxonomy — no new event names)
      deps.audit?.(
        c,
        {
          category: "data",
          event: AUDIT_EVENTS.data.write(KB_FACTORY),
          result: "success",
          resultCode: 201,
          details: {
            op: "attachment.upload",
            attachment_id: attachmentId,
            mime: sniffed,
            size_bytes: processedBytes.length,
          },
        },
        session,
      );

      const url = `/api/attachments/kb/${attachmentId}`;
      return c.json(
        { id: attachmentId, url, mime: sniffed, sizeBytes: processedBytes.length },
        201,
      );
    },
  );

  // ─── GET /api/attachments/kb/:id ─────────────────────────────────────────
  app.get("/api/attachments/kb/:id", async (c) => {
    const session = await requireActiveSession(c, deps);
    const id = c.req.param("id");

    // Validate ID format BEFORE any fs operation (path traversal defence)
    const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/;
    if (!ULID_REGEX.test(id)) {
      throw new AppErrorException({
        code: "VALIDATION",
        httpStatus: 400,
        message: "Invalid attachment ID",
      });
    }

    const tenantId = String(session.activeTenantId);
    const entry = await storage.get(tenantId, id);

    // 404 (never 403) — tenant isolation via path lookup; caller cannot distinguish
    // "not in your tenant" from "does not exist".
    if (!entry) {
      throw new AppErrorException({
        code: "NOT_FOUND",
        httpStatus: 404,
        message: `Attachment ${id} not found`,
      });
    }

    return new Response(entry.bytes, {
      status: 200,
      headers: {
        "Content-Type": entry.mime,
        "Content-Disposition": "inline",
        "Cache-Control": "public, max-age=86400",
        "Content-Length": String(entry.bytes.length),
      },
    });
  });
}
