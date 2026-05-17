import { http, HttpResponse } from "msw";

// Mocked /config endpoint per docs/agents/devex-devops/runtime-config.md.
// Real BFF will serve runtime feature flags here; mock returns a stable shape
// so the App Shell (Phase E.3) can rely on it.
export const configHandlers = [
  http.get("*/config", () =>
    HttpResponse.json({
      apiBaseUrl: "/api",
      authMode: "mock",
      features: {
        enableTenantSwitcher: true,
        enableKbSearch: true,
        enableAuditViewer: true,
      },
      release: {
        version: "0.0.0-mock",
        buildSha: "mock",
      },
    }),
  ),
];
