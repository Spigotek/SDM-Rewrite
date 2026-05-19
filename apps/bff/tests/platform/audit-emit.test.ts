import { Hono } from "hono";
import pino from "pino";
import { Writable } from "node:stream";
import { describe, expect, it, beforeEach } from "vitest";
import { AUDIT_EVENTS, createAuditEmitter } from "../../src/platform/audit";

interface CapturedLine {
  level: number;
  msg: string;
  auditEvent: Record<string, unknown>;
}

function captureLogger(): { log: pino.Logger; lines: CapturedLine[] } {
  const lines: CapturedLine[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      const text = chunk.toString();
      for (const ln of text.split("\n")) {
        if (!ln.trim()) continue;
        const parsed = JSON.parse(ln) as CapturedLine;
        if (parsed.auditEvent) lines.push(parsed);
      }
      cb();
    },
  });
  const log = pino({ level: "info" }, stream);
  return { log, lines };
}

describe("createAuditEmitter", () => {
  let captured: ReturnType<typeof captureLogger>;
  beforeEach(() => {
    captured = captureLogger();
  });

  it("emits structured AuditEventPayload with schemaVersion + ts + correlationId", async () => {
    const audit = createAuditEmitter({
      log: captured.log,
      now: () => Date.parse("2026-05-19T10:00:00Z"),
    });
    const app = new Hono();
    app.get("/probe", (c) => {
      c.set("correlationId", "test-cid");
      audit(c, {
        category: "auth",
        event: AUDIT_EVENTS.auth.LOGIN_SUCCESS,
        result: "success",
        resultCode: 200,
      });
      return c.text("ok");
    });
    await app.fetch(new Request("http://bff/probe", { headers: { "user-agent": "vitest" } }));
    expect(captured.lines).toHaveLength(1);
    const ev = captured.lines[0]!.auditEvent;
    expect(ev.schemaVersion).toBe("1.0");
    expect(ev.event).toBe("auth.login.success");
    expect(ev.correlationId).toBe("test-cid");
    expect(ev.ts).toBe("2026-05-19T10:00:00.000Z");
    expect((ev.request as Record<string, unknown>).userAgent).toBe("vitest");
  });

  it("samples session.heartbeat at 1:100 (deterministic via random override)", async () => {
    const audit = createAuditEmitter({ log: captured.log, random: () => 0.99 });
    const app = new Hono();
    app.get("/probe", (c) => {
      audit(c, {
        category: "auth",
        event: AUDIT_EVENTS.auth.SESSION_HEARTBEAT,
        result: "success",
      });
      return c.text("ok");
    });
    await app.fetch(new Request("http://bff/probe"));
    expect(captured.lines).toHaveLength(0);

    const audit2 = createAuditEmitter({ log: captured.log, random: () => 0.005 });
    const app2 = new Hono();
    app2.get("/probe", (c) => {
      audit2(c, {
        category: "auth",
        event: AUDIT_EVENTS.auth.SESSION_HEARTBEAT,
        result: "success",
      });
      return c.text("ok");
    });
    await app2.fetch(new Request("http://bff/probe"));
    expect(captured.lines).toHaveLength(1);
  });

  it("redacts secrets in details before emit", async () => {
    const audit = createAuditEmitter({ log: captured.log });
    const app = new Hono();
    app.get("/probe", (c) => {
      audit(c, {
        category: "data",
        event: AUDIT_EVENTS.data.write("in"),
        result: "success",
        details: { password: "leaky", recordId: "12345" },
      });
      return c.text("ok");
    });
    await app.fetch(new Request("http://bff/probe"));
    const ev = captured.lines[0]!.auditEvent;
    const details = ev.details as Record<string, unknown>;
    expect(details.password).toBe("[REDACTED]");
    expect(typeof details.recordId).toBe("string");
    expect(details.recordId).not.toBe("12345");
  });

  it("infers appOrigin=portal from Origin header", async () => {
    const audit = createAuditEmitter({ log: captured.log });
    const app = new Hono();
    app.get("/probe", (c) => {
      audit(c, {
        category: "auth",
        event: AUDIT_EVENTS.auth.LOGIN_SUCCESS,
        result: "success",
      });
      return c.text("ok");
    });
    await app.fetch(
      new Request("http://bff/probe", {
        headers: { Origin: "https://portal.example.com" },
      }),
    );
    const ev = captured.lines[0]!.auditEvent;
    expect((ev.request as Record<string, unknown>).appOrigin).toBe("portal");
  });
});
