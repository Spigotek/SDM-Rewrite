/**
 * J.5 — KB image upload helper.
 *
 * Client-side guards (size + MIME) run before the request to avoid round-trips
 * on obvious rejects. Server enforces the same rules authoritatively.
 */

export interface UploadResult {
  readonly id: string;
  readonly url: string;
  readonly mime: string;
  readonly sizeBytes: number;
}

export class AttachmentError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AttachmentError";
  }
}

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_MIMES = new Set(["image/png", "image/jpeg", "image/gif", "image/svg+xml"]);

/**
 * Upload a KB image attachment to the BFF.
 *
 * Pre-upload guards:
 *   - Reject files > 5 MB to avoid a useless round-trip.
 *   - Reject non-whitelisted MIME types (client-side check only; server
 *     enforces via magic-number sniff — client Content-Type is advisory).
 *
 * Throws `AttachmentError` on any failure, with `code` matching the BFF
 * error code so the caller can surface the right i18n message.
 */
export async function uploadKbImage(file: File): Promise<UploadResult> {
  if (file.size > MAX_SIZE_BYTES) {
    throw new AttachmentError("ATTACHMENT_TOO_LARGE", "File exceeds the 5 MB limit");
  }

  if (!ALLOWED_MIMES.has(file.type)) {
    throw new AttachmentError("ATTACHMENT_UNSUPPORTED_MIME", `Unsupported file type: ${file.type}`);
  }

  const fd = new FormData();
  fd.append("file", file);

  const response = await fetch("/api/attachments/kb", {
    method: "POST",
    body: fd,
    credentials: "include",
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const code = typeof errorBody["code"] === "string" ? errorBody["code"] : "UPLOAD_ERROR";
    const message =
      typeof errorBody["message"] === "string" ? errorBody["message"] : "Upload failed";
    throw new AttachmentError(code, message);
  }

  return response.json() as Promise<UploadResult>;
}
