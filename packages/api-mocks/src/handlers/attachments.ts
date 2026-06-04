/**
 * J.5 — MSW mock handlers for KB image upload / serve.
 *
 * POST /api/attachments/kb
 *   - Validates size (> 5 MB → 413) and MIME type (non-image → 415).
 *   - Returns a synthetic `data:` URI so dev + browser tests don't depend on
 *     real file I/O. The URL is a tiny 1×1 transparent PNG encoded as base64.
 *
 * GET /api/attachments/kb/:id
 *   - Returns the synthetic data: URI response for any known ID.
 *   - 404 for unknown IDs.
 */
import { http, HttpResponse } from "msw";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIMES = new Set(["image/png", "image/jpeg", "image/gif", "image/svg+xml"]);

/** 1×1 transparent PNG, base64-encoded. */
const PLACEHOLDER_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const PLACEHOLDER_DATA_URL = `data:image/png;base64,${PLACEHOLDER_PNG_B64}`;

/** In-memory map: attachmentId → mime. */
const store = new Map<string, string>();

let idCounter = 0;
function nextId(): string {
  idCounter++;
  return `MSW${String(idCounter).padStart(23, "0")}`;
}

export const attachmentHandlers = [
  http.post("*/api/attachments/kb", async ({ request }) => {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return HttpResponse.json(
        { code: "VALIDATION", message: "Expected multipart/form-data" },
        { status: 400 },
      );
    }

    const fileEntry = formData.get("file");
    if (!(fileEntry instanceof File)) {
      return HttpResponse.json(
        { code: "VALIDATION", message: "Missing file field" },
        { status: 400 },
      );
    }

    if (fileEntry.size > MAX_SIZE_BYTES) {
      return HttpResponse.json(
        { code: "ATTACHMENT_TOO_LARGE", message: "File exceeds the 5 MB limit" },
        { status: 413 },
      );
    }

    const mime = fileEntry.type?.split(";")[0]?.trim() ?? "";
    if (!ALLOWED_MIMES.has(mime)) {
      return HttpResponse.json(
        {
          code: "ATTACHMENT_UNSUPPORTED_MIME",
          message: "Unsupported file type",
          details: { detected_mime: null },
        },
        { status: 415 },
      );
    }

    const id = nextId();
    store.set(id, mime);

    return HttpResponse.json(
      {
        id,
        url: PLACEHOLDER_DATA_URL,
        mime,
        sizeBytes: fileEntry.size,
      },
      { status: 201 },
    );
  }),

  http.get("*/api/attachments/kb/:id", ({ params }) => {
    const id = params["id"] as string;
    const mime = store.get(id);
    if (!mime) {
      return HttpResponse.json(
        { error: "NOT_FOUND", message: "Attachment not found" },
        { status: 404 },
      );
    }
    // For the mock, always return the placeholder PNG regardless of original type.
    const bytes = Buffer.from(PLACEHOLDER_PNG_B64, "base64");
    return new HttpResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": "inline",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }),
];
