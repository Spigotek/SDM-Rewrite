import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { BASE, buildAggregator, COOKIE, SID_COOKIE } from "./_helpers";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function row(
  factory: "in" | "cr" | "pr",
  id: number,
  priCode: string,
  opened: number,
  suffix = "",
) {
  return {
    "@id": id,
    "@COMMON_NAME": `${factory.toUpperCase()}:${id}`,
    ref_num: `${factory.toUpperCase()}:${id}${suffix}`,
    summary: `${factory} ${id}`,
    description: "",
    priority: { "@id": id + 1000, "@REL_ATTR": priCode, "@COMMON_NAME": priCode },
    status: { "@id": 5200, "@REL_ATTR": "OP", "@COMMON_NAME": "Vytvorený" },
    customer: { "@id": "U'C'", "@COMMON_NAME": "Cust" },
    open_date: String(opened),
  };
}

describe("GET /api/queue — fan-out + merge + sort", () => {
  it("merges in/cr/pr, sorts by priority desc then openedAt desc, paginates", async () => {
    server.use(
      http.get(`${BASE}/in`, () =>
        HttpResponse.json({
          collection_in: {
            "@TOTAL_COUNT": "2",
            "@START": "1",
            in: [row("in", 100, "1", 1700000300), row("in", 101, "3", 1700000200)],
          },
        }),
      ),
      http.get(`${BASE}/cr`, () =>
        HttpResponse.json({
          collection_cr: {
            "@TOTAL_COUNT": "1",
            "@START": "1",
            cr: row("cr", 200, "2", 1700000100),
          },
        }),
      ),
      http.get(`${BASE}/pr`, () =>
        HttpResponse.json({
          collection_pr: {
            "@TOTAL_COUNT": "1",
            "@START": "1",
            pr: row("pr", 300, "4", 1700000400),
          },
        }),
      ),
    );

    const { app } = await buildAggregator();
    const res = await app.fetch(
      new Request("http://bff/api/queue?page=0&size=10", { headers: { [COOKIE]: SID_COOKIE } }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Array<{ id: string; ticketType: string; priority: { code: string } | null }>;
      page: { total: number };
      hasMore: boolean;
    };
    expect(body.page.total).toBe(4);
    // First two: priority "1" (in:100) > "2" (cr:200) > "3" (in:101) > "4" (pr:300)
    expect(body.data[0]?.priority?.code).toBe("1");
    expect(body.data[0]?.ticketType).toBe("incident");
    expect(body.data[1]?.priority?.code).toBe("2");
    expect(body.data[1]?.ticketType).toBe("request");
    expect(body.data[3]?.priority?.code).toBe("4");
    expect(body.data[3]?.ticketType).toBe("problem");
    expect(body.hasMore).toBe(false);
  });

  it("hasMore=true when any factory exceeds the fan-out buffer", async () => {
    server.use(
      http.get(`${BASE}/in`, () =>
        HttpResponse.json({
          collection_in: {
            "@TOTAL_COUNT": "500",
            "@START": "1",
            in: [row("in", 1, "3", 1700000100)],
          },
        }),
      ),
      http.get(`${BASE}/cr`, () =>
        HttpResponse.json({ collection_cr: { "@TOTAL_COUNT": "0", "@START": "1" } }),
      ),
      http.get(`${BASE}/pr`, () =>
        HttpResponse.json({ collection_pr: { "@TOTAL_COUNT": "0", "@START": "1" } }),
      ),
    );
    const { app } = await buildAggregator();
    const res = await app.fetch(
      new Request("http://bff/api/queue", { headers: { [COOKIE]: SID_COOKIE } }),
    );
    const body = (await res.json()) as { hasMore: boolean };
    expect(body.hasMore).toBe(true);
  });

  it("forwards filter (WC clause) to each factory", async () => {
    const seenWc: Record<string, string | null> = {};
    server.use(
      http.get(`${BASE}/in`, ({ request }) => {
        seenWc.in = new URL(request.url).searchParams.get("WC");
        return HttpResponse.json({ collection_in: { "@TOTAL_COUNT": "0", "@START": "1" } });
      }),
      http.get(`${BASE}/cr`, ({ request }) => {
        seenWc.cr = new URL(request.url).searchParams.get("WC");
        return HttpResponse.json({ collection_cr: { "@TOTAL_COUNT": "0", "@START": "1" } });
      }),
      http.get(`${BASE}/pr`, ({ request }) => {
        seenWc.pr = new URL(request.url).searchParams.get("WC");
        return HttpResponse.json({ collection_pr: { "@TOTAL_COUNT": "0", "@START": "1" } });
      }),
    );
    const { app } = await buildAggregator();
    await app.fetch(
      new Request("http://bff/api/queue?filter=" + encodeURIComponent("status.code='OP'"), {
        headers: { [COOKIE]: SID_COOKIE },
      }),
    );
    expect(seenWc.in).toBe("status.code='OP'");
    expect(seenWc.cr).toBe("status.code='OP'");
    expect(seenWc.pr).toBe("status.code='OP'");
  });

  it("survives partial fan-out failure (one factory 500s)", async () => {
    server.use(
      http.get(`${BASE}/in`, () =>
        HttpResponse.json({
          collection_in: {
            "@TOTAL_COUNT": "1",
            "@START": "1",
            in: row("in", 1, "1", 1700000100),
          },
        }),
      ),
      http.get(
        `${BASE}/cr`,
        () =>
          new HttpResponse(JSON.stringify({ status: "500", message: "boom" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }),
      ),
      http.get(`${BASE}/pr`, () =>
        HttpResponse.json({
          collection_pr: {
            "@TOTAL_COUNT": "1",
            "@START": "1",
            pr: row("pr", 2, "2", 1700000200),
          },
        }),
      ),
    );
    const { app } = await buildAggregator();
    const res = await app.fetch(
      new Request("http://bff/api/queue", { headers: { [COOKIE]: SID_COOKIE } }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Array<{ ticketType: string }>;
      page: { total: number };
    };
    expect(body.page.total).toBe(2);
    expect(body.data.map((d) => d.ticketType).sort()).toEqual(["incident", "problem"]);
  });

  it("returns 401 without a session cookie", async () => {
    const { app } = await buildAggregator();
    const res = await app.fetch(new Request("http://bff/api/queue"));
    expect(res.status).toBe(401);
  });

  it("caches the fan-out — second call does not re-hit upstream", async () => {
    let inHits = 0;
    server.use(
      http.get(`${BASE}/in`, () => {
        inHits += 1;
        return HttpResponse.json({
          collection_in: {
            "@TOTAL_COUNT": "1",
            "@START": "1",
            in: row("in", 1, "1", 1700000100),
          },
        });
      }),
      http.get(`${BASE}/cr`, () =>
        HttpResponse.json({ collection_cr: { "@TOTAL_COUNT": "0", "@START": "1" } }),
      ),
      http.get(`${BASE}/pr`, () =>
        HttpResponse.json({ collection_pr: { "@TOTAL_COUNT": "0", "@START": "1" } }),
      ),
    );
    const { app } = await buildAggregator();
    await app.fetch(new Request("http://bff/api/queue", { headers: { [COOKIE]: SID_COOKIE } }));
    await app.fetch(new Request("http://bff/api/queue", { headers: { [COOKIE]: SID_COOKIE } }));
    expect(inHits).toBe(1);
  });
});
