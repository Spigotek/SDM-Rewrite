import type { Context, Hono } from "hono";
import { AppErrorException } from "../../auth/errors";
import { AUDIT_EVENTS } from "../../platform/audit";
import { requireActiveSession } from "../../session/load";
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
  /**
   * Maps a FE-shaped create payload → CA SDM attribute map.
   *
   * When `customerMeAttr` is set, the registrar resolves the active caller
   * after `mapCreate` runs (see `resolveCreateCustomer`): if the mapped attrs
   * carry no value for `customerMeAttr`, the BFF injects
   * `<customerMeAttr> REL_ATTR="<session.contactId>"`. So `mapCreate` should
   * emit the customer FK only when the FE supplied a concrete contact GUID,
   * and leave it absent for the "me" / omitted case — the portal never has
   * the caller's contact GUID, exactly like the GET `customer=me` resolver.
   */
  readonly mapCreate: (body: TCreate) => Record<string, unknown>;
  /** Maps a FE-shaped update payload → CA SDM attribute map. */
  readonly mapUpdate: (body: TUpdate) => Record<string, unknown>;
  /** XML element name to wrap the body in. Defaults to `factory`. */
  readonly xmlWrapper?: string;
  /**
   * When set, the GET list handler accepts `?customer=me` and resolves it
   * server-side to `<attr>=U'<session.contactId>'` in the CA SDM WC filter.
   * Used by portal "my tickets" widgets (H.2+) — the FE never has direct
   * access to the contact GUID, so the BFF resolves the active caller from
   * the session cookie. Setting `customerMeAttr` is the explicit opt-in;
   * entities without it ignore the `customer` query param.
   */
  readonly customerMeAttr?: string;
  /**
   * Optional literal sub-path that aliases the list endpoint. Registered as
   * `GET ${route}/${listAlias}` BEFORE the `:id` route so the literal segment
   * wins over the parameter capture. Fixes K-prompt §"Outstanding bugs" #2 —
   * `/api/kb/articles` and `/api/cmdb/cis` 404s where the SPA/operator probes
   * a list endpoint that previously fell through to `GET /api/kb/:id` and
   * proxied to `/KD/articles` upstream.
   */
  readonly listAlias?: string;
}

export function registerEntityRoutes<TRow, TCreate, TUpdate>(
  app: Hono,
  deps: RestProxyDeps,
  config: EntityRouteConfig<TRow, TCreate, TUpdate>,
): void {
  const wrapper = config.xmlWrapper ?? config.factory;

  const listHandler = async (c: Context) => {
    const url = new URL(c.req.url);
    const { start, size } = paginationToCaSdm(url.searchParams);
    const baseWc = url.searchParams.get("filter") ?? "";
    const wc = await resolveListWcFilter(c, deps, url.searchParams, baseWc, config);
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
  };

  app.get(config.route, listHandler);

  // Literal-segment list alias (e.g. `/api/kb/articles`, `/api/cmdb/cis`).
  // MUST register before the `:id` route so the literal wins over the
  // parameter capture under Hono's RegExpRouter.
  if (config.listAlias) {
    app.get(`${config.route}/${config.listAlias}`, listHandler);
  }

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
    await resolveCreateCustomer(c, deps, attrs, config);
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

/**
 * Build the final CA SDM `WC` filter for a list GET. Currently the only
 * transformation is the `?customer=me` → `<attr>=U'<contactId>'` resolver,
 * gated by `customerMeAttr` on the per-entity config. Any FE-supplied
 * `filter=` value is preserved verbatim and combined with ` AND `.
 *
 * The resolver intentionally only fires when `customer=me`: any other
 * `customer` value is left untouched (callers may already inject explicit
 * contact GUIDs via `filter=`).
 */
/**
 * Create-time mirror of the GET `customer=me` resolver. When the entity opts
 * in via `customerMeAttr` and `mapCreate` left that attribute absent (the FE
 * sent `customer="me"` / `requesterId="me"` or omitted it entirely — the portal
 * never holds the caller's contact GUID), inject
 * `<customerMeAttr> REL_ATTR="<session.contactId>"` so CA SDM accepts the
 * record. CA SDM requires the "Affected End User" / customer FK on create;
 * `session.contactId` is the 32-char-hex GUID in `U'…'` form.
 *
 * Mutates `attrs` in place. No-op when the entity has no `customerMeAttr` or
 * when `mapCreate` already emitted a concrete customer FK.
 */
async function resolveCreateCustomer<TRow, TCreate, TUpdate>(
  c: Parameters<typeof requireActiveSession>[0],
  deps: RestProxyDeps,
  attrs: Record<string, unknown>,
  config: EntityRouteConfig<TRow, TCreate, TUpdate>,
): Promise<void> {
  const attr = config.customerMeAttr;
  if (!attr) return;
  const existing = attrs[attr];
  const hasConcrete =
    existing !== undefined &&
    existing !== null &&
    typeof existing === "object" &&
    typeof (existing as { relAttr?: unknown }).relAttr === "string" &&
    (existing as { relAttr: string }).relAttr.length > 0;
  if (hasConcrete) return;
  const session = await requireActiveSession(c, deps);
  attrs[attr] = { relAttr: session.contactId };
}

async function resolveListWcFilter<TRow, TCreate, TUpdate>(
  c: Parameters<typeof requireActiveSession>[0],
  deps: RestProxyDeps,
  searchParams: URLSearchParams,
  baseWc: string,
  config: EntityRouteConfig<TRow, TCreate, TUpdate>,
): Promise<string> {
  if (!config.customerMeAttr) return baseWc;
  if (searchParams.get("customer") !== "me") return baseWc;
  const session = await requireActiveSession(c, deps);
  const clause = `${config.customerMeAttr}=${session.contactId}`;
  return baseWc ? `${baseWc} AND ${clause}` : clause;
}
