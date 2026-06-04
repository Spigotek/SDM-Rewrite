/**
 * Magic-number–based MIME detection for KB image attachments.
 *
 * Server always sniffs BEFORE trusting client Content-Type.
 * Only the four whitelisted MIME types are returned; everything else is null.
 */

export type DetectedMime = "image/png" | "image/jpeg" | "image/gif" | "image/svg+xml";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const GIF87_MAGIC = Buffer.from("GIF87a", "ascii");
const GIF89_MAGIC = Buffer.from("GIF89a", "ascii");

/**
 * Detect MIME by inspecting raw bytes. Returns `null` for anything outside
 * the PNG / JPEG / GIF / SVG whitelist.
 *
 * SVG is text-based: we decode the first ≤ 1 KB as UTF-8 and look for the
 * `<svg` opening tag (with or without an `<?xml` preamble).
 */
export function sniffMime(buf: Buffer): DetectedMime | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(PNG_MAGIC)) return "image/png";
  if (buf.length >= 3 && buf.subarray(0, 3).equals(JPG_MAGIC)) return "image/jpeg";
  if (buf.length >= 6) {
    const head6 = buf.subarray(0, 6);
    if (head6.equals(GIF87_MAGIC) || head6.equals(GIF89_MAGIC)) return "image/gif";
  }
  // SVG is text-based: look for <svg tag (with optional XML declaration) in
  // the first 1 KB. Case-insensitive per the SVG spec.
  const head = buf.subarray(0, Math.min(1024, buf.length)).toString("utf8");
  if (/^\s*(?:<\?xml[^?]*\?>\s*)?<svg[\s>]/i.test(head)) return "image/svg+xml";
  return null;
}

/** Map a DetectedMime to its canonical file extension (no dot prefix). */
export function mimeToExt(mime: DetectedMime): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/gif":
      return "gif";
    case "image/svg+xml":
      return "svg";
  }
}

/** Canonical MIME strings the server accepts (same set as the FE guards). */
export const ALLOWED_MIMES: ReadonlySet<string> = new Set<DetectedMime>([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/svg+xml",
]);
