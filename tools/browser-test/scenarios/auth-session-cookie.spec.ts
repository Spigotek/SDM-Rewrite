import { test, expect } from "../fixtures/isolated-context";

// Note: this scenario validates the BFF auth contract as served by MSW.
// It intentionally does NOT assert that the Set-Cookie response header
// from a service-worker-synthesised response is persisted into the
// document cookie store — Chrome does not always honour Set-Cookie on
// SW-generated responses, and the real cookie lifecycle belongs to the
// production BFF (Phase F). Cookie persistence is therefore out of scope
// for the mock-layer test.
test("/auth/login + /auth/logout contract (MSW handlers)", async ({ isolatedPage }) => {
  await isolatedPage.goto("/");
  await expect(isolatedPage.getByTestId("top-bar")).toBeVisible({ timeout: 15_000 });

  const result = await isolatedPage.evaluate(async () => {
    const login = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "anna.analyst", password: "x", tenantId: "globex" }),
    });
    const loginBody = login.ok
      ? ((await login.json()) as { user: { id: string }; session: { activeTenantId: string } })
      : null;

    const badLogin = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const logout = await fetch("/auth/logout", { method: "POST" });
    return {
      loginStatus: login.status,
      loginUserId: loginBody?.user.id,
      loginTenant: loginBody?.session.activeTenantId,
      badLoginStatus: badLogin.status,
      logoutStatus: logout.status,
    };
  });

  expect(result.loginStatus).toBe(200);
  expect(result.loginUserId).toBe("user-1");
  expect(result.loginTenant).toBe("globex");
  expect(result.badLoginStatus).toBe(400);
  expect(result.logoutStatus).toBe(200);
});
