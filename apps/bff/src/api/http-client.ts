import type { Logger } from "pino";
import { AppErrorException, type AppErrorCode } from "../auth/errors";

/**
 * Generic CA SDM 17.4 REST client — network primitives only.
 *
 * Encapsulates the parts of an upstream call that are identical between
 * the auth bootstrap flow (`sdm-broker.ts`) and the entity proxy (`rest-proxy.ts`):
 * URL composition, abort-on-timeout, retryable-error classification, and
 * the raw `(status, text, headers)` return shape.
 *
 * Status-classification (200 vs 400/401/etc → AppErrorException) is the caller's
 * concern and lives in `error-shaper.ts` so the broker and proxy can apply
 * different policies (bootstrap-401 vs read-401 mean different AppError codes).
 */

export interface SdmHttpClientConfig {
  readonly baseUrl: string;
  readonly requestTimeoutMs: number;
  readonly maxRetries: number;
}

export interface SdmHttpClientDeps {
  readonly fetch: typeof globalThis.fetch;
  readonly log: Logger;
}

export interface RawSdmRequest {
  readonly method: string;
  readonly path: string;
  readonly headers: Record<string, string>;
  readonly body?: string;
}

export interface RawSdmResponse {
  readonly status: number;
  readonly text: string;
  readonly headers: Headers;
}

const RETRYABLE_FETCH_ERRORS = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ENETUNREACH",
]);

export class SdmHttpClient {
  private readonly cfg: SdmHttpClientConfig;
  private readonly deps: SdmHttpClientDeps;

  constructor(cfg: SdmHttpClientConfig, deps: SdmHttpClientDeps) {
    this.cfg = cfg;
    this.deps = deps;
  }

  async request(req: RawSdmRequest): Promise<RawSdmResponse> {
    const url = `${this.cfg.baseUrl}${req.path}`;
    let attempt = 0;
    let lastErr: unknown;
    while (attempt <= this.cfg.maxRetries) {
      attempt += 1;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.cfg.requestTimeoutMs);
      try {
        const init: RequestInit = {
          method: req.method,
          headers: req.headers,
          signal: controller.signal,
        };
        if (req.body !== undefined) init.body = req.body;
        const res = await this.deps.fetch(url, init);
        const text = await res.text();
        return { status: res.status, text, headers: res.headers };
      } catch (err) {
        lastErr = err;
        if (!isRetryableFetchError(err) || attempt > this.cfg.maxRetries) break;
        const backoffMs = 100 * 2 ** (attempt - 1);
        await sleep(backoffMs);
      } finally {
        clearTimeout(timer);
      }
    }
    throw new AppErrorException({
      code: classifyNetworkError(lastErr),
      httpStatus: 502,
      message: `CA SDM request failed: ${stringifyErr(lastErr)}`,
      details: { url, method: req.method },
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableFetchError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  if (typeof code === "string" && RETRYABLE_FETCH_ERRORS.has(code)) return true;
  const name = (err as { name?: unknown }).name;
  return name === "AbortError" || name === "TypeError";
}

function classifyNetworkError(err: unknown): AppErrorCode {
  if (!err || typeof err !== "object") return "NETWORK";
  const name = (err as { name?: unknown }).name;
  return name === "AbortError" ? "BACKEND_UNAVAILABLE" : "NETWORK";
}

function stringifyErr(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
