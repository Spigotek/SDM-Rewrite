import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { BASE, buildAggregator, COOKIE, SID_COOKIE } from "./_helpers";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/**
 * Default branch handlers — F.6 added `Promise.allSettled` fan-out for activity
 * + attachments. Tests that only assert on the parent payload still need these
 * fetches to resolve cleanly. Empty collections (`@TOTAL_COUNT=0`) keep the
 * branches `_unsupported: false` with empty arrays, matching the "ticket with
 * no activity / no attachments" real-world case from §22-§23.
 */
function defaultBranchHandlers(factory: "in" | "cr" | "pr" | "chg", id: string) {
  const activityFactoryKey = factory === "chg" ? "chgalg" : "alg";
  const lrelKey = factory === "chg" ? "lrel_attachments_changes" : "lrel_attachments_requests";
  return [
    http.get(`${BASE}/${factory}/${id}/act_log`, () =>
      HttpResponse.json({
        [`collection_${activityFactoryKey}`]: {
          "@COUNT": 0,
          "@START": 0,
          "@TOTAL_COUNT": 0,
          "@TYPE": "BREL",
        },
      }),
    ),
    http.get(`${BASE}/${factory}/${id}/attachments`, () =>
      HttpResponse.json({
        [`collection_${lrelKey}`]: {
          "@COUNT": 0,
          "@START": 0,
          "@TOTAL_COUNT": 0,
          "@TYPE": "BREL",
        },
      }),
    ),
  ];
}

describe("GET /api/tickets/:type/:id", () => {
  it("incident: parent + empty activity/attachments branches resolve cleanly", async () => {
    server.use(
      http.get(`${BASE}/in/2800`, () =>
        HttpResponse.json({
          in: {
            "@id": 2800,
            ref_num: "SD:01",
            summary: "Notebook restart",
            description: "desc",
            status: { "@id": 5200, "@REL_ATTR": "OP", "@COMMON_NAME": "Vytvorený" },
            priority: { "@id": 503, "@REL_ATTR": "2", "@COMMON_NAME": "2" },
            customer: { "@id": "U'BDE'", "@COMMON_NAME": "User, Vue" },
            open_date: "1700000000",
          },
        }),
      ),
      ...defaultBranchHandlers("in", "2800"),
    );
    const { app } = await buildAggregator();
    const res = await app.fetch(
      new Request("http://bff/api/tickets/incident/2800", { headers: { [COOKIE]: SID_COOKIE } }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ticketType: string;
      ref: string;
      linked: { _unsupported: boolean; problems: unknown[] };
      attachments: { _unsupported: boolean; items: unknown[] };
      activity: { _unsupported: boolean; items: unknown[]; hasMore: boolean };
    };
    expect(body.ticketType).toBe("incident");
    expect(body.ref).toBe("SD:01");
    // Linked still _unsupported per §24 (no BREL works on this CA SDM instance).
    expect(body.linked._unsupported).toBe(true);
    expect(body.linked.problems).toEqual([]);
    // Activity + attachments now SUPPORTED (BREL probe verified §22/§23) — empty list ≠ unsupported.
    expect(body.attachments._unsupported).toBe(false);
    expect(body.attachments.items).toEqual([]);
    expect(body.activity._unsupported).toBe(false);
    expect(body.activity.items).toEqual([]);
    expect(body.activity.hasMore).toBe(false);
  });

  it("change: hits /chg, surfaces chg_ref_num + requestor", async () => {
    server.use(
      http.get(`${BASE}/chg/2781`, () =>
        HttpResponse.json({
          chg: {
            "@id": 2781,
            chg_ref_num: "USD:11",
            summary: "ITIL summary",
            requestor: { "@id": "U'FCF'", "@COMMON_NAME": "System_MA_User" },
            status: { "@id": 6001, "@REL_ATTR": "CL", "@COMMON_NAME": "Closed" },
            open_date: "1031839200",
          },
        }),
      ),
      ...defaultBranchHandlers("chg", "2781"),
    );
    const { app } = await buildAggregator();
    const res = await app.fetch(
      new Request("http://bff/api/tickets/change/2781", { headers: { [COOKIE]: SID_COOKIE } }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ref: string;
      customer: { label: string } | null;
    };
    expect(body.ref).toBe("USD:11");
    expect(body.customer?.label).toBe("System_MA_User");
  });

  it("unknown :type → 400", async () => {
    const { app } = await buildAggregator();
    const res = await app.fetch(
      new Request("http://bff/api/tickets/nonsense/1", { headers: { [COOKIE]: SID_COOKIE } }),
    );
    expect(res.status).toBe(400);
  });

  it("upstream missing record → 404", async () => {
    server.use(
      http.get(
        `${BASE}/in/99999`,
        () =>
          new HttpResponse(JSON.stringify({ status: "404", message: "No records found." }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
    const { app } = await buildAggregator();
    const res = await app.fetch(
      new Request("http://bff/api/tickets/incident/99999", { headers: { [COOKIE]: SID_COOKIE } }),
    );
    expect(res.status).toBe(404);
  });

  it("caches: second call to same id doesn't re-hit upstream", async () => {
    let hits = 0;
    server.use(
      http.get(`${BASE}/in/2800`, () => {
        hits += 1;
        return HttpResponse.json({
          in: {
            "@id": 2800,
            ref_num: "SD:01",
            summary: "x",
            description: "",
            open_date: "1700000000",
          },
        });
      }),
      ...defaultBranchHandlers("in", "2800"),
    );
    const { app } = await buildAggregator();
    await app.fetch(
      new Request("http://bff/api/tickets/incident/2800", { headers: { [COOKIE]: SID_COOKIE } }),
    );
    await app.fetch(
      new Request("http://bff/api/tickets/incident/2800", { headers: { [COOKIE]: SID_COOKIE } }),
    );
    expect(hits).toBe(1);
  });

  it("activity: populated alg rows produce UiActivityEntry array with derived kind", async () => {
    server.use(
      http.get(`${BASE}/pr/406621`, () =>
        HttpResponse.json({
          pr: {
            "@id": 406621,
            ref_num: "5254",
            summary: "prob",
            open_date: "1700000000",
          },
        }),
      ),
      http.get(`${BASE}/pr/406621/act_log`, () =>
        HttpResponse.json({
          collection_alg: {
            "@COUNT": 3,
            "@START": 1,
            "@TOTAL_COUNT": 3,
            "@TYPE": "BREL",
            alg: [
              {
                "@id": 408536,
                description: "create a new request/incident/problem/change/issue",
                action_desc: "create a new request/incident/problem/change/issue",
                analyst: { "@id": "U'927'", "@COMMON_NAME": "Riesitel, test " },
                internal: 0,
                time_stamp: 1727771897,
                type: { "@id": 5602, "@REL_ATTR": "INIT", "@COMMON_NAME": "Initial" },
              },
              {
                "@id": 408537,
                description: "log a user comment",
                analyst: { "@id": "U'BDE'", "@COMMON_NAME": "User, Vue " },
                internal: 0,
                time_stamp: 1727772016,
                type: { "@id": 5601, "@REL_ATTR": "LOG", "@COMMON_NAME": "Log Comment" },
              },
              {
                "@id": 408538,
                description: "private analyst note",
                analyst: { "@id": "U'BDE'", "@COMMON_NAME": "User, Vue " },
                internal: 1,
                time_stamp: 1727772100,
                type: { "@id": 5601, "@REL_ATTR": "LOG", "@COMMON_NAME": "Log Comment" },
              },
            ],
          },
        }),
      ),
      http.get(`${BASE}/pr/406621/attachments`, () =>
        HttpResponse.json({
          collection_lrel_attachments_requests: {
            "@COUNT": 0,
            "@START": 0,
            "@TOTAL_COUNT": 0,
            "@TYPE": "BREL",
          },
        }),
      ),
    );
    const { app } = await buildAggregator();
    const res = await app.fetch(
      new Request("http://bff/api/tickets/problem/406621", { headers: { [COOKIE]: SID_COOKIE } }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      activity: {
        _unsupported: boolean;
        hasMore: boolean;
        items: Array<{
          id: string;
          kind: "public" | "internal" | "system";
          text: string;
          createdAt: string | null;
          author: { label: string } | null;
        }>;
      };
    };
    expect(body.activity._unsupported).toBe(false);
    expect(body.activity.hasMore).toBe(false);
    expect(body.activity.items).toHaveLength(3);
    // INIT → system (not LOG, not internal)
    expect(body.activity.items[0]?.kind).toBe("system");
    expect(body.activity.items[0]?.id).toBe("408536");
    expect(body.activity.items[0]?.createdAt).toBe(new Date(1727771897 * 1000).toISOString());
    // LOG, internal=0 → public
    expect(body.activity.items[1]?.kind).toBe("public");
    // LOG, internal=1 → internal (override wins)
    expect(body.activity.items[2]?.kind).toBe("internal");
  });

  it("activity: hasMore=true when TOTAL_COUNT exceeds items length", async () => {
    server.use(
      http.get(`${BASE}/chg/2781`, () =>
        HttpResponse.json({
          chg: { "@id": 2781, chg_ref_num: "USD:11", summary: "x", open_date: "1700000000" },
        }),
      ),
      http.get(`${BASE}/chg/2781/act_log`, () =>
        HttpResponse.json({
          collection_chgalg: {
            "@COUNT": 1,
            "@START": 1,
            "@TOTAL_COUNT": 200,
            "@TYPE": "BREL",
            chgalg: [
              {
                "@id": 2862,
                description: "create change",
                analyst: { "@id": "U'A'", "@COMMON_NAME": "A" },
                internal: 0,
                time_stamp: 1700000000,
                type: { "@id": 5602, "@REL_ATTR": "INIT", "@COMMON_NAME": "Initial" },
              },
            ],
          },
        }),
      ),
      http.get(`${BASE}/chg/2781/attachments`, () =>
        HttpResponse.json({
          collection_lrel_attachments_changes: {
            "@COUNT": 0,
            "@TOTAL_COUNT": 0,
            "@START": 0,
            "@TYPE": "BREL",
          },
        }),
      ),
    );
    const { app } = await buildAggregator();
    const res = await app.fetch(
      new Request("http://bff/api/tickets/change/2781", { headers: { [COOKIE]: SID_COOKIE } }),
    );
    const body = (await res.json()) as { activity: { hasMore: boolean; items: unknown[] } };
    expect(body.activity.hasMore).toBe(true);
    expect(body.activity.items).toHaveLength(1);
  });

  it("attachments: two-step enrichment hits /attmnt/{id} per row", async () => {
    let attmntHits = 0;
    server.use(
      http.get(`${BASE}/in/2800`, () =>
        HttpResponse.json({
          in: { "@id": 2800, ref_num: "SD:01", summary: "x", open_date: "1700000000" },
        }),
      ),
      http.get(`${BASE}/in/2800/act_log`, () =>
        HttpResponse.json({
          collection_alg: { "@COUNT": 0, "@TOTAL_COUNT": 0, "@START": 0, "@TYPE": "BREL" },
        }),
      ),
      http.get(`${BASE}/in/2800/attachments`, () =>
        HttpResponse.json({
          collection_lrel_attachments_requests: {
            "@COUNT": 2,
            "@TOTAL_COUNT": 2,
            "@START": 1,
            "@TYPE": "BREL",
            lrel_attachments_requests: [
              { "@id": 400001, attmnt: { "@id": 400059, "@COMMON_NAME": 1619005790 } },
              { "@id": 400051, attmnt: { "@id": 400151, "@COMMON_NAME": 1627650367 } },
            ],
          },
        }),
      ),
      http.get(`${BASE}/attmnt/400059`, () => {
        attmntHits += 1;
        return HttpResponse.json({
          attmnt: {
            "@id": 400059,
            file_name: "printer.jpg.gz",
            file_type: "jpg",
            file_size: 27066,
            last_mod_dt: 1619005806,
            last_mod_by: { "@id": "U'X'", "@COMMON_NAME": "ServiceDesk" },
          },
        });
      }),
      http.get(`${BASE}/attmnt/400151`, () => {
        attmntHits += 1;
        return HttpResponse.json({
          attmnt: {
            "@id": 400151,
            file_name: "report.pdf",
            file_type: "pdf",
            file_size: 51200,
            last_mod_dt: 1627650400,
          },
        });
      }),
    );
    const { app } = await buildAggregator();
    const res = await app.fetch(
      new Request("http://bff/api/tickets/incident/2800", { headers: { [COOKIE]: SID_COOKIE } }),
    );
    const body = (await res.json()) as {
      attachments: {
        _unsupported: boolean;
        items: Array<{ id: string; name: string; mime: string | null; sizeBytes: number | null }>;
      };
    };
    expect(attmntHits).toBe(2);
    expect(body.attachments._unsupported).toBe(false);
    expect(body.attachments.items).toHaveLength(2);
    expect(body.attachments.items[0]).toMatchObject({
      id: "400059",
      name: "printer.jpg.gz",
      mime: "image/jpeg",
      sizeBytes: 27066,
    });
    expect(body.attachments.items[1]).toMatchObject({
      id: "400151",
      name: "report.pdf",
      mime: "application/pdf",
      sizeBytes: 51200,
    });
  });

  it("activity branch failure → _unsupported:true, parent still returned", async () => {
    server.use(
      http.get(`${BASE}/in/2800`, () =>
        HttpResponse.json({
          in: { "@id": 2800, ref_num: "SD:01", summary: "x", open_date: "1700000000" },
        }),
      ),
      http.get(
        `${BASE}/in/2800/act_log`,
        () => new HttpResponse("upstream blew up", { status: 500 }),
      ),
      http.get(`${BASE}/in/2800/attachments`, () =>
        HttpResponse.json({
          collection_lrel_attachments_requests: {
            "@COUNT": 0,
            "@TOTAL_COUNT": 0,
            "@START": 0,
            "@TYPE": "BREL",
          },
        }),
      ),
    );
    const { app } = await buildAggregator();
    const res = await app.fetch(
      new Request("http://bff/api/tickets/incident/2800", { headers: { [COOKIE]: SID_COOKIE } }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      activity: { _unsupported: boolean; items: unknown[] };
      attachments: { _unsupported: boolean; items: unknown[] };
    };
    expect(body.activity._unsupported).toBe(true);
    expect(body.activity.items).toEqual([]);
    // Attachments branch unaffected:
    expect(body.attachments._unsupported).toBe(false);
  });
});
