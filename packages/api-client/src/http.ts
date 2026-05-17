import type { TenantId } from "@sdm/domain";
import { AppError, fromStatus } from "./errors";

export interface HttpClientOptions {
  readonly baseUrl: string;
  readonly tenantId?: TenantId;
  readonly fetchImpl?: typeof fetch;
  readonly correlationIdGenerator?: () => string;
  readonly defaultHeaders?: Readonly<Record<string, string>>;
}

export interface RequestOptions {
  readonly method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: unknown;
  readonly tenantOverride?: TenantId;
  readonly signal?: AbortSignal;
}

const CORRELATION_HEADER = "X-Correlation-ID";
const TENANT_HEADER = "X-CA-SDM-Tenant";

const defaultCorrelationId = (): string =>
  typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `cid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export class HttpClient {
  private readonly baseUrl: string;
  private readonly tenantId: TenantId | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly correlationIdGenerator: () => string;
  private readonly defaultHeaders: Readonly<Record<string, string>>;

  constructor(opts: HttpClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.tenantId = opts.tenantId;
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.correlationIdGenerator = opts.correlationIdGenerator ?? defaultCorrelationId;
    this.defaultHeaders = opts.defaultHeaders ?? {};
  }

  async request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const correlationId = this.correlationIdGenerator();
    const tenantId = opts.tenantOverride ?? this.tenantId;
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

    const headers: Record<string, string> = {
      Accept: "application/json",
      [CORRELATION_HEADER]: correlationId,
      ...this.defaultHeaders,
      ...(opts.headers ?? {}),
    };
    if (tenantId !== undefined) headers[TENANT_HEADER] = tenantId;
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

    if (response.status === 204) return undefined as T;

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return (await response.json()) as T;
    }
    return (await response.text()) as unknown as T;
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
export const TENANT_ID_HEADER = TENANT_HEADER;
