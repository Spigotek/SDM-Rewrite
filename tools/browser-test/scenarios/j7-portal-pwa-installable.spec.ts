import { test, expect } from "@playwright/test";

/**
 * J.7 — portal PWA installability browser specs.
 *
 * These tests run against the **built + previewed** portal (not `vite dev`).
 * `VITE_USE_MOCKS` must be unset or "false" so Workbox SW registration fires.
 * Playwright base URL should point at `pnpm --filter @sdm/portal preview`
 * (default http://localhost:5173).
 *
 * Three cases:
 *  1. Manifest reachable — `GET /manifest.webmanifest` returns 200 + valid JSON.
 *  2. Service worker registered — after first load, navigator.serviceWorker
 *     has a registration with scope "/".
 *  3. Offline navigation — `page.context().setOffline(true)`, navigate to "/",
 *     expect precached shell renders (no browser error page).
 */

test.describe("@J7 portal PWA installable", () => {
  test("manifest.webmanifest is reachable and contains required fields", async ({ page }) => {
    const baseURL =
      page.context().browser()?.contexts()[0]?.pages()[0]?.url() ?? "http://localhost:5173";
    const origin = process.env["SDM_BROWSER_TEST_BASE_URL"] ?? "http://localhost:5173";

    const response = await page.request.get(`${origin}/manifest.webmanifest`);
    expect(response.status()).toBe(200);

    const manifest = (await response.json()) as Record<string, unknown>;

    expect(typeof manifest["name"]).toBe("string");
    expect((manifest["name"] as string).length).toBeGreaterThan(0);

    expect(typeof manifest["start_url"]).toBe("string");

    const icons = manifest["icons"];
    expect(Array.isArray(icons)).toBe(true);
    expect((icons as unknown[]).length).toBeGreaterThan(0);

    // Verify at least a 192 and 512 icon are declared.
    const sizes = (icons as Array<{ sizes: string }>).map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");

    void baseURL; // suppress unused warning
  });

  test("service worker is registered with scope '/' after first portal load", async ({
    page,
    context,
  }) => {
    // First navigation — allows the SW to install.
    await page.goto("/", { waitUntil: "networkidle" });

    // Give SW install/activate time to complete.
    await page.waitForTimeout(2_000);

    const registration = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return null;
      const reg = await navigator.serviceWorker.getRegistration("/");
      if (!reg) return null;
      return { scope: reg.scope };
    });

    expect(registration).not.toBeNull();
    // scope ends with "/" (full origin form: "http://localhost:5173/")
    expect(registration!.scope).toMatch(/\/$/);

    void context; // suppress unused warning
  });

  test("offline navigation serves precached shell (no browser error page)", async ({
    page,
    context,
  }) => {
    // First load online — seeds the precache.
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForTimeout(2_500);

    // Go offline.
    await context.setOffline(true);

    // Navigate to "/" — should fall back to the precached index.html, NOT show a browser error.
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });

    // When served from the SW cache the navigation resolves with 200.
    // When the SW falls back to the network the status is null (SW-served) or 200.
    // What we must NOT see is a browser ERR_INTERNET_DISCONNECTED page.
    const isErrorPage = await page.evaluate(
      () =>
        document.documentElement.innerHTML.includes("ERR_INTERNET_DISCONNECTED") ||
        document.documentElement.innerHTML.includes("ERR_NETWORK_CHANGED") ||
        document.title === "No internet",
    );
    expect(isErrorPage).toBe(false);

    // The portal root element must be present (even if React hasn't mounted yet).
    const rootExists = await page.locator("#root").count();
    expect(rootExists).toBeGreaterThan(0);

    void response;

    // Restore online state for cleanup.
    await context.setOffline(false);
  });
});
