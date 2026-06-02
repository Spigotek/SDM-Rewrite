import { randomBytes } from "node:crypto";

/**
 * I.1 step-up token store — in-memory, single-instance.
 *
 * The token is minted on successful TOTP verification and consumed by the
 * caller (`POST /api/changes/:id/approve`) on the immediately-following
 * mutation. Single-use per OWASP step-up best practice — a replay returns
 * `false` even within the 15-min TTL.
 *
 * Multi-instance deployments will need Redis (same constraint as F.1
 * session-store). Out-of-MVP per `multi-tenancy-security.md §6`.
 */

const TTL_MS = 15 * 60_000;

interface TokenEntry {
  readonly sessionId: string;
  readonly expiresAt: number;
}

const tokens = new Map<string, TokenEntry>();

export interface StepUpMint {
  readonly token: string;
  readonly expiresAt: number;
}

export function mintStepUpToken(sessionId: string, nowMs: number = Date.now()): StepUpMint {
  const token = randomBytes(32).toString("hex");
  const expiresAt = nowMs + TTL_MS;
  tokens.set(token, { sessionId, expiresAt });
  return { token, expiresAt };
}

/**
 * Consume + validate. Returns `true` only on first call with a still-valid
 * `token` bound to the same `sessionId`. Any subsequent call (replay) or
 * expired/missing token returns `false`. We sweep expired entries lazily
 * on each call — no setInterval, store stays stateless across restarts.
 */
export function consumeStepUpToken(
  token: string,
  sessionId: string,
  nowMs: number = Date.now(),
): boolean {
  sweepExpired(nowMs);
  const entry = tokens.get(token);
  if (!entry) return false;
  if (entry.sessionId !== sessionId) return false;
  if (entry.expiresAt < nowMs) {
    tokens.delete(token);
    return false;
  }
  tokens.delete(token);
  return true;
}

function sweepExpired(nowMs: number): void {
  for (const [token, entry] of tokens) {
    if (entry.expiresAt < nowMs) tokens.delete(token);
  }
}

/**
 * Reset helper for tests — clears the store. Not exported from `auth/index.ts`
 * so production callers can't accidentally invalidate live step-up tokens.
 */
export function _resetStepUpTokensForTests(): void {
  tokens.clear();
}
