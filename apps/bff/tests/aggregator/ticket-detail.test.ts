import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { BASE, buildAggregator, COOKIE, SID_COOKIE } from "./_helpers";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("GET /api/tickets/:type/:id", () => {
  it("incident: parent fetched, linked/attachments/activity empty with _unsupported markers", async () => {
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
    expect(body.linked._unsupported).toBe(true);
    expect(body.linked.problems).toEqual([]);
    expect(body.attachments._unsupported).toBe(true);
    expect(body.activity._unsupported).toBe(true);
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
});
