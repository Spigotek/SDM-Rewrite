import type { Hono } from "hono";
import { hasPermission, type Permission, type UIRole } from "@sdm/domain";
import { AppErrorException } from "../../auth/errors";
import { requireActiveSession } from "../../session/load";
import type { SessionPayload } from "../../session/types";
import type { RestProxyDeps } from "../rest-proxy";

/**
 * I.4 — KB analytics dashboard endpoint. Read-only, no audit emission
 * (analytics ≠ data mutation per F.4 §3 sampling rules).
 *
 * The data source is **fixture-backed** today — CA SDM doesn't expose
 * a KB-analytics endpoint, so the BFF + MSW return identical synthetic
 * snapshots. When the real ingest pipeline lands (post-v1.0), the
 * handler signature stays the same; only the data source swaps.
 *
 * Permission gate: `kb.analytics` (same key the FE `<RouteGuard>` uses,
 * server-side defense in depth).
 */

function rolesOf(session: SessionPayload): readonly UIRole[] {
  const active = session.tenants.find((t) => t.id === session.activeTenantId);
  return active ? active.roles.map((r) => r.uiRole) : [];
}

function requirePermission(session: SessionPayload, permission: Permission): void {
  if (!hasPermission(rolesOf(session), permission)) {
    throw new AppErrorException({
      code: "AUTH_FORBIDDEN",
      httpStatus: 403,
      message: `permission ${permission} required`,
    });
  }
}

interface AnalyticsSnapshot {
  range: "7d" | "30d" | "90d";
  top: Array<{ id: string; title: string; views: number }>;
  bottom: Array<{ id: string; title: string; helpfulnessRatio: number | null; views: number }>;
  searchMiss: Array<{ query: string; hits: number }>;
}

function fixtureSnapshot(range: "7d" | "30d" | "90d"): AnalyticsSnapshot {
  const multiplier = range === "7d" ? 1 : range === "30d" ? 4 : 12;
  return {
    range,
    top: [
      { id: "kb:50000", title: "Reset VPN klienta", views: 1247 * multiplier },
      { id: "kb:50001", title: "Pripojenie na firemnú VPN", views: 893 * multiplier },
      { id: "kb:50002", title: "Outlook offline mode", views: 712 * multiplier },
      { id: "kb:50003", title: "MFA setup", views: 654 * multiplier },
      { id: "kb:50004", title: "Password reset", views: 521 * multiplier },
      { id: "kb:50005", title: "Wifi enterprise login", views: 410 * multiplier },
      { id: "kb:50006", title: "Printer setup", views: 387 * multiplier },
      { id: "kb:50007", title: "Známe problémy VPN klienta v5", views: 290 * multiplier },
      { id: "kb:50008", title: "Office 365 reinstall", views: 245 * multiplier },
      { id: "kb:50009", title: "Disk space cleanup", views: 198 * multiplier },
    ],
    bottom: [
      {
        id: "kb:50020",
        title: "Legacy IE6 fallback",
        helpfulnessRatio: 0.12,
        views: 84 * multiplier,
      },
      {
        id: "kb:50021",
        title: "On-prem CRM migration",
        helpfulnessRatio: 0.21,
        views: 67 * multiplier,
      },
      {
        id: "kb:50022",
        title: "DOS prompt cheatsheet",
        helpfulnessRatio: 0.18,
        views: 55 * multiplier,
      },
      {
        id: "kb:50023",
        title: "Floppy disk recovery",
        helpfulnessRatio: 0.09,
        views: 42 * multiplier,
      },
      { id: "kb:50024", title: "Token ring config", helpfulnessRatio: null, views: 3 * multiplier },
    ],
    searchMiss: [
      { query: "vpn nefunguje", hits: 42 * multiplier },
      { query: "teams crash", hits: 31 * multiplier },
      { query: "macbook pro vpn", hits: 28 * multiplier },
      { query: "outlook ssl error", hits: 19 * multiplier },
      { query: "sso slow", hits: 14 * multiplier },
    ],
  };
}

export function registerKbAnalyticsRoutes(app: Hono, deps: RestProxyDeps): void {
  app.get("/api/kb/analytics", async (c) => {
    const session = await requireActiveSession(c, deps);
    requirePermission(session, "kb.analytics");
    const url = new URL(c.req.url);
    const rangeRaw = url.searchParams.get("range") ?? "30d";
    const range: "7d" | "30d" | "90d" = rangeRaw === "7d" || rangeRaw === "90d" ? rangeRaw : "30d";
    return c.json(fixtureSnapshot(range));
  });
}
