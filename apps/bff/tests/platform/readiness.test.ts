import { Hono } from "hono";
import pino from "pino";
import { describe, expect, it } from "vitest";
import { registerHealthRoutes } from "../../src/platform/health";
import type { SdmHttpClient, RawSdmResponse } from "../../src/api/http-client";
import type { SdmAccessKey, SdmBroker } from "../../src/auth/sdm-broker";

interface FakeBrokerHooks {
  bootstrap?: () => Promise<SdmAccessKey>;
  ensureFresh?: (k: SdmAccessKey) => Promise<{ key: SdmAccessKey; rotated: boolean }>;
}

function fakeBroker(hooks: FakeBrokerHooks): SdmBroker {
  return {
    bootstrap:
      hooks.bootstrap ??
      (async () => ({ accessKey: "k", accessKeyId: "1", expiresAtMs: Date.now() + 1_000_000 })),
    ensureFresh: hooks.ensureFresh ?? (async (k) => ({ key: k, rotated: false })),
  } as unknown as SdmBroker;
}

function fakeClient(handler: () => Promise<RawSdmResponse>): SdmHttpClient {
  return { request: handler } as unknown as SdmHttpClient;
}

function buildApp(broker: SdmBroker, client: SdmHttpClient): Hono {
  const app = new Hono();
  registerHealthRoutes(app, { broker, client, log: pino({ level: "silent" }) });
  return app;
}

describe("GET /readyz", () => {
  it("200 ready when bootstrap + /pri read both succeed", async () => {
    const broker = fakeBroker({});
    const client = fakeClient(async () => ({
      status: 200,
      text: '{"collection_pri":{"@TOTAL_COUNT":"6"}}',
      headers: new Headers({ "content-type": "application/json" }),
    }));
    const res = await buildApp(broker, client).fetch(new Request("http://bff/readyz"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      checks: { bootstrap: string; sdmRead: string };
    };
    expect(body.status).toBe("ready");
    expect(body.checks.bootstrap).toBe("ok");
    expect(body.checks.sdmRead).toBe("ok");
  });

  it("503 with reason when bootstrap throws", async () => {
    const broker = fakeBroker({
      bootstrap: async () => {
        throw new Error("rest_access 401");
      },
    });
    const client = fakeClient(async () => ({ status: 200, text: "", headers: new Headers() }));
    const res = await buildApp(broker, client).fetch(new Request("http://bff/readyz"));
    expect(res.status).toBe(503);
    const body = (await res.json()) as {
      status: string;
      reason: string;
      checks: { bootstrap: string };
    };
    expect(body.status).toBe("not_ready");
    expect(body.checks.bootstrap).toBe("fail");
    expect(body.reason).toContain("rest_access");
  });

  it("503 when /pri returns non-200", async () => {
    const broker = fakeBroker({});
    const client = fakeClient(async () => ({ status: 502, text: "", headers: new Headers() }));
    const res = await buildApp(broker, client).fetch(new Request("http://bff/readyz"));
    expect(res.status).toBe(503);
    const body = (await res.json()) as { reason: string; checks: { sdmRead: string } };
    expect(body.checks.sdmRead).toBe("fail");
    expect(body.reason).toContain("HTTP 502");
  });

  it("503 with timeout reason when /pri hangs", async () => {
    const broker = fakeBroker({});
    const client = fakeClient(
      () =>
        new Promise<RawSdmResponse>((resolve) => {
          setTimeout(() => resolve({ status: 200, text: "", headers: new Headers() }), 200);
        }),
    );
    const app = new Hono();
    registerHealthRoutes(app, {
      broker,
      client,
      log: pino({ level: "silent" }),
      probeTimeoutMs: 5,
    });
    const res = await app.fetch(new Request("http://bff/readyz"));
    expect(res.status).toBe(503);
    const body = (await res.json()) as { reason: string };
    expect(body.reason).toContain("timed out");
  });

  it("/health stays liveness-only (no upstream call)", async () => {
    let calls = 0;
    const broker = fakeBroker({
      bootstrap: async () => {
        calls += 1;
        return { accessKey: "k", accessKeyId: "1", expiresAtMs: Date.now() + 1_000_000 };
      },
    });
    const client = fakeClient(async () => ({ status: 200, text: "", headers: new Headers() }));
    const res = await buildApp(broker, client).fetch(new Request("http://bff/health"));
    expect(res.status).toBe(200);
    expect(calls).toBe(0);
  });
});
