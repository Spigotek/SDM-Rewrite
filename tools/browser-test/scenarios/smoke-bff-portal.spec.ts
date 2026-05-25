import { test, expect } from "../fixtures/isolated-context";

// Manual scenario — requires a live BFF on 5174 + reachable CA SDM upstream.
// Run via:
//   VITE_USE_MOCKS=false pnpm --filter @sdm/portal dev
//   pnpm --filter @sdm/bff dev
//   SDM_BFF_SMOKE_USER=... SDM_BFF_SMOKE_PASS=... \
//     SDM_BROWSER_TEST_BASE_URL=http://localhost:5173 \
//     pnpm --filter @sdm/tools-browser-test exec ts-node runner.ts smoke-bff-portal
// Credentials never live in the repo per project policy.

const username = process.env["SDM_BFF_SMOKE_USER"];
const password = process.env["SDM_BFF_SMOKE_PASS"];

test.describe("BFF mode smoke (portal)", () => {
  test.skip(
    !username || !password,
    "Set SDM_BFF_SMOKE_USER + SDM_BFF_SMOKE_PASS to run against a live BFF.",
  );

  test("login → /me → logout cycle (real BFF)", async ({ isolatedPage }) => {
    await isolatedPage.goto("/");
    await expect(isolatedPage.getByTestId("login-page")).toBeVisible({ timeout: 15_000 });

    await isolatedPage.getByTestId("login-username").fill(username!);
    await isolatedPage.getByTestId("login-password").fill(password!);
    await isolatedPage.getByTestId("login-submit").click();

    await expect(isolatedPage.getByTestId("user-pill")).toBeVisible({ timeout: 20_000 });
    await expect(isolatedPage.getByTestId("active-tenant")).toBeVisible();

    await isolatedPage.getByTestId("logout-button").click();
    await expect(isolatedPage.getByTestId("login-page")).toBeVisible({ timeout: 10_000 });
  });
});
