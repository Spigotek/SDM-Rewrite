import type { Context, Hono } from "hono";
import type { Logger } from "pino";
import type { UiQueueItem, UiQueuePage, UiTicketType } from "@sdm/api-types";
import { TtlCache } from "../api/cache";
import {
  paginationToCaSdm,
  proxyToSdm,
  readCollection,
  type RestProxyDeps,
} from "../api/rest-proxy";
import { requireActiveSession } from "../session/load";
import { priorityWeight, rawToUiQueueItem } from "./shapers/ui-queue-item";

/**
 * GET /api/queue — paralelný fan-out cez `in`/`cr`/`pr` (incident/request/
 * problem). Merge + sort (priority desc, openedAt desc), local pagination.
 *
 * **Cache** — TTL 30 s; cache key encodes `(tenantId, userId, filter)` so
 * concurrent sessions of two tenants nešarí cache, a user-level isolácia
 * predchádza role-change race kondíciam. Aktívna invalidácia (tenant switch
 * event hookup) ide do F.4 audit event bus — pre MVP 30 s TTL stačí
 * (worst-case stale view = 30 s post-switch).
 *
 * **Pagination** — CA SDM nemá cross-factory query, takže page rozsah sa
 * resolvuje lokálne. Per-factory pulluje fixný buffer `FANOUT_BUFFER`
 * a aggregator robí merge + sort + slice na FE `(page, size)`. Pri
 * `total > FANOUT_BUFFER` na ktoromkoľvek faktorinu vraciame `hasMore: true`;
 * skutočná paginácia cross-factory je post-MVP (vyžaduje balancovaný puling).
 */

const QUEUE_TTL_SEC = 30;
const FANOUT_BUFFER = 100;
const FACTORIES: ReadonlyArray<{ factory: string; ticketType: UiTicketType; attrs: string }> = [
  {
    factory: "in",
    ticketType: "incident",
    attrs:
      "ref_num,summary,status,priority,impact,urgency,customer,assignee,open_date,close_date,active,category",
  },
  {
    factory: "cr",
    ticketType: "request",
    attrs:
      "ref_num,summary,status,priority,impact,urgency,customer,assignee,type,open_date,close_date,active,category",
  },
  {
    factory: "pr",
    ticketType: "problem",
    attrs:
      "ref_num,summary,status,priority,impact,urgency,customer,assignee,open_date,close_date,active",
  },
];

export type QueueDeps = RestProxyDeps;

export interface QueueState {
  readonly cache: TtlCache<QueueCacheEntry>;
}

interface QueueCacheEntry {
  readonly items: ReadonlyArray<UiQueueItem>;
  readonly hasMore: boolean;
}

export function createQueueState(): QueueState {
  return { cache: new TtlCache({ maxEntries: 64 }) };
}

export function registerQueueRoutes(
  app: Hono,
  deps: QueueDeps,
  state: QueueState = createQueueState(),
  log?: Logger,
): void {
  const localLog = log ?? deps.log;
  app.get("/api/queue", async (c) => {
    const url = new URL(c.req.url);
    const { start, size } = paginationToCaSdm(url.searchParams);
    const filter = url.searchParams.get("filter") ?? "";

    const session = await requireActiveSession(c, deps);
    const cacheKey = `${session.activeTenantId}::${session.userId}::${filter}`;

    let entry = state.cache.get(cacheKey);
    if (!entry) {
      entry = await fanOut(c, deps, filter, localLog);
      state.cache.set(cacheKey, entry, QUEUE_TTL_SEC);
      localLog.info(
        { event: "aggregator.queue.miss", cacheKey, fetched: entry.items.length },
        "queue cache miss",
      );
    } else {
      localLog.info({ event: "aggregator.queue.hit", cacheKey }, "queue cache hit");
    }

    const sliced = entry.items.slice(start - 1, start - 1 + size);
    const body: UiQueuePage = {
      data: sliced,
      page: {
        total: entry.items.length,
        start,
        size: sliced.length,
      },
      hasMore: entry.hasMore,
    };
    return c.json(body, 200);
  });
}

async function fanOut(
  c: Context,
  deps: QueueDeps,
  filter: string,
  log: Logger,
): Promise<QueueCacheEntry> {
  const results = await Promise.all(
    FACTORIES.map(async ({ factory, ticketType, attrs }) => {
      const search = new URLSearchParams();
      if (filter) search.set("WC", filter);
      search.set("start", "1");
      search.set("size", String(FANOUT_BUFFER));
      try {
        const result = await proxyToSdm(c, deps, {
          method: "GET",
          caSdmPath: `/${factory}?${search.toString()}`,
          xObjAttrs: attrs,
          op: `queue.fanout.${factory}`,
        });
        const { rows, total } = readCollection<Record<string, unknown>>(result.body, factory);
        const items = rows.map((raw) => rawToUiQueueItem(raw, ticketType));
        return { items, exceeded: total > rows.length };
      } catch (err) {
        log.warn(
          { event: "aggregator.queue.factory_failed", factory, err },
          "queue fan-out partial",
        );
        return { items: [] as UiQueueItem[], exceeded: false };
      }
    }),
  );

  const merged = results.flatMap((r) => r.items);
  const hasMore = results.some((r) => r.exceeded);
  merged.sort(compareQueueItems);
  return { items: merged, hasMore };
}

function compareQueueItems(a: UiQueueItem, b: UiQueueItem): number {
  const dp = priorityWeight(b) - priorityWeight(a);
  if (dp !== 0) return dp;
  const ta = a.lastActivityAt ? Date.parse(a.lastActivityAt) : 0;
  const tb = b.lastActivityAt ? Date.parse(b.lastActivityAt) : 0;
  return tb - ta;
}
