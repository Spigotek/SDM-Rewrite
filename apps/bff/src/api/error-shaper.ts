import { AppErrorException, type AppErrorCode } from "../auth/errors";
import { parseSdmResponseBody } from "./xml-json";

/**
 * Map a raw CA SDM REST response (status + body + content-type) to either
 * `null` (success) or an `AppErrorException` ready to throw.
 *
 * Centralises the error-classification rules captured empirically in
 * `docs/agents/devex-devops/real-backend-contracts.md` (§8 + §20). The most
 * non-obvious ones — and the reason this file exists rather than inline
 * checks in every caller — are:
 *
 *  - **HTTP 400 + body matching `Invalid REST Access Key`** → `AUTH_EXPIRED`
 *    (NOT 401; the upstream returns 400 for expired/invalid keys, §8).
 *  - **HTTP 409 + body matching `Invalid number of rows (0) affected`** →
 *    `NOT_FOUND` (PUT on unknown id surfaces as 409, §20 row 5).
 *  - **HTTP 415 (Content-Type missing on a write)** → `VALIDATION` — the
 *    proxy must always send Content-Type, so this should never reach the FE.
 *  - **HTTP 405** on entity factories is universal (DELETE always denied,
 *    §21 item 5); soft-close uses `status=CL`. Returned as `UNKNOWN` so it
 *    surfaces clearly as a BFF wiring bug rather than user-facing 4xx.
 */
export interface SdmResponseSlice {
  readonly status: number;
  readonly text: string;
  readonly headers: Headers;
  readonly op: string;
}

const DEFAULT_SUCCESS = [200, 201, 204] as const;

export function classifySdmResponse(
  res: SdmResponseSlice,
  successStatuses: ReadonlyArray<number> = DEFAULT_SUCCESS,
): AppErrorException | null {
  if (successStatuses.includes(res.status)) return null;

  const message = extractMessage(res);
  const code = classifyStatus(res.status, message);
  const httpStatus = appErrorToHttpStatus(code);

  return new AppErrorException({
    code,
    httpStatus,
    message: shapeUserMessage(code, message, res.status, res.op),
    details: {
      op: res.op,
      sdmStatus: res.status,
      sdmMessage: message.slice(0, 500),
    },
  });
}

/**
 * Strict variant: throw on any non-success status. Used by the broker, which
 * historically only accepted HTTP 200 from read endpoints (§7).
 */
export function assertSdmOk(res: SdmResponseSlice, successStatuses?: ReadonlyArray<number>): void {
  const err = classifySdmResponse(res, successStatuses);
  if (err) throw err;
}

function classifyStatus(status: number, message: string): AppErrorCode {
  if (status === 400) {
    if (/Invalid REST Access Key/i.test(message)) return "AUTH_EXPIRED";
    if (/Required attribute /i.test(message)) return "VALIDATION";
    if (/com\.ca\.sdm\.dal\./i.test(message)) return "VALIDATION";
    if (/Invalid payload/i.test(message)) return "VALIDATION";
    if (/unexpected Database error/i.test(message)) return "VALIDATION";
    return "VALIDATION";
  }
  if (status === 401) return "AUTH_FORBIDDEN";
  if (status === 403) return "AUTH_FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) {
    if (/Invalid number of rows \(0\) affected/i.test(message)) return "NOT_FOUND";
    return "CONFLICT";
  }
  if (status === 415) return "VALIDATION";
  if (status >= 500) return "BACKEND_UNAVAILABLE";
  return "UNKNOWN";
}

function appErrorToHttpStatus(code: AppErrorCode): number {
  switch (code) {
    case "AUTH_INVALID_CREDENTIALS":
      return 401;
    case "AUTH_EXPIRED":
      return 401;
    case "AUTH_FORBIDDEN":
      return 403;
    case "TENANT_FORBIDDEN":
      return 403;
    case "VALIDATION":
      return 400;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    case "BACKEND_UNAVAILABLE":
      return 503;
    case "NETWORK":
      return 502;
    case "UNKNOWN":
      return 502;
  }
}

function shapeUserMessage(
  code: AppErrorCode,
  sdmMessage: string,
  status: number,
  op: string,
): string {
  if (code === "AUTH_EXPIRED") return "CA SDM access key expired or invalid";
  if (code === "NOT_FOUND") {
    if (status === 409) return `${op}: not found`;
    return sdmMessage.trim() || `${op}: not found`;
  }
  if (code === "BACKEND_UNAVAILABLE") return `CA SDM ${op} failed (HTTP ${status})`;
  if (code === "VALIDATION") {
    const stripped = stripDalPrefix(sdmMessage).trim();
    return stripped || `${op}: validation error`;
  }
  if (code === "AUTH_FORBIDDEN") return "CA SDM denied the request";
  return sdmMessage.trim() || `${op} failed (HTTP ${status})`;
}

function stripDalPrefix(msg: string): string {
  return msg.replace(/^com\.ca\.sdm\.dal\.[^:]+:\s*/i, "");
}

/**
 * Extract the human-readable message from a CA SDM error body. Honours both
 * shapes per §20: JSON `{"status":"…","message":"…"}` and XML
 * `<error><message>…</message><status>…</status></error>`. Empty body → "".
 */
function extractMessage(res: SdmResponseSlice): string {
  if (!res.text) return "";
  const contentType = res.headers.get("content-type");
  try {
    const parsed = parseSdmResponseBody(res.text, contentType);
    if (parsed && typeof parsed === "object") {
      const root = parsed as Record<string, unknown>;
      if (typeof root["message"] === "string") return root["message"];
      const err = root["error"];
      if (err && typeof err === "object") {
        const inner = (err as Record<string, unknown>)["message"];
        if (typeof inner === "string") return inner;
      }
    }
  } catch {
    // body wasn't parseable — fall through to raw text below
  }
  return res.text.slice(0, 500);
}
