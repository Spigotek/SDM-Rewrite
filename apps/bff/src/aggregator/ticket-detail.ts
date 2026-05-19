import type { Hono } from "hono";
import type { Logger } from "pino";
import type { UiTicketDetail, UiTicketType } from "@sdm/api-types";
import { TtlCache } from "../api/cache";
import { proxyToSdm, type RestProxyDeps } from "../api/rest-proxy";
import { encodePkPathSegment } from "../api/endpoints/_shape";
import { AppErrorException } from "../auth/errors";
import { requireActiveSession } from "../session/load";
import { rawToUiTicketDetail } from "./shapers/ui-ticket-detail";

/**
 * GET /api/tickets/:type/:id — ticket-detail aggregator.
 *
 * **MVP scope** — parent fetch only. Linked tickets (`lrel_*`), attachments
 * (`attmnt`), and activity log (`act_log`) factory names have not been
 * captured in `docs/agents/devex-devops/real-backend-contracts.md` yet; the
 * shape returns those blocks with `_unsupported: true` and empty arrays so
 * the FE renders an empty state. Flipping `_unsupported: false` after a
 * separate B-E probe chunk is non-breaking.
 *
 * `:type` ∈ {incident, request, problem, change} maps to CA SDM factories
 * `in`/`cr`/`pr`/`chg`. `chg` schema diverges (§15) — handled inside
 * `rawToUiTicketDetail`.
 *
 * Cache TTL 60 s per `bff.md §2.4`. Cache key encodes
 * `(tenantId, userId, type, id)`.
 */

const DETAIL_TTL_SEC = 60;

const TICKET_FACTORIES: Record<UiTicketType, { factory: string; attrs: string }> = {
  incident: {
    factory: "in",
    attrs:
      "ref_num,summary,description,status,priority,impact,urgency,customer,assignee,open_date,close_date,active,category",
  },
  request: {
    factory: "cr",
    attrs:
      "ref_num,summary,description,status,priority,impact,urgency,customer,assignee,type,open_date,close_date,active,category",
  },
  problem: {
    factory: "pr",
    attrs:
      "ref_num,summary,description,status,priority,impact,urgency,customer,assignee,open_date,close_date,active",
  },
  change: {
    factory: "chg",
    attrs:
      "chg_ref_num,summary,description,status,priority,requestor,assignee,open_date,close_date",
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
      const { factory, attrs } = TICKET_FACTORIES[typeParam];
      const result = await proxyToSdm(c, deps, {
        method: "GET",
        caSdmPath: `/${factory}/${encodePkPathSegment(id)}`,
        xObjAttrs: attrs,
        op: `ticket-detail.${typeParam}`,
      });
      const raw = (result.body as Record<string, unknown>)?.[factory];
      if (!raw || typeof raw !== "object") {
        throw new AppErrorException({
          code: "NOT_FOUND",
          httpStatus: 404,
          message: `/api/tickets/${typeParam}/${id}: not found`,
        });
      }
      detail = rawToUiTicketDetail(raw as Record<string, unknown>, typeParam);
      state.cache.set(cacheKey, detail, DETAIL_TTL_SEC);
      localLog.info(
        { event: "aggregator.ticket_detail.miss", cacheKey },
        "ticket-detail cache miss",
      );
    } else {
      localLog.info({ event: "aggregator.ticket_detail.hit", cacheKey }, "ticket-detail cache hit");
    }
    return c.json(detail, 200);
  });
}
