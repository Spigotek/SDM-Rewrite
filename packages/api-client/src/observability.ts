/**
 * Sentry-agnostic PII redaction + pseudonymization helpers shared by the
 * portal + workspace `bootstrap/sentry.ts` files.
 *
 * Kept in `@sdm/api-client` (not in a dedicated `@sdm/observability` package)
 * because both apps already depend on this package and the helpers are tiny.
 * The Sentry SDK itself is NOT imported here — types use a structural `Json`
 * shape so the package stays runtime-free of `@sentry/react`.
 *
 * Strip rules per ADR-09 §1 + `audit-and-compliance.md` §4:
 *  - Hard-redact keys containing any of `PII_KEY_FRAGMENTS` (case-insensitive
 *    substring match). Value is replaced with the sentinel `<redacted>`
 *    instead of being deleted, so the event still shows where the field was
 *    (the analyst sees structure, not content).
 *  - Walk the tree recursively. Arrays preserve length; plain objects
 *    preserve key order; non-plain objects (Date, Error, Map, etc.) are
 *    replaced with `[object]` to avoid leaking prototype-chain props.
 */

export const REDACTED_SENTINEL = "<redacted>" as const;

/**
 * Substrings (lowercased) that, if found in a key name, trigger redaction of
 * that key's value. Order matters only for documentation; lookup is O(n) per
 * key but `n` is tiny.
 */
export const PII_KEY_FRAGMENTS: readonly string[] = [
  "email",
  "displayname",
  "firstname",
  "lastname",
  "fullname",
  "name", // matches name, userName, customerName, ... — by design.
  "description",
  "summary",
  "body",
  "text",
  "customer",
  "analyst",
  "assignee",
  "requester",
  "phone",
  "address",
];

function keyMatches(key: string): boolean {
  const lower = key.toLowerCase();
  return PII_KEY_FRAGMENTS.some((frag) => lower.includes(frag));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Deep-strip PII keys from any JSON-like value. Returns a new object — never
 * mutates the input. Cycles are not expected in Sentry event payloads, so no
 * WeakSet guard; if you point this at an arbitrary tree, wrap it in a
 * try/catch.
 */
export function stripPiiDeep(input: unknown, depth = 0): unknown {
  // Stop runaway recursion on hostile / malformed input.
  if (depth > 16) return REDACTED_SENTINEL;
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) return input.map((v) => stripPiiDeep(v, depth + 1));
  if (typeof input !== "object") return input;
  if (!isPlainObject(input)) return "[object]";

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (keyMatches(key)) {
      out[key] = REDACTED_SENTINEL;
      continue;
    }
    out[key] = stripPiiDeep(value, depth + 1);
  }
  return out;
}

/**
 * Pseudonymize a user identifier — SHA-256 of (salt + value), first 16 hex
 * chars. Same algorithm as `apps/bff/src/platform/audit/redact.ts` so a
 * Sentry user-id and a BFF audit user-id collide when correlating events.
 *
 * Browser-only: uses `crypto.subtle.digest`. Async by necessity — call this
 * in an effect, not in a render path.
 */
export async function pseudonymize(value: string, salt: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    // Degrade in non-crypto environments (older Safari, Node test). Returns
    // a non-cryptographic hash that still anonymizes raw IDs in logs.
    let h = 0;
    const combined = salt + value;
    for (let i = 0; i < combined.length; i += 1) {
      h = (h * 31 + combined.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(16).padStart(8, "0").slice(0, 16);
  }
  const enc = new TextEncoder();
  const data = enc.encode(salt + value);
  const hash = await subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

/**
 * Structural shape of a Sentry event subset that `sanitizeSentryEvent`
 * inspects. Defined locally to keep this module free of `@sentry/react`
 * imports — the runtime Sentry SDK is loaded only in app bootstraps.
 *
 * Field types intentionally loose (`unknown` / `string | number`) so a real
 * `Sentry.ErrorEvent` (where `user.id?: string | number`) is structurally
 * assignable when callers pass it via a type cast.
 */
export interface SanitizableEvent {
  user?: { id?: string | number; ip_address?: string; [key: string]: unknown };
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  request?: { cookies?: unknown; data?: unknown; [key: string]: unknown };
  breadcrumbs?: Array<{ data?: unknown; [key: string]: unknown }>;
  [key: string]: unknown;
}

/**
 * `beforeSend` body — strips PII from every well-known PII surface in a
 * Sentry event. Designed to be safe to call on partial events (any field
 * may be missing).
 */
export function sanitizeSentryEvent<T extends SanitizableEvent>(event: T): T {
  if (event.user) {
    // Keep only the pseudonymized id; drop email, username, ip_address.
    const id = event.user.id;
    const safeId =
      typeof id === "string" || typeof id === "number" ? (id as string | number) : undefined;
    event.user = safeId === undefined ? {} : { id: safeId };
  }
  if (event.extra) event.extra = stripPiiDeep(event.extra) as Record<string, unknown>;
  if (event.contexts) event.contexts = stripPiiDeep(event.contexts) as Record<string, unknown>;
  if (event.request) {
    const next: Record<string, unknown> = { ...event.request };
    if (event.request.cookies !== undefined) next.cookies = REDACTED_SENTINEL;
    if (event.request.data !== undefined) next.data = stripPiiDeep(event.request.data);
    (event as { request: SanitizableEvent["request"] }).request =
      next as SanitizableEvent["request"];
  }
  if (Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs = event.breadcrumbs.map((bc) => {
      const next: Record<string, unknown> = { ...bc };
      if (bc.data !== undefined) next.data = stripPiiDeep(bc.data);
      return next as { data?: unknown; [key: string]: unknown };
    });
  }
  return event;
}
