import { XMLParser } from "fast-xml-parser";
import type { Logger } from "pino";
import { AppErrorException, type AppErrorCode } from "./errors";

/**
 * CA SDM 17.4 REST broker.
 *
 * Contract evidence: docs/agents/devex-devops/real-backend-contracts.md
 *
 * Highlights that drive non-obvious code below:
 *  - Bootstrap is XML-in / XML-out only (JSON Content-Type → 400).
 *  - Reads accept JSON; field projection requires the X-Obj-Attrs header (not ?attributes=).
 *  - AUTH_EXPIRED surfaces as HTTP 400 with `<error><message>Invalid REST Access Key…`,
 *    NOT 401. A naïve 401-only branch will miss it.
 *  - `expiration_date` is epoch seconds (not ms, not ISO).
 *  - `cnt.id` is a hex-GUID string `U'…'` with embedded single quotes; URL-encode `%27`.
 *  - `role.sym` is the `COMMON_NAME` attribute, not a `<sym>` child element.
 */

export interface SdmBrokerConfig {
  readonly baseUrl: string; // e.g. http://10.11.35.35:8050/caisd-rest
  readonly basicAuthUser: string;
  readonly basicAuthPass: string;
  readonly requestTimeoutMs: number;
  readonly maxRetries: number; // network-only retries
}

export interface SdmAccessKey {
  readonly accessKey: string;
  readonly accessKeyId: string;
  readonly expiresAtMs: number; // unix ms (we convert from epoch seconds)
}

export interface SdmContact {
  readonly id: string; // raw "U'…'" string
  readonly userid: string;
  readonly displayName: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly accessTypeId: string;
  readonly accessTypeName: string; // e.g. "Administration", "Employee"
}

export interface SdmContactRole {
  readonly id: string;
  readonly roleSym: string | null; // best-effort; may be null when @COMMON_NAME absent on cnt_role
}

export interface SdmBrokerDeps {
  readonly fetch: typeof globalThis.fetch;
  readonly log: Logger;
  readonly now: () => number; // unix ms
}

const XML_PARSER = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  processEntities: false,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
});

const RETRYABLE_FETCH_ERRORS = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ENETUNREACH",
]);

export class SdmBroker {
  private readonly cfg: SdmBrokerConfig;
  private readonly deps: SdmBrokerDeps;
  private readonly basicAuthHeader: string;

  constructor(cfg: SdmBrokerConfig, deps: SdmBrokerDeps) {
    this.cfg = cfg;
    this.deps = deps;
    const b64 = Buffer.from(`${cfg.basicAuthUser}:${cfg.basicAuthPass}`, "utf8").toString("base64");
    this.basicAuthHeader = `Basic ${b64}`;
  }

  /**
   * POST /rest_access — bootstrap an X-AccessKey via Basic Auth.
   * Per real B-E: XML in/out only. JSON body → HTTP 400. Empty body → HTTP 400.
   */
  async bootstrap(overrideCreds?: { user: string; pass: string }): Promise<SdmAccessKey> {
    const authHeader = overrideCreds
      ? `Basic ${Buffer.from(`${overrideCreds.user}:${overrideCreds.pass}`, "utf8").toString("base64")}`
      : this.basicAuthHeader;

    const res = await this.requestRaw({
      method: "POST",
      path: "/rest_access",
      headers: {
        Authorization: authHeader,
        Accept: "application/xml",
        "Content-Type": "application/xml",
      },
      body: "<rest_access/>",
    });

    if (res.status === 401) {
      throw new AppErrorException({
        code: "AUTH_INVALID_CREDENTIALS",
        httpStatus: 401,
        message: "Invalid username or password",
        details: { sdmStatus: res.status, sdmBody: res.text.slice(0, 200) },
      });
    }
    if (res.status >= 500) {
      throw new AppErrorException({
        code: "BACKEND_UNAVAILABLE",
        httpStatus: 503,
        message: `CA SDM bootstrap failed (HTTP ${res.status})`,
      });
    }
    if (res.status !== 201) {
      throw new AppErrorException({
        code: "UNKNOWN",
        httpStatus: 502,
        message: `Unexpected CA SDM bootstrap response (HTTP ${res.status})`,
        details: { sdmBody: res.text.slice(0, 200) },
      });
    }

    type ParsedBootstrap = {
      rest_access?: {
        "@id"?: string;
        access_key?: string;
        expiration_date?: string;
      };
    };
    const parsed = XML_PARSER.parse(res.text) as ParsedBootstrap;
    const block = parsed.rest_access;
    if (!block?.access_key || !block["@id"] || !block.expiration_date) {
      throw new AppErrorException({
        code: "UNKNOWN",
        httpStatus: 502,
        message: "Malformed CA SDM bootstrap response (missing access_key/id/expiration)",
        details: { sdmBody: res.text.slice(0, 200) },
      });
    }
    const expirationSec = Number(block.expiration_date);
    if (!Number.isFinite(expirationSec)) {
      throw new AppErrorException({
        code: "UNKNOWN",
        httpStatus: 502,
        message: "Malformed CA SDM bootstrap response (non-numeric expiration_date)",
      });
    }
    return {
      accessKey: block.access_key,
      accessKeyId: block["@id"],
      expiresAtMs: expirationSec * 1000,
    };
  }

  /**
   * DELETE /rest_access/<id> — best-effort logout. Network/4xx failures are
   * logged but never thrown; callers (logout flow) must still clear local state.
   */
  async revoke(accessKey: string, accessKeyId: string, correlationId?: string): Promise<void> {
    try {
      const res = await this.requestRaw({
        method: "DELETE",
        path: `/rest_access/${encodeURIComponent(accessKeyId)}`,
        headers: {
          "X-AccessKey": accessKey,
          Accept: "application/xml",
        },
      });
      if (res.status !== 204 && res.status !== 200) {
        this.deps.log.warn(
          { event: "sdm.revoke.unexpected_status", status: res.status, correlationId },
          "CA SDM revoke returned unexpected status",
        );
      }
    } catch (err) {
      this.deps.log.warn(
        { event: "sdm.revoke.network_error", err, correlationId },
        "CA SDM revoke failed (ignored — local session still cleared)",
      );
    }
  }

  /**
   * GET /cnt?WC=userid='<userid>' — look up the canonical contact record.
   * Uses JSON Accept + X-Obj-Attrs header.
   */
  async lookupContact(accessKey: string, userid: string): Promise<SdmContact> {
    const wc = `userid=${encodeSdmString(userid)}`;
    const path = `/cnt?WC=${encodeURIComponent(wc)}`;
    const res = await this.requestRaw({
      method: "GET",
      path,
      headers: {
        "X-AccessKey": accessKey,
        Accept: "application/json",
        "X-Obj-Attrs": "userid,email_address,last_name,first_name,access_type",
      },
    });
    this.assertReadOk(res, "lookupContact");

    type ParsedCnt = {
      collection_cnt?: {
        "@COUNT"?: string | number;
        cnt?: RawCnt | RawCnt[];
      };
    };
    const parsed = JSON.parse(res.text) as ParsedCnt;
    const collection = parsed.collection_cnt;
    if (!collection) {
      throw new AppErrorException({
        code: "UNKNOWN",
        httpStatus: 502,
        message: "CA SDM /cnt response missing collection_cnt",
      });
    }
    const list: RawCnt[] = Array.isArray(collection.cnt)
      ? collection.cnt
      : collection.cnt
        ? [collection.cnt]
        : [];
    const raw = list[0];
    if (!raw) {
      throw new AppErrorException({
        code: "NOT_FOUND",
        httpStatus: 404,
        message: `Contact not found for userid=${userid}`,
      });
    }
    return toSdmContact(raw);
  }

  /**
   * GET /cnt_role?WC=contact=U'<id>' — best-effort list of CA roles for a contact.
   * Per real-backend-contracts.md §5, the `role` FK is NOT returned in body on
   * this instance even with X-Obj-Attrs; callers must accept that `roleSym`
   * may be null and fall back to access_type-based UIRole resolution.
   */
  async listContactRoles(accessKey: string, contactRawId: string): Promise<SdmContactRole[]> {
    const wc = `contact=${contactRawId}`; // already U'...' with embedded quotes
    const path = `/cnt_role?WC=${encodeURIComponent(wc)}`;
    const res = await this.requestRaw({
      method: "GET",
      path,
      headers: {
        "X-AccessKey": accessKey,
        Accept: "application/json",
        "X-Obj-Attrs": "role,contact",
      },
    });
    this.assertReadOk(res, "listContactRoles");

    type ParsedCntRole = {
      collection_cnt_role?: {
        "@COUNT"?: string | number;
        cnt_role?: RawCntRole | RawCntRole[];
      };
    };
    const parsed = JSON.parse(res.text) as ParsedCntRole;
    const collection = parsed.collection_cnt_role;
    if (!collection) return [];
    const list: RawCntRole[] = Array.isArray(collection.cnt_role)
      ? collection.cnt_role
      : collection.cnt_role
        ? [collection.cnt_role]
        : [];
    return list.map((r) => ({
      id: String(r["@id"] ?? ""),
      roleSym: typeof r.role?.["@COMMON_NAME"] === "string" ? r.role["@COMMON_NAME"] : null,
    }));
  }

  /**
   * Ensure an access key has at least `refreshThresholdSec` seconds of validity
   * remaining; if not, re-bootstrap. Returns the up-to-date key.
   */
  async ensureFresh(
    current: SdmAccessKey,
    refreshThresholdSec: number,
  ): Promise<{ key: SdmAccessKey; rotated: boolean }> {
    const nowMs = this.deps.now();
    if (current.expiresAtMs - nowMs > refreshThresholdSec * 1000) {
      return { key: current, rotated: false };
    }
    const fresh = await this.bootstrap();
    await this.revoke(current.accessKey, current.accessKeyId);
    return { key: fresh, rotated: true };
  }

  // ---------------------------------------------------------------------------

  private assertReadOk(res: RawResponse, op: string): void {
    if (res.status === 200) return;
    if (res.status === 400 && /Invalid REST Access Key/i.test(res.text)) {
      throw new AppErrorException({
        code: "AUTH_EXPIRED",
        httpStatus: 401,
        message: "CA SDM access key expired or invalid",
        details: { op, sdmStatus: res.status },
      });
    }
    if (res.status === 401) {
      throw new AppErrorException({
        code: "AUTH_FORBIDDEN",
        httpStatus: 403,
        message: "CA SDM denied the request",
        details: { op, sdmStatus: res.status, sdmBody: res.text.slice(0, 200) },
      });
    }
    if (res.status === 404) {
      throw new AppErrorException({
        code: "NOT_FOUND",
        httpStatus: 404,
        message: `CA SDM ${op}: not found`,
      });
    }
    if (res.status >= 500) {
      throw new AppErrorException({
        code: "BACKEND_UNAVAILABLE",
        httpStatus: 503,
        message: `CA SDM ${op} failed (HTTP ${res.status})`,
      });
    }
    throw new AppErrorException({
      code: "UNKNOWN",
      httpStatus: 502,
      message: `CA SDM ${op} unexpected status ${res.status}`,
      details: { sdmBody: res.text.slice(0, 200) },
    });
  }

  private async requestRaw(req: {
    method: string;
    path: string;
    headers: Record<string, string>;
    body?: string;
  }): Promise<RawResponse> {
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

interface RawResponse {
  status: number;
  text: string;
  headers: Headers;
}

interface RawCnt {
  "@id"?: string;
  "@COMMON_NAME"?: string;
  userid?: string;
  email_address?: string;
  first_name?: string;
  last_name?: string;
  access_type?: { "@id"?: string; "@COMMON_NAME"?: string };
}

interface RawCntRole {
  "@id"?: string | number;
  role?: { "@id"?: string | number; "@COMMON_NAME"?: string };
}

function toSdmContact(raw: RawCnt): SdmContact {
  if (!raw["@id"]) {
    throw new AppErrorException({
      code: "UNKNOWN",
      httpStatus: 502,
      message: "CA SDM /cnt entry missing @id",
    });
  }
  return {
    id: raw["@id"],
    userid: raw.userid ?? "",
    displayName: (raw["@COMMON_NAME"] ?? "").trim(),
    email: raw.email_address ?? "",
    firstName: raw.first_name ?? "",
    lastName: raw.last_name ?? "",
    accessTypeId: raw.access_type?.["@id"] ?? "",
    accessTypeName: raw.access_type?.["@COMMON_NAME"] ?? "",
  };
}

/** Encode a string for use inside a CA SDM WC clause: wrap in single quotes, URL-encode them. */
function encodeSdmString(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
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
