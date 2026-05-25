/**
 * Correlation ID generator — ULID (Crockford base32, 26 chars, lex-sortable).
 *
 * Per ADR-09 §Otvorené závislosti row 2: ULID is the canonical FE-side
 * correlation ID format. BFF accepts any incoming `X-Correlation-ID`
 * (`apps/bff/src/auth/correlation.ts`) and stamps a UUID v4 fallback when
 * none is provided — choosing ULID on the FE keeps tracing logs sortable
 * by emission time without sacrificing collision resistance.
 *
 * Format: `01HXXXXXXXXXXXXXXXXXXXXXXX` (10 chars timestamp + 16 chars random).
 */

import { ulid } from "ulid";

/** Generate a fresh ULID correlation ID for one HTTP request scope. */
export function createCorrelationId(): string {
  return ulid();
}

/**
 * Detect ULID-shape strings (26 Crockford base32 chars). Used in tests +
 * defensive checks; not a strict cryptographic validator (Crockford base32
 * excludes `I`, `L`, `O`, `U` but allows lowercase variants — `ulid()` only
 * emits uppercase).
 */
export function isUlid(value: string): boolean {
  return /^[0-9A-HJKMNP-TV-Z]{26}$/.test(value);
}
