import { createHash } from "node:crypto";

/**
 * PII redaction + pseudonymization per `audit-and-compliance.md` §4.
 *
 * Keys matched case-insensitively. `redact()` walks the object recursively and
 * replaces values by key name. `pseudonymize()` produces a stable 8-byte
 * SHA256 prefix (hex) — same input → same output across runs, but the raw
 * value cannot be recovered without rainbow tables (acceptable per §4.2).
 */

const HARD_REDACTED_KEYS: ReadonlySet<string> = new Set(
  [
    "password",
    "pwd",
    "pass",
    "accesskey",
    "access_key",
    "x-accesskey",
    "secretkey",
    "secret_key",
    "refreshtoken",
    "refresh_token",
    "idtoken",
    "id_token",
    "accesstoken",
    "access_token",
    "authorization",
    "cookie",
    "x-csrf-token",
    "sid",
  ].map((k) => k.toLowerCase()),
);

const PSEUDONYMIZE_KEYS: ReadonlySet<string> = new Set(
  ["email", "recordid", "record_id", "sessionid", "session_id"].map((k) => k.toLowerCase()),
);

const REDACTED = "[REDACTED]" as const;
const MAX_USER_AGENT_LEN = 200;

/** SHA256 first 8 bytes, hex-encoded. Stable across runs. */
export function pseudonymize(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

/**
 * Recursive scrubber. Walks plain objects + arrays; passes through primitives.
 * Non-plain objects (Date, Buffer, Error) are stringified as `[object]` to
 * avoid leaking prototype-chain props.
 */
export function redact(input: unknown): unknown {
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) return input.map(redact);
  if (typeof input !== "object") return input;

  const proto = Object.getPrototypeOf(input);
  if (proto !== Object.prototype && proto !== null) return "[object]";

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const lower = key.toLowerCase();
    if (HARD_REDACTED_KEYS.has(lower)) {
      out[key] = REDACTED;
      continue;
    }
    if (PSEUDONYMIZE_KEYS.has(lower) && typeof value === "string" && value.length > 0) {
      out[key] = pseudonymize(value);
      continue;
    }
    if (lower === "useragent" || lower === "user_agent") {
      out[key] = typeof value === "string" ? value.slice(0, MAX_USER_AGENT_LEN) : value;
      continue;
    }
    out[key] = redact(value);
  }
  return out;
}

/** Strip any `?...` query string from a path. */
export function stripQuery(path: string): string {
  const q = path.indexOf("?");
  return q === -1 ? path : path.slice(0, q);
}
