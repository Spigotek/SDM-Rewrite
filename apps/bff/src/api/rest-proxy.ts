import type { Context } from "hono";
import type { Logger } from "pino";
import { getCorrelationId } from "../auth/correlation";
import type { RuntimeConfig } from "../config/schema";
import type { AuditEmitter } from "../platform/audit";
import { requireActiveSession } from "../session/load";
import type { SessionPayload, SessionStore } from "../session/types";
import { classifySdmResponse } from "./error-shaper";
import type { SdmHttpClient } from "./http-client";
import { scopeReadQuery } from "./tenant-scoping";
import { parseSdmResponseBody } from "./xml-json";

/**
 * Orchestrate a single FE → BFF → CA SDM call.
 *
 * The proxy is concerned only with the *transport* layer:
 *  - resolve the session from the cookie (auth boundary),
 *  - inject `X-AccessKey` and the negotiated `Accept`/`Content-Type` headers,
 *  - apply tenant scoping to read paths (skipped for the single-tenant placeholder),
 *  - dispatch the request via the shared `SdmHttpClient`,
 *  - parse the response body (JSON or XML), and
 *  - map non-success statuses to `AppErrorException` via the error-shaper.
 *
 * Per-entity payload remap (FE shape ↔ CA SDM factory shape) lives in
 * `endpoints/<entity>.ts` — that's where attribute case (snake vs UPPERCASE),
 * FK encoding, soft-close strategy, and `@sdm/api-types` alignment belong.
 *
 * Pagination translation (`page` → `start`) lives in `paginationToCaSdm` below
 * because it's identical across every entity factory (§19).
 */

export interface RestProxyDeps {
  readonly client: SdmHttpClient;
  readonly sessionStore: SessionStore;
  readonly config: RuntimeConfig;
  readonly log: Logger;
  /** Optional audit hook — `_entity-routes.ts` calls it on mutating success. */
  readonly audit?: AuditEmitter;
}

export interface ProxyRequest {
  readonly method: "GET" | "POST" | "PUT" | "DELETE";
  /** CA SDM path beginning with `/`, e.g. `/in?size=5`. baseUrl already prefixed by SdmHttpClient. */
  readonly caSdmPath: string;
  /** Set on POST/PUT only. Caller is responsible for matching `contentType`. */
  readonly body?: string;
  /** `application/xml` or `application/json`. Defaults to JSON. Always sent (avoids §20 HTTP 415). */
  readonly contentType?: string;
  /** Field projection per §4 — comma-separated CA SDM attribute names. */
  readonly xObjAttrs?: string;
  /** Override the default 200/201/204 success set. */
  readonly successStatuses?: ReadonlyArray<number>;
  /**
   * When true (default), inject tenant scoping into the WC param. Reference
   * endpoints (`/pri`, `/crs`, …) and any path on a non-tenant-scoped factory
   * pass `false`.
   */
  readonly tenantScopeReadQuery?: boolean;
  /** Operation label for logging / error details. */
  readonly op: string;
}

export interface ProxyResult {
  readonly status: number;
  readonly body: unknown;
  readonly headers: Headers;
  readonly session: SessionPayload;
}

const DEFAULT_ACCEPT = "application/json";

export async function proxyToSdm(
  c: Context,
  deps: RestProxyDeps,
  req: ProxyRequest,
): Promise<ProxyResult> {
  const correlationId = getCorrelationId(c);
  const session = await requireActiveSession(c, deps);

  const path =
    req.tenantScopeReadQuery !== false && isReadLikePath(req)
      ? scopeReadQuery(req.caSdmPath, { activeTenantId: session.activeTenantId }, { log: deps.log })
      : req.caSdmPath;

  const headers: Record<string, string> = {
    "X-AccessKey": session.accessKey,
    Accept: DEFAULT_ACCEPT,
    "X-Correlation-ID": correlationId,
  };
  if (req.xObjAttrs) headers["X-Obj-Attrs"] = req.xObjAttrs;
  if (req.body !== undefined) {
    headers["Content-Type"] = req.contentType ?? "application/json";
  }

  const raw = await deps.client.request({
    method: req.method,
    path,
    headers,
    ...(req.body !== undefined ? { body: req.body } : {}),
  });

  const errToThrow = classifySdmResponse(
    { status: raw.status, text: raw.text, headers: raw.headers, op: req.op },
    req.successStatuses,
  );
  if (errToThrow) {
    deps.log.warn(
      {
        event: "rest_proxy.upstream_error",
        op: req.op,
        sdmStatus: raw.status,
        code: errToThrow.code,
        correlationId,
      },
      "CA SDM upstream returned error",
    );
    throw errToThrow;
  }

  const parsed = parseUpstreamBody(raw.text, raw.headers);
  return { status: raw.status, body: parsed, headers: raw.headers, session };
}

function parseUpstreamBody(text: string, headers: Headers): unknown {
  if (!text) return null;
  return parseSdmResponseBody(text, headers.get("content-type"));
}

function isReadLikePath(req: ProxyRequest): boolean {
  return req.method === "GET";
}

/**
 * Translate FE pagination (`page` 0-based, `size`) to CA SDM (`start` 1-based, `size`).
 * Per §19: `start = page * size + 1`. Defaults: page=0, size=25.
 */
export function paginationToCaSdm(searchParams: URLSearchParams): {
  start: number;
  size: number;
} {
  const page = Math.max(0, Number(searchParams.get("page") ?? "0") || 0);
  const rawSize = Number(searchParams.get("size") ?? "25") || 25;
  const size = Math.min(Math.max(1, Math.floor(rawSize)), 100);
  const start = page * size + 1;
  return { start, size };
}

/**
 * Pull the entity rows out of a `collection_<f>` response. Returns an array
 * regardless of whether the upstream collapsed a single-element list to an
 * object (§4) or omitted the entity key entirely on an empty page (§19.1).
 */
export function readCollection<T = unknown>(
  parsed: unknown,
  factoryKey: string,
): {
  rows: T[];
  total: number;
  start: number;
} {
  if (!parsed || typeof parsed !== "object") return { rows: [], total: 0, start: 0 };
  const collectionKey = `collection_${factoryKey}`;
  const collection = (parsed as Record<string, unknown>)[collectionKey];
  if (!collection || typeof collection !== "object") return { rows: [], total: 0, start: 0 };
  const c = collection as Record<string, unknown>;
  const entityRaw = c[factoryKey];
  const rows: T[] = Array.isArray(entityRaw)
    ? (entityRaw as T[])
    : entityRaw && typeof entityRaw === "object"
      ? [entityRaw as T]
      : [];
  return {
    rows,
    total: Number(c["@TOTAL_COUNT"] ?? 0) || 0,
    start: Number(c["@START"] ?? 0) || 0,
  };
}
