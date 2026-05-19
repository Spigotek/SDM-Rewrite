import type { Hono } from "hono";
import { AppErrorException } from "../../auth/errors";
import { AUDIT_EVENTS } from "../../platform/audit";
import { paginationToCaSdm, proxyToSdm, readCollection, type RestProxyDeps } from "../rest-proxy";
import { encodePkPathSegment, toCaSdmXmlBody } from "./_shape";

/**
 * Register a generic CRUD route family for one CA SDM factory under a
 * BFF-facing route prefix. Each entity file (`incidents.ts`, etc.) calls this
 * with a per-factory config; the body of the file stays a config + remap
 * function rather than 5 repeated Hono handlers.
 *
 * The shape of the FE response is deliberately unopinionated here — a `mapRow`
 * hook per entity converts raw CA SDM objects to the FE-facing shape so the
 * generic registrar doesn't need to know about field naming, FK collapsing,
 * or date conversion.
 */
export interface EntityRouteConfig<TRow, TCreate, TUpdate> {
  readonly factory: string;
  readonly route: string;
  readonly defaultAttrs: string;
  readonly pkIsGuid: boolean;
  readonly softClose:
    | { readonly kind: "status-CL" }
    | { readonly kind: "delete-flag-1" }
    | { readonly kind: "none" };
  /** Maps a raw CA SDM row → FE-facing shape. */
  readonly mapRow: (raw: Record<string, unknown>) => TRow;
  /** Maps a FE-shaped create payload → CA SDM attribute map. */
  readonly mapCreate: (body: TCreate) => Record<string, unknown>;
  /** Maps a FE-shaped update payload → CA SDM attribute map. */
  readonly mapUpdate: (body: TUpdate) => Record<string, unknown>;
  /** XML element name to wrap the body in. Defaults to `factory`. */
  readonly xmlWrapper?: string;
}

export function registerEntityRoutes<TRow, TCreate, TUpdate>(
  app: Hono,
  deps: RestProxyDeps,
  config: EntityRouteConfig<TRow, TCreate, TUpdate>,
): void {
  const wrapper = config.xmlWrapper ?? config.factory;

  app.get(config.route, async (c) => {
    const url = new URL(c.req.url);
    const { start, size } = paginationToCaSdm(url.searchParams);
    const wc = url.searchParams.get("filter") ?? "";
    const search = new URLSearchParams();
    if (wc) search.set("WC", wc);
    search.set("start", String(start));
    search.set("size", String(size));
    const result = await proxyToSdm(c, deps, {
      method: "GET",
      caSdmPath: `/${config.factory}?${search.toString()}`,
      xObjAttrs: config.defaultAttrs,
      op: `GET ${config.route}`,
    });
    const {
      rows,
      total,
      start: actualStart,
    } = readCollection<Record<string, unknown>>(result.body, config.factory);
    return c.json({
      data: rows.map(config.mapRow) as ReadonlyArray<unknown>,
      page: { total, start: actualStart, size: rows.length },
    } as never);
  });

  app.get(`${config.route}/:id`, async (c) => {
    const id = c.req.param("id");
    const result = await proxyToSdm(c, deps, {
      method: "GET",
      caSdmPath: `/${config.factory}/${encodePkPathSegment(id)}`,
      xObjAttrs: config.defaultAttrs,
      op: `GET ${config.route}/:id`,
    });
    const raw = (result.body as Record<string, unknown>)?.[config.factory];
    if (!raw || typeof raw !== "object") {
      throw new AppErrorException({
        code: "NOT_FOUND",
        httpStatus: 404,
        message: `${config.route}: not found`,
      });
    }
    return c.json(config.mapRow(raw as Record<string, unknown>) as never);
  });

  app.post(config.route, async (c) => {
    const body = (await c.req.json()) as TCreate;
    const attrs = config.mapCreate(body);
    const xml = toCaSdmXmlBody(wrapper, attrs);
    const result = await proxyToSdm(c, deps, {
      method: "POST",
      caSdmPath: `/${config.factory}`,
      body: xml,
      contentType: "application/xml",
      op: `POST ${config.route}`,
      successStatuses: [201],
    });
    const raw = (result.body as Record<string, unknown>)?.[config.factory];
    const out =
      raw && typeof raw === "object" ? config.mapRow(raw as Record<string, unknown>) : result.body;
    deps.audit?.(
      c,
      {
        category: "data",
        event: AUDIT_EVENTS.data.write(config.factory),
        result: "success",
        resultCode: 201,
        details: { op: "create", recordId: extractCreatedId(raw) },
      },
      result.session,
    );
    return c.json(out as never, 201);
  });

  app.put(`${config.route}/:id`, async (c) => {
    const id = c.req.param("id");
    const body = (await c.req.json()) as TUpdate;
    const attrs = config.mapUpdate(body);
    const xml = toCaSdmXmlBody(wrapper, attrs);
    const result = await proxyToSdm(c, deps, {
      method: "PUT",
      caSdmPath: `/${config.factory}/${encodePkPathSegment(id)}`,
      body: xml,
      contentType: "application/xml",
      op: `PUT ${config.route}/:id`,
      successStatuses: [200],
    });
    const raw = (result.body as Record<string, unknown>)?.[config.factory];
    const out =
      raw && typeof raw === "object" ? config.mapRow(raw as Record<string, unknown>) : result.body;
    deps.audit?.(
      c,
      {
        category: "data",
        event: AUDIT_EVENTS.data.write(config.factory),
        result: "success",
        resultCode: 200,
        details: { op: "update", recordId: id },
      },
      result.session,
    );
    return c.json(out as never);
  });

  if (config.softClose.kind !== "none") {
    app.delete(`${config.route}/:id`, async (c) => {
      const id = c.req.param("id");
      const attrs =
        config.softClose.kind === "status-CL"
          ? { status: { relAttr: "CL" } }
          : { delete_flag: { relAttr: "1" } };
      const xml = toCaSdmXmlBody(wrapper, attrs);
      const result = await proxyToSdm(c, deps, {
        method: "PUT",
        caSdmPath: `/${config.factory}/${encodePkPathSegment(id)}`,
        body: xml,
        contentType: "application/xml",
        op: `DELETE ${config.route}/:id (soft-close)`,
        successStatuses: [200],
      });
      deps.audit?.(
        c,
        {
          category: "data",
          event: AUDIT_EVENTS.data.delete(config.factory),
          result: "success",
          resultCode: 200,
          details: { op: "soft-close", recordId: id, kind: config.softClose.kind },
        },
        result.session,
      );
      return c.json({ id, softClose: config.softClose.kind, status: result.status }, 200);
    });
  }
}

function extractCreatedId(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const id = (raw as Record<string, unknown>)["@id"];
  return id !== undefined ? String(id) : null;
}
