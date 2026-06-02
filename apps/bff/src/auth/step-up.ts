import { createHmac } from "node:crypto";
import type { Hono } from "hono";
import type { Context } from "hono";
import type { Logger } from "pino";
import { z } from "zod";
import { AUDIT_EVENTS, type AuditEmitter } from "../platform/audit";
import type { RuntimeConfig } from "../config/schema";
import { requireActiveSession } from "../session/load";
import type { SessionStore } from "../session/types";
import { AppErrorException, toAppErrorBody } from "./errors";
import { mintStepUpToken } from "./step-up-token";

/**
 * I.1 step-up 2FA — `POST /auth/step-up { totp }`.
 *
 * Validates a 6-digit TOTP (RFC 6238, SHA-1, 30 s window, ±1 step skew) against
 * a per-user secret seed and mints a single-use 15-min step-up token on
 * success. Callers (e.g. `POST /api/changes/:id/approve` for critical changes
 * in a production tenant) supply the token in `X-Step-Up-Token`.
 *
 * **Dev seed only** — every session shares `JBSWY3DPEHPK3PXP` (the canonical
 * RFC 4226 / Google Authenticator test seed) so MSW + browser tests can mint a
 * deterministic TOTP. Production wiring against the corp IdP MFA backend
 * (Azure AD / Keycloak) is deferred to I.6 release dry-run per
 * `auth-flow.md §0` (stepUpTtl row).
 *
 * Audit events reuse the canonical `auth.step_up.*` names already documented
 * in `audit-and-compliance.md §2` as reserved-for-MVP — these are not new
 * taxonomy strings, they are the long-planned forward-compatible names being
 * wired now (per F.4 §events.ts header comment).
 */

const StepUpSchema = z.object({
  totp: z.string().regex(/^\d{6}$/, "TOTP must be a 6-digit numeric code"),
});

/** Canonical RFC 4226 base32 test seed. Dev-only. */
const DEV_TOTP_SECRET_BASE32 = "JBSWY3DPEHPK3PXP";
const TOTP_STEP_SEC = 30;
const TOTP_DIGITS = 6;

export interface StepUpRouteDeps {
  readonly config: RuntimeConfig;
  readonly sessionStore: SessionStore;
  readonly audit: AuditEmitter;
  readonly log: Logger;
  /** Override clock for tests. */
  readonly now?: () => number;
  /** Override secret seed per session — production-only hook. Dev defaults to
   *  the RFC 4226 test seed. */
  readonly secretForSession?: (sessionId: string) => string;
}

export function registerStepUpRoutes(app: Hono, deps: StepUpRouteDeps): void {
  const now = deps.now ?? Date.now;
  const secretLookup = deps.secretForSession ?? (() => DEV_TOTP_SECRET_BASE32);

  app.post("/auth/step-up", async (c) => {
    const correlationId = c.get("correlationId") as string;
    let session;
    try {
      session = await requireActiveSession(c, deps);
    } catch (err) {
      if (err instanceof AppErrorException) {
        return c.json(
          toAppErrorBody({
            code: err.code,
            message: err.message,
            httpStatus: err.httpStatus,
            correlationId,
          }),
          err.httpStatus as never,
        );
      }
      throw err;
    }

    let body: z.infer<typeof StepUpSchema>;
    try {
      body = StepUpSchema.parse(await c.req.json());
    } catch (err) {
      return c.json(
        toAppErrorBody({
          code: "VALIDATION",
          message: "Invalid step-up payload",
          httpStatus: 400,
          correlationId,
          details: err instanceof z.ZodError ? err.flatten().fieldErrors : undefined,
        }),
        400,
      );
    }

    const secret = secretLookup(session.sid);
    const nowMs = now();
    const valid = verifyTotpWithSkew(body.totp, secret, nowMs);

    if (!valid) {
      deps.audit(
        c,
        {
          category: "auth",
          event: AUDIT_EVENTS.auth.STEP_UP_DENIED,
          result: "denied",
          resultCode: 401,
          reason: "invalid_totp",
        },
        session,
      );
      return unauthorized(c, correlationId, "invalid_totp");
    }

    const mint = mintStepUpToken(session.sid, nowMs);
    deps.audit(
      c,
      {
        category: "auth",
        event: AUDIT_EVENTS.auth.STEP_UP_SUCCESS,
        result: "success",
        resultCode: 200,
        details: { ttlSec: Math.floor((mint.expiresAt - nowMs) / 1000) },
      },
      session,
    );
    return c.json(
      {
        stepUpToken: mint.token,
        expiresAt: new Date(mint.expiresAt).toISOString(),
      },
      200,
    );
  });
}

function unauthorized(c: Context, correlationId: string, reason: string) {
  return c.json(
    {
      error: "unauthorized" as const,
      reason,
      correlationId,
    },
    401,
  );
}

// ── TOTP (RFC 6238) — `node:crypto` only, no external deps. ─────────────────

function verifyTotpWithSkew(code: string, secretBase32: string, nowMs: number): boolean {
  const counter = Math.floor(nowMs / 1000 / TOTP_STEP_SEC);
  for (const offset of [-1, 0]) {
    if (computeTotp(secretBase32, counter + offset) === code) return true;
  }
  return false;
}

export function computeTotp(secretBase32: string, counter: number): string {
  const key = base32Decode(secretBase32);
  const buf = Buffer.alloc(8);
  // 64-bit big-endian counter — `writeBigUInt64BE` keeps full precision.
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(buf).digest();
  // Dynamic truncation per RFC 4226 §5.3.
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const bin =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  const otp = bin % 10 ** TOTP_DIGITS;
  return otp.toString().padStart(TOTP_DIGITS, "0");
}

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error(`step-up: invalid base32 char "${ch}"`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return Buffer.from(out);
}
