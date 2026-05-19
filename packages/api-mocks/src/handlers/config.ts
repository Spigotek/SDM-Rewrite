import { http, HttpResponse } from "msw";

// Mocked /config endpoint per docs/agents/devex-devops/runtime-config.md.
// Shape matches the canonical RuntimeConfigSchema served by BFF (apps/bff/src/platform/config/types.ts).
export const configHandlers = [
  http.get("*/config", () =>
    HttpResponse.json({
      apiBaseUrl: "http://localhost:5173",
      apiBasePath: "/api",
      auth: {
        mode: "rest-access-key",
        bffOrigin: "http://localhost:5174",
        restAccessKeyEndpoint: "/caisd-rest/rest_access",
      },
      tenants: {
        defaultMode: "user-profile",
        tenantContextHeader: "X-CA-SDM-Tenant",
        allowSwitching: true,
      },
      features: {
        kbEditor: true,
        cmdbVisualizer: true,
        bulkOperations: false,
        changeCalendar: false,
        reportingWidgets: false,
      },
      observability: {
        rumEnabled: false,
      },
      meta: {
        appVersion: "0.0.0-mock",
        buildId: "mock",
        deployedAt: new Date().toISOString(),
      },
    }),
  ),
];
