import type { Logger } from "pino";
import type { SdmBroker, SdmAccessKey } from "../../auth/sdm-broker";
import type { SdmHttpClient } from "../../api/http-client";

/**
 * `/readyz` probe — verifies the BFF can talk to CA SDM.
 *
 * Two-step probe per `bff.md §2.5`:
 *  1. Bootstrap (cached) — proves `/rest_access` accepts the service account
 *     creds. Reused for `refreshThresholdSec` to avoid one POST per probe.
 *  2. Read a tiny reference factory (`/pri?size=1`) — proves the access key
 *     works for downstream reads and the network path is healthy.
 *
 * Either step failing returns `{ ok: false, reason }` so ops gets a single
 * structured signal instead of "503 — unknown".
 */

export interface ReadinessDeps {
  readonly broker: SdmBroker;
  readonly client: SdmHttpClient;
  readonly log: Logger;
  /** Refresh the cached key when expiring within this many seconds. Default 5 min. */
  readonly refreshThresholdSec?: number;
  /** Probe timeout in ms. Default 2000. */
  readonly probeTimeoutMs?: number;
}

export interface ReadinessResult {
  readonly ok: boolean;
  readonly checks: {
    readonly bootstrap: "ok" | "fail";
    readonly sdmRead: "ok" | "fail";
  };
  readonly reason?: string;
  readonly probedAt: string;
}

const PRI_PATH = "/pri?size=1";

export function createReadinessProbe(deps: ReadinessDeps) {
  let cached: SdmAccessKey | null = null;
  const refreshSec = deps.refreshThresholdSec ?? 300;
  const probeTimeoutMs = deps.probeTimeoutMs ?? 2000;

  return async function probe(): Promise<ReadinessResult> {
    const now = new Date().toISOString();
    let key: SdmAccessKey;
    try {
      if (cached) {
        const { key: fresh } = await deps.broker.ensureFresh(cached, refreshSec);
        key = fresh;
      } else {
        key = await deps.broker.bootstrap();
      }
      cached = key;
    } catch (err) {
      deps.log.warn({ event: "readyz.bootstrap_failed", err }, "readyz: bootstrap failed");
      cached = null;
      return {
        ok: false,
        checks: { bootstrap: "fail", sdmRead: "fail" },
        reason: extractReason(err),
        probedAt: now,
      };
    }

    try {
      const res = await withTimeout(
        deps.client.request({
          method: "GET",
          path: PRI_PATH,
          headers: { "X-AccessKey": key.accessKey, Accept: "application/json" },
        }),
        probeTimeoutMs,
      );
      if (res.status !== 200) {
        deps.log.warn(
          { event: "readyz.sdm_read_unexpected_status", status: res.status },
          "readyz: SDM read failed",
        );
        return {
          ok: false,
          checks: { bootstrap: "ok", sdmRead: "fail" },
          reason: `sdm /pri returned HTTP ${res.status}`,
          probedAt: now,
        };
      }
    } catch (err) {
      deps.log.warn({ event: "readyz.sdm_read_threw", err }, "readyz: SDM read threw");
      return {
        ok: false,
        checks: { bootstrap: "ok", sdmRead: "fail" },
        reason: extractReason(err),
        probedAt: now,
      };
    }

    return {
      ok: true,
      checks: { bootstrap: "ok", sdmRead: "ok" },
      probedAt: now,
    };
  };
}

function extractReason(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolveProm, rejectProm) => {
    const timer = setTimeout(
      () => rejectProm(new Error(`readyz probe timed out after ${ms}ms`)),
      ms,
    );
    p.then(
      (v) => {
        clearTimeout(timer);
        resolveProm(v);
      },
      (e) => {
        clearTimeout(timer);
        rejectProm(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}
