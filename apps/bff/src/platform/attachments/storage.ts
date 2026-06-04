/**
 * File-system attachment storage for KB images.
 *
 * Key space: `<baseDir>/<tenantId>/<attachmentId>.<ext>`
 *
 * Path traversal defence: tenant ID and attachment ID are both validated
 * against a strict ULID regex (Crockford Base32, 26 uppercase chars) BEFORE
 * any `fs` operation. Extension is derived from the sniffed MIME type, never
 * from the client-supplied filename.
 *
 * Multi-instance note: `baseDir` is local; multi-instance BFF deployments need
 * a shared mount (NFS/EFS) or S3 migration — tracked as a Known issue (v2.0).
 *
 * Orphan attachments: deleted KB articles leave files on disk. Periodic GC
 * is a v1.2 follow-up. Manual cleanup acceptable on dev/test.
 */
import { randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { DetectedMime } from "./magic-sniff";
import { mimeToExt } from "./magic-sniff";

/**
 * Crockford Base32 ULID regex — 26 chars, only uppercase digits and
 * [0-9A-HJKMNP-TV-Z]. The first char is restricted to [0-7] by ULID spec
 * (48-bit timestamp fits in 10 chars leaving 16 chars random; first char of
 * timestamp is 0–7 in practice), but we accept [0-9A-H] for simplicity since
 * the server generates the IDs and controls the range.
 */
const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/;

function validateId(id: string, label: string): void {
  if (!ULID_REGEX.test(id)) {
    throw new StorageError(`invalid ${label}: must be a 26-char ULID`);
  }
}

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}

export interface StorageEntry {
  readonly mime: DetectedMime;
  readonly bytes: Buffer;
}

/**
 * Generate a ULID-compatible opaque ID using Node's `crypto` module.
 *
 * Format: 26 uppercase Crockford Base32 characters.
 * We generate 16 random bytes (128 bits) and encode as Crockford Base32,
 * which gives 26 chars (130 bits with 2 bits spare, zeroed). This is
 * slightly more entropy than the ULID spec's random section (80 bits) and
 * avoids the timestamp component (unnecessary here; IDs are never sorted).
 *
 * No external dep — pure `node:crypto`.
 */
export function generateAttachmentId(): string {
  // 16 bytes = 128 bits → 26 Crockford Base32 chars
  const bytes = randomBytes(16);
  return encodeCrockford(bytes);
}

// Crockford Base32 alphabet (no I L O U)
const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function encodeCrockford(buf: Buffer): string {
  // Process 5 bits at a time from the bit stream
  let bits = 0;
  let bitsLen = 0;
  let out = "";
  for (const byte of buf) {
    bits = (bits << 8) | byte;
    bitsLen += 8;
    while (bitsLen >= 5) {
      bitsLen -= 5;
      out += CROCKFORD_ALPHABET[(bits >> bitsLen) & 0x1f];
    }
  }
  // Pad remaining bits
  if (bitsLen > 0) {
    out += CROCKFORD_ALPHABET[(bits << (5 - bitsLen)) & 0x1f];
  }
  return out;
}

export class AttachmentStorage {
  constructor(private readonly baseDir: string) {}

  /**
   * Write sanitized attachment bytes to disk.
   * Creates the tenant sub-directory if needed.
   */
  async put(
    tenantId: string,
    attachmentId: string,
    mime: DetectedMime,
    bytes: Buffer,
  ): Promise<void> {
    validateId(tenantId, "tenantId");
    validateId(attachmentId, "attachmentId");
    const dir = join(this.baseDir, tenantId);
    await mkdir(dir, { recursive: true });
    const filePath = join(dir, `${attachmentId}.${mimeToExt(mime)}`);
    await writeFile(filePath, bytes);
  }

  /**
   * Read an attachment. Returns `null` if not found.
   * Tenant isolation is enforced via path lookup — GET returns 404 (not 403)
   * on cross-tenant miss, which is by design (per J.5 spec).
   */
  async get(tenantId: string, attachmentId: string): Promise<StorageEntry | null> {
    validateId(tenantId, "tenantId");
    validateId(attachmentId, "attachmentId");
    const dir = join(this.baseDir, tenantId);
    // Find the file by attachmentId + any extension
    let files: string[];
    try {
      files = await readdir(dir);
    } catch {
      return null; // tenant dir doesn't exist
    }
    const match = files.find((f) => f.startsWith(`${attachmentId}.`));
    if (!match) return null;

    const ext = match.slice(attachmentId.length + 1);
    const mime = extToMime(ext);
    if (!mime) return null;

    const filePath = join(dir, match);
    const bytes = await readFile(filePath);
    return { mime, bytes };
  }

  /** Delete an attachment. No-op if not found. */
  async delete(tenantId: string, attachmentId: string): Promise<void> {
    validateId(tenantId, "tenantId");
    validateId(attachmentId, "attachmentId");
    const dir = join(this.baseDir, tenantId);
    let files: string[];
    try {
      files = await readdir(dir);
    } catch {
      return;
    }
    const match = files.find((f) => f.startsWith(`${attachmentId}.`));
    if (!match) return;
    await unlink(join(dir, match)).catch(() => undefined);
  }
}

function extToMime(ext: string): DetectedMime | null {
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml";
    default:
      return null;
  }
}
