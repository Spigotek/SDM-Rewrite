import { createCorrelationId } from "./correlation";
import { AppError, fromStatus } from "./errors";

export interface HttpClientOptions {
  readonly baseUrl: string;
  readonly fetchImpl?: typeof fetch;
  readonly correlationIdGenerator?: () => string;
  readonly defaultHeaders?: Readonly<Record<string, string>>;
  /**
   * I.3 — Session-tenant resolver for the `X-Response-Tenant` race detector.
   * Returns the SPA's current `activeTenantId`, or `null` if anonymous /
   * unknown. The detector compares this against the BFF-emitted
   * `X-Response-Tenant` header on every response; a mismatch means a tenant
   * switch landed between request issue and response return.
   *
   * Implementation note: the resolver is a *function*, not a static value, so
   * the HttpClient picks up tenant switches without re-construction. The
   * SessionProvider wires it to read from its React state. When omitted, the
   * detector is disabled (no-op) — useful for unit tests + pre-session calls
   * (login + /me bootstrap, where there is no "active tenant" yet).
   */
  readonly activeTenantResolver?: () => string | null;
  /**
   * I.3 — Optional telemetry sink for tenant-race events. Called with the
   * race breadcrumb shape so the SPA can forward it to Sentry. Side-effect
   * only; the HttpClient never depends on the return value.
   */
  readonly onTenantRace?: (event: TenantRaceEvent) => void;
}

export interface RequestOptions {
  readonly method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: unknown;
  readonly signal?: AbortSignal;
}

/**
 * I.3 — Telemetry payload emitted on every `X-Response-Tenant` mismatch.
 * Shape is stable so a downstream Sentry breadcrumb / log aggregator can key
 * dashboards off `kind: "tenant_race"`.
 */
export interface TenantRaceEvent {
  readonly kind: "tenant_race";
  readonly path: string;
  readonly sessionTenant: string;
  readonly responseTenant: string;
  readonly attempt: 1 | 2;
}

const CORRELATION_HEADER = "X-Correlation-ID";
const RESPONSE_TENANT_HEADER = "X-Response-Tenant";

// ULID (Crockford base32, 26 chars) per ADR-09 §Otvorené závislosti r2 — lex-
// sortable so log triage can group requests by emission time without an
// external join. BFF echoes any incoming header back (`auth/correlation.ts`).
//
// H.1: `X-CA-SDM-Tenant` was removed — the BFF resolves the active tenant from
// the server-side session (`session.activeTenantId`); the client must NOT
// inject a tenant header. The previous implementation kept it for legacy MSW
// fixtures during F.1–F.5 but H.1 finalises the server-authoritative model.
const defaultCorrelationId = (): string => createCorrelationId();

export class HttpClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly correlationIdGenerator: () => string;
  private readonly defaultHeaders: Readonly<Record<string, string>>;
  private readonly activeTenantResolver: (() => string | null) | undefined;
  private readonly onTenantRace: ((event: TenantRaceEvent) => void) | undefined;

  constructor(opts: HttpClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.correlationIdGenerator = opts.correlationIdGenerator ?? defaultCorrelationId;
    this.defaultHeaders = opts.defaultHeaders ?? {};
    this.activeTenantResolver = opts.activeTenantResolver;
    this.onTenantRace = opts.onTenantRace;
  }

  async request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    // I.3 — Tenant-race detection (`X-Response-Tenant` vs session). The
    // retry-once policy keeps the impl simple: a first mismatch is almost
    // always a tab-switch race that resolves itself on the next attempt; a
    // second mismatch means something is genuinely wrong (stale BFF cache,
    // proxy misroute, etc) and we throw `TENANT_RACE` so the caller can
    // surface a toast + force a /me refetch.
    const firstAttempt = await this.fetchOnce<T>(path, opts);
    if (!firstAttempt.tenantRace) return firstAttempt.value as T;

    // Telemetry + immediate retry (one shot — never loop).
    this.onTenantRace?.({
      kind: "tenant_race",
      path,
      sessionTenant: firstAttempt.tenantRace.sessionTenant,
      responseTenant: firstAttempt.tenantRace.responseTenant,
      attempt: 1,
    });
    const secondAttempt = await this.fetchOnce<T>(path, opts);
    if (!secondAttempt.tenantRace) return secondAttempt.value as T;

    this.onTenantRace?.({
      kind: "tenant_race",
      path,
      sessionTenant: secondAttempt.tenantRace.sessionTenant,
      responseTenant: secondAttempt.tenantRace.responseTenant,
      attempt: 2,
    });
    throw new AppError({
      kind: "TENANT_RACE",
      message: "Response tenant did not match active session tenant after retry",
      details: {
        sessionTenant: secondAttempt.tenantRace.sessionTenant,
        responseTenant: secondAttempt.tenantRace.responseTenant,
      },
    });
  }

  /**
   * Single round-trip. Returns either the parsed payload or a `tenantRace`
   * marker so the caller can decide whether to retry. The shape is private —
   * external callers always go through `request()`.
   */
  private async fetchOnce<T>(
    path: string,
    opts: RequestOptions,
  ): Promise<{ value?: T; tenantRace?: { sessionTenant: string; responseTenant: string } }> {
    const correlationId = this.correlationIdGenerator();
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

    const headers: Record<string, string> = {
      Accept: "application/json",
      [CORRELATION_HEADER]: correlationId,
      ...this.defaultHeaders,
      ...(opts.headers ?? {}),
    };
    if (opts.body !== undefined && !("Content-Type" in headers)) {
      headers["Content-Type"] = "application/json";
    }

    let response: Response;
    try {
      const init: RequestInit = {
        method: opts.method ?? "GET",
        headers,
        credentials: "include",
      };
      if (opts.body !== undefined) init.body = JSON.stringify(opts.body);
      if (opts.signal !== undefined) init.signal = opts.signal;
      response = await this.fetchImpl(url, init);
    } catch (err) {
      throw new AppError({
        kind: "NETWORK",
        message: err instanceof Error ? err.message : "network error",
        correlationId,
      });
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw fromStatus(response.status, text || response.statusText, correlationId);
    }

    // Tenant-race check — runs only when the SessionProvider has wired a
    // resolver AND the BFF stamped the response (legacy / pre-session
    // bootstrap responses pass through unchecked).
    const sessionTenant = this.activeTenantResolver?.() ?? null;
    const responseTenant = response.headers.get(RESPONSE_TENANT_HEADER);
    if (sessionTenant !== null && responseTenant !== null && sessionTenant !== responseTenant) {
      return { tenantRace: { sessionTenant, responseTenant } };
    }

    if (response.status === 204) return { value: undefined as T };

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return { value: (await response.json()) as T };
    }
    return { value: (await response.text()) as unknown as T };
  }

  get<T>(path: string, opts?: Omit<RequestOptions, "method" | "body">): Promise<T> {
    return this.request<T>(path, { ...opts, method: "GET" });
  }
  post<T>(
    path: string,
    body?: unknown,
    opts?: Omit<RequestOptions, "method" | "body">,
  ): Promise<T> {
    return this.request<T>(path, { ...opts, method: "POST", body });
  }
  put<T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">): Promise<T> {
    return this.request<T>(path, { ...opts, method: "PUT", body });
  }
  patch<T>(
    path: string,
    body?: unknown,
    opts?: Omit<RequestOptions, "method" | "body">,
  ): Promise<T> {
    return this.request<T>(path, { ...opts, method: "PATCH", body });
  }
  delete<T>(path: string, opts?: Omit<RequestOptions, "method" | "body">): Promise<T> {
    return this.request<T>(path, { ...opts, method: "DELETE" });
  }
}

export const CORRELATION_ID_HEADER = CORRELATION_HEADER;
export const RESPONSE_TENANT_HEADER_NAME = RESPONSE_TENANT_HEADER;
