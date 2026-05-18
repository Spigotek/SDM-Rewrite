import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import pino from "pino";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { AppErrorException } from "../src/auth/errors";
import { SdmBroker } from "../src/auth/sdm-broker";

const BASE = "http://test-sdm.local/caisd-rest";

function makeBroker(now: () => number = () => 1_700_000_000_000) {
  return new SdmBroker(
    {
      baseUrl: BASE,
      basicAuthUser: "vueuser",
      basicAuthPass: "secret",
      requestTimeoutMs: 2000,
      maxRetries: 0,
    },
    { fetch: globalThis.fetch, log: pino({ level: "silent" }), now },
  );
}

const BOOTSTRAP_OK = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<rest_access id="402020" REL_ATTR="402020" COMMON_NAME="51299815abc">
  <link href="${BASE}/rest_access/402020" rel="self"/>
  <access_key>51299815abc</access_key>
  <expiration_date>1779696034</expiration_date>
</rest_access>`;

const BOOTSTRAP_401 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<error><message>The user name or password you entered is not correct. Please try again.</message><status>401</status></error>`;

const FAKE_KEY_400 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<error><message>Invalid REST Access Key (FAKEKEY123) provided via X-AccessKey header.</message><status>400</status></error>`;

const CNT_JSON_OK = JSON.stringify({
  collection_cnt: {
    "@COUNT": 1,
    "@TOTAL_COUNT": 1,
    cnt: {
      "@id": "U'BDE1683C44FCCB4DAE50BA4DDB5DCBE6'",
      "@COMMON_NAME": "User, Vue ",
      access_type: { "@id": "10002", "@COMMON_NAME": "Administration" },
      email_address: "uservue@camp.com",
      first_name: "Vue",
      last_name: "User",
      userid: "vueuser",
    },
  },
});

const CNT_ROLE_EMPTY = JSON.stringify({
  collection_cnt_role: { "@COUNT": 0, "@TOTAL_COUNT": 0 },
});

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("SdmBroker.bootstrap", () => {
  it("returns access key, id, and expiry (epoch sec → ms) on 201", async () => {
    server.use(
      http.post(`${BASE}/rest_access`, async ({ request }) => {
        expect(request.headers.get("authorization")).toMatch(/^Basic /);
        expect(request.headers.get("content-type")).toBe("application/xml");
        const body = await request.text();
        expect(body).toBe("<rest_access/>");
        return new HttpResponse(BOOTSTRAP_OK, {
          status: 201,
          headers: { "Content-Type": "application/xml" },
        });
      }),
    );
    const key = await makeBroker().bootstrap();
    expect(key.accessKey).toBe("51299815abc");
    expect(key.accessKeyId).toBe("402020");
    expect(key.expiresAtMs).toBe(1779696034 * 1000);
  });

  it("maps 401 to AUTH_INVALID_CREDENTIALS", async () => {
    server.use(
      http.post(
        `${BASE}/rest_access`,
        () =>
          new HttpResponse(BOOTSTRAP_401, {
            status: 401,
            headers: { "Content-Type": "application/xml" },
          }),
      ),
    );
    await expect(makeBroker().bootstrap()).rejects.toMatchObject({
      code: "AUTH_INVALID_CREDENTIALS",
    });
  });

  it("maps 5xx to BACKEND_UNAVAILABLE", async () => {
    server.use(http.post(`${BASE}/rest_access`, () => new HttpResponse("", { status: 503 })));
    await expect(makeBroker().bootstrap()).rejects.toMatchObject({
      code: "BACKEND_UNAVAILABLE",
    });
  });

  it("uses override creds when supplied (login flow)", async () => {
    let seenAuth = "";
    server.use(
      http.post(`${BASE}/rest_access`, ({ request }) => {
        seenAuth = request.headers.get("authorization") ?? "";
        return new HttpResponse(BOOTSTRAP_OK, {
          status: 201,
          headers: { "Content-Type": "application/xml" },
        });
      }),
    );
    await makeBroker().bootstrap({ user: "alice", pass: "secret" });
    expect(seenAuth).toBe(`Basic ${Buffer.from("alice:secret").toString("base64")}`);
  });

  it("rejects malformed XML response", async () => {
    server.use(
      http.post(
        `${BASE}/rest_access`,
        () =>
          new HttpResponse("<rest_access/>", {
            status: 201,
            headers: { "Content-Type": "application/xml" },
          }),
      ),
    );
    await expect(makeBroker().bootstrap()).rejects.toMatchObject({ code: "UNKNOWN" });
  });
});

describe("SdmBroker.lookupContact", () => {
  const validKey = "51299815abc";

  it("returns a parsed contact (single match)", async () => {
    server.use(
      http.get(`${BASE}/cnt`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("WC")).toBe("userid='vueuser'");
        expect(request.headers.get("x-accesskey")).toBe(validKey);
        expect(request.headers.get("x-obj-attrs")).toContain("userid");
        return HttpResponse.text(CNT_JSON_OK, {
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
    const c = await makeBroker().lookupContact(validKey, "vueuser");
    expect(c.id).toBe("U'BDE1683C44FCCB4DAE50BA4DDB5DCBE6'");
    expect(c.userid).toBe("vueuser");
    expect(c.email).toBe("uservue@camp.com");
    expect(c.displayName).toBe("User, Vue");
    expect(c.accessTypeName).toBe("Administration");
  });

  it("classifies AUTH_EXPIRED on HTTP 400 with 'Invalid REST Access Key' body", async () => {
    server.use(
      http.get(
        `${BASE}/cnt`,
        () =>
          new HttpResponse(FAKE_KEY_400, {
            status: 400,
            headers: { "Content-Type": "application/xml" },
          }),
      ),
    );
    await expect(makeBroker().lookupContact("BAD", "vueuser")).rejects.toMatchObject({
      code: "AUTH_EXPIRED",
    });
  });

  it("classifies AUTH_FORBIDDEN on HTTP 401 from a non-bootstrap endpoint", async () => {
    server.use(http.get(`${BASE}/cnt`, () => new HttpResponse("forbidden", { status: 401 })));
    await expect(makeBroker().lookupContact(validKey, "vueuser")).rejects.toMatchObject({
      code: "AUTH_FORBIDDEN",
    });
  });

  it("throws NOT_FOUND when collection is empty", async () => {
    const emptyBody = JSON.stringify({ collection_cnt: { "@COUNT": 0, "@TOTAL_COUNT": 0 } });
    server.use(http.get(`${BASE}/cnt`, () => HttpResponse.text(emptyBody)));
    await expect(makeBroker().lookupContact(validKey, "ghost")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("SdmBroker.listContactRoles", () => {
  it("returns empty list when cnt_role collection is empty", async () => {
    server.use(http.get(`${BASE}/cnt_role`, () => HttpResponse.text(CNT_ROLE_EMPTY)));
    const roles = await makeBroker().listContactRoles("k", "U'ABC'");
    expect(roles).toEqual([]);
  });

  it("returns roleSym=null when the role FK is silently dropped (real B-E behaviour)", async () => {
    const body = JSON.stringify({
      collection_cnt_role: {
        "@COUNT": 1,
        cnt_role: { "@id": 12345, contact: { "@id": "U'ABC'" } },
      },
    });
    server.use(http.get(`${BASE}/cnt_role`, () => HttpResponse.text(body)));
    const roles = await makeBroker().listContactRoles("k", "U'ABC'");
    expect(roles).toEqual([{ id: "12345", roleSym: null }]);
  });
});

describe("SdmBroker.revoke", () => {
  it("calls DELETE with X-AccessKey on the keyed path", async () => {
    let seenPath = "";
    server.use(
      http.delete(`${BASE}/rest_access/:id`, ({ request, params }) => {
        seenPath = String(params.id);
        expect(request.headers.get("x-accesskey")).toBe("k");
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await makeBroker().revoke("k", "402020");
    expect(seenPath).toBe("402020");
  });

  it("never throws on network failure (best-effort)", async () => {
    server.use(http.delete(`${BASE}/rest_access/:id`, () => HttpResponse.error()));
    await expect(makeBroker().revoke("k", "402020")).resolves.toBeUndefined();
  });
});

describe("SdmBroker.ensureFresh", () => {
  it("returns the same key when still valid", async () => {
    const broker = makeBroker(() => 1_700_000_000_000);
    const fresh = await broker.ensureFresh(
      { accessKey: "k", accessKeyId: "1", expiresAtMs: 1_700_000_300_000 },
      60,
    );
    expect(fresh.rotated).toBe(false);
    expect(fresh.key.accessKey).toBe("k");
  });

  it("re-bootstraps + revokes when below threshold", async () => {
    let revoked: { key: string; id: string } | null = null;
    server.use(
      http.post(
        `${BASE}/rest_access`,
        () =>
          new HttpResponse(BOOTSTRAP_OK, {
            status: 201,
            headers: { "Content-Type": "application/xml" },
          }),
      ),
      http.delete(`${BASE}/rest_access/:id`, ({ params, request }) => {
        revoked = {
          key: request.headers.get("x-accesskey") ?? "",
          id: String(params.id),
        };
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const broker = makeBroker(() => 1_700_000_000_000);
    const fresh = await broker.ensureFresh(
      { accessKey: "old", accessKeyId: "999", expiresAtMs: 1_700_000_000_500 },
      60,
    );
    expect(fresh.rotated).toBe(true);
    expect(fresh.key.accessKey).toBe("51299815abc");
    expect(revoked).toEqual({ key: "old", id: "999" });
  });
});

describe("SdmBroker error coverage", () => {
  it("throws AppErrorException instances (sanity check on the class)", async () => {
    server.use(
      http.post(
        `${BASE}/rest_access`,
        () =>
          new HttpResponse(BOOTSTRAP_401, {
            status: 401,
            headers: { "Content-Type": "application/xml" },
          }),
      ),
    );
    try {
      await makeBroker().bootstrap();
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AppErrorException);
    }
  });
});
