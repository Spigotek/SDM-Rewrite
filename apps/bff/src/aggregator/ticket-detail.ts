import type { Hono } from "hono";
import type { Logger } from "pino";
import type {
  UiActivityEntry,
  UiAttachmentMeta,
  UiTicketDetail,
  UiTicketDetailActivity,
  UiTicketDetailAttachments,
  UiTicketType,
} from "@sdm/api-types";
import { TtlCache } from "../api/cache";
import { proxyToSdm, readCollection, type RestProxyDeps } from "../api/rest-proxy";
import { encodePkPathSegment } from "../api/endpoints/_shape";
import {
  ACTIVITY_LOG_ATTRS,
  mapActivityRow,
  type ActivityFactoryKey,
} from "../api/endpoints/activity-log";
import {
  ATTACHMENT_ROW_ATTRS,
  LREL_ATTACHMENT_FACTORY,
  extractAttachmentIds,
  mapAttmntRow,
} from "../api/endpoints/attachments";
import { AppErrorException } from "../auth/errors";
import { requireActiveSession } from "../session/load";
import { rawToUiTicketDetail } from "./shapers/ui-ticket-detail";

/**
 * GET /api/tickets/:type/:id — ticket-detail aggregator.
 *
 * Fan-out shape (per F.6, real-backend-contracts.md §22-§24):
 *  1. Parent fetch — `/{factory}/{id}` with the entity attrs projection.
 *  2. After parent OK, `Promise.allSettled` on three branches:
 *     - Activity log via `/{factory}/{id}/act_log` (alg / chgalg).
 *     - Attachments via `/{factory}/{id}/attachments` (lrel join) + per-row
 *       enrichment from `/attmnt/{aid}`.
 *     - Linked tickets — currently `_unsupported: true`; no BREL relation works
 *       on this CA SDM instance (§24).
 *  3. Branch failure does NOT fail the whole request — the failed block ships
 *     with `_unsupported: true` so the FE shows empty state instead of an HTTP
 *     error. The parent fetch IS load-bearing — its failure surfaces normally.
 *
 * The detail cache (parent-only TTL=60 s) is unchanged from F.3. The branch
 * results carry inside `UiTicketDetail`, so a cache hit returns everything in
 * one shot. F.5 invalidation via mutation interceptors covers all branches
 * because the detail object is keyed at the top level.
 *
 * `:type` ∈ {incident, request, problem, change} maps to CA SDM factories
 * `in`/`cr`/`pr`/`chg`. `chg` schema diverges (§15) — handled inside
 * `rawToUiTicketDetail`.
 *
 * Audit: read events are NOT emitted per `audit-and-compliance.md §3` (reads
 * are 0% sampled; reverse-proxy access log is the compliance source of record).
 */

const DETAIL_TTL_SEC = 60;
const ACTIVITY_PAGE_SIZE = 100;
const ATTACHMENT_PAGE_SIZE = 50;
/** Max parallel `/attmnt/{id}` enrichment fetches per request. */
const ATTACHMENT_ENRICH_CONCURRENCY = 8;

const TICKET_FACTORIES: Record<
  UiTicketType,
  {
    factory: keyof typeof LREL_ATTACHMENT_FACTORY;
    attrs: string;
    activityFactoryKey: ActivityFactoryKey;
  }
> = {
  incident: {
    factory: "in",
    attrs:
      "ref_num,summary,description,status,priority,impact,urgency,customer,assignee,open_date,close_date,active,category",
    activityFactoryKey: "alg",
  },
  request: {
    factory: "cr",
    attrs:
      "ref_num,summary,description,status,priority,impact,urgency,customer,assignee,type,open_date,close_date,active,category",
    activityFactoryKey: "alg",
  },
  problem: {
    factory: "pr",
    attrs:
      "ref_num,summary,description,status,priority,impact,urgency,customer,assignee,open_date,close_date,active",
    activityFactoryKey: "alg",
  },
  change: {
    factory: "chg",
    attrs:
      "chg_ref_num,summary,description,status,priority,requestor,assignee,open_date,close_date",
    activityFactoryKey: "chgalg",
  },
};

const ALLOWED_TYPES: ReadonlyArray<UiTicketType> = ["incident", "request", "problem", "change"];

export type TicketDetailDeps = RestProxyDeps;

export interface TicketDetailState {
  readonly cache: TtlCache<UiTicketDetail>;
}

export function createTicketDetailState(): TicketDetailState {
  return { cache: new TtlCache({ maxEntries: 256 }) };
}

export function registerTicketDetailRoutes(
  app: Hono,
  deps: TicketDetailDeps,
  state: TicketDetailState = createTicketDetailState(),
  log?: Logger,
): void {
  const localLog = log ?? deps.log;
  app.get("/api/tickets/:type/:id", async (c) => {
    const typeParam = c.req.param("type") as UiTicketType;
    if (!ALLOWED_TYPES.includes(typeParam)) {
      throw new AppErrorException({
        code: "VALIDATION",
        httpStatus: 400,
        message: `Unknown ticket type "${typeParam}" (allowed: ${ALLOWED_TYPES.join(", ")})`,
      });
    }
    const id = c.req.param("id");
    const session = await requireActiveSession(c, deps);
    const cacheKey = `${session.activeTenantId}::${session.userId}::${typeParam}::${id}`;

    let detail = state.cache.get(cacheKey);
    if (!detail) {
      const cfg = TICKET_FACTORIES[typeParam];
      // 1. Parent fetch (load-bearing — bubbles 404 / 500).
      const result = await proxyToSdm(c, deps, {
        method: "GET",
        caSdmPath: `/${cfg.factory}/${encodePkPathSegment(id)}`,
        xObjAttrs: cfg.attrs,
        op: `ticket-detail.${typeParam}`,
      });
      const raw = (result.body as Record<string, unknown>)?.[cfg.factory];
      if (!raw || typeof raw !== "object") {
        throw new AppErrorException({
          code: "NOT_FOUND",
          httpStatus: 404,
          message: `/api/tickets/${typeParam}/${id}: not found`,
        });
      }

      // 2. Branch fan-out. `Promise.allSettled` keeps the parent's success
      //    intact even if a branch fails — failed branches stay
      //    `_unsupported: true` and the FE renders an empty block.
      const encodedId = encodePkPathSegment(id);
      const [activitySettled, attachmentsSettled] = await Promise.allSettled([
        fetchActivity(c, deps, cfg.factory, encodedId, cfg.activityFactoryKey),
        fetchAttachments(c, deps, cfg.factory, encodedId, typeParam),
      ]);
      const activity = unwrapBranch(
        activitySettled,
        emptyActivity(false),
        localLog,
        "activity",
        typeParam,
        id,
      );
      const attachments = unwrapBranch(
        attachmentsSettled,
        emptyAttachments(false),
        localLog,
        "attachments",
        typeParam,
        id,
      );

      detail = rawToUiTicketDetail(raw as Record<string, unknown>, typeParam, {
        activity,
        attachments,
      });
      state.cache.set(cacheKey, detail, DETAIL_TTL_SEC);
      localLog.info(
        {
          event: "aggregator.ticket_detail.miss",
          cacheKey,
          activityCount: activity.items.length,
          attachmentCount: attachments.items.length,
          activitySupported: !activity._unsupported,
          attachmentsSupported: !attachments._unsupported,
        },
        "ticket-detail cache miss",
      );
    } else {
      localLog.info({ event: "aggregator.ticket_detail.hit", cacheKey }, "ticket-detail cache hit");
    }
    return c.json(detail, 200);
  });
}

function unwrapBranch<T>(
  settled: PromiseSettledResult<T>,
  fallback: T,
  log: Logger,
  branch: "activity" | "attachments",
  ticketType: UiTicketType,
  id: string,
): T {
  if (settled.status === "fulfilled") return settled.value;
  log.warn(
    {
      event: "aggregator.ticket_detail.branch_failure",
      branch,
      ticketType,
      id,
      error: settled.reason?.message,
    },
    `ticket-detail ${branch} branch failed — degrading to _unsupported`,
  );
  return fallback;
}

async function fetchActivity(
  c: Parameters<typeof proxyToSdm>[0],
  deps: RestProxyDeps,
  factory: keyof typeof LREL_ATTACHMENT_FACTORY,
  encodedId: string,
  activityFactoryKey: ActivityFactoryKey,
): Promise<UiTicketDetailActivity> {
  const result = await proxyToSdm(c, deps, {
    method: "GET",
    caSdmPath: `/${factory}/${encodedId}/act_log?size=${ACTIVITY_PAGE_SIZE}`,
    xObjAttrs: ACTIVITY_LOG_ATTRS,
    op: `ticket-detail.activity.${factory}`,
    tenantScopeReadQuery: false,
  });
  const { rows, total } = readCollection<Record<string, unknown>>(result.body, activityFactoryKey);
  const items: UiActivityEntry[] = rows.map(mapActivityRow);
  return {
    _unsupported: false,
    items,
    hasMore: total > items.length,
  };
}

async function fetchAttachments(
  c: Parameters<typeof proxyToSdm>[0],
  deps: RestProxyDeps,
  factory: keyof typeof LREL_ATTACHMENT_FACTORY,
  encodedId: string,
  ticketType: UiTicketType,
): Promise<UiTicketDetailAttachments> {
  const joinFactoryKey = LREL_ATTACHMENT_FACTORY[factory];
  // Step 1 — pull the lrel join (attmnt FKs only).
  const joinResult = await proxyToSdm(c, deps, {
    method: "GET",
    caSdmPath: `/${factory}/${encodedId}/attachments?size=${ATTACHMENT_PAGE_SIZE}`,
    op: `ticket-detail.attachments.${ticketType}`,
    tenantScopeReadQuery: false,
  });
  const { rows: joinRows } = readCollection<Record<string, unknown>>(
    joinResult.body,
    joinFactoryKey,
  );
  const attmntIds = extractAttachmentIds(joinRows);
  if (attmntIds.length === 0) {
    return { _unsupported: false, items: [] };
  }
  // Step 2 — enrich each attmnt with file metadata. Bounded concurrency.
  const items = await enrichAttachments(c, deps, attmntIds);
  return { _unsupported: false, items };
}

async function enrichAttachments(
  c: Parameters<typeof proxyToSdm>[0],
  deps: RestProxyDeps,
  attmntIds: ReadonlyArray<string>,
): Promise<UiAttachmentMeta[]> {
  const results: UiAttachmentMeta[] = [];
  for (let i = 0; i < attmntIds.length; i += ATTACHMENT_ENRICH_CONCURRENCY) {
    const batch = attmntIds.slice(i, i + ATTACHMENT_ENRICH_CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map((aid) =>
        proxyToSdm(c, deps, {
          method: "GET",
          caSdmPath: `/attmnt/${encodePkPathSegment(aid)}`,
          xObjAttrs: ATTACHMENT_ROW_ATTRS,
          op: `ticket-detail.attmnt.row`,
          tenantScopeReadQuery: false,
        }),
      ),
    );
    for (let j = 0; j < settled.length; j++) {
      const outcome = settled[j];
      const aid = batch[j];
      if (!outcome || !aid) continue;
      if (outcome.status !== "fulfilled") {
        deps.log.warn(
          {
            event: "aggregator.ticket_detail.attmnt_enrich_failed",
            attmntId: aid,
            error: outcome.reason?.message,
          },
          "attmnt enrichment failed — emitting placeholder row",
        );
        results.push({ id: aid, name: "", mime: null, sizeBytes: null, uploadedAt: null });
        continue;
      }
      const body = outcome.value.body as Record<string, unknown> | null;
      const row = body?.["attmnt"];
      if (!row || typeof row !== "object") {
        results.push({ id: aid, name: "", mime: null, sizeBytes: null, uploadedAt: null });
        continue;
      }
      results.push(mapAttmntRow(row as Record<string, unknown>));
    }
  }
  return results;
}

function emptyActivity(supported: boolean): UiTicketDetailActivity {
  return { _unsupported: !supported, items: [], hasMore: false };
}

function emptyAttachments(supported: boolean): UiTicketDetailAttachments {
  return { _unsupported: !supported, items: [] };
}
