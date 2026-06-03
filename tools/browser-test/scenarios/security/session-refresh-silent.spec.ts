import { test, expect } from "../../fixtures/isolated-context";

/**
 * I.2 — silent session-loss handling (I.1 territory verification).
 *
 * `acceptance-criteria.md §4.1` `session-refresh`: the SPA must observe
 * 401 responses (heartbeat or any fetch) without crashing or leaving the
 * UI in a half-loaded state. I.1 wired the `sdm:session-lost` window
 * event as the canonical signal: `<SessionProvider>` listens for it and
 * drops `status` to `"anonymous"`, clearing the in-memory session.
 *
 * This test fires the event from the page context (simulating what
 * `<HeartbeatProbe>` would dispatch on a 401 heartbeat) and asserts the
 * UI transitions out of the authenticated shell. The intent is to pin the
 * current observable behaviour — re-auth modal trigger is explicitly
 * deferred (per I.1.md), so we assert "the UI drops to anonymous"
 * rather than "a modal opens".
 *
 * Runs on chromium only.
 */

test.describe("@security silent session refresh", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "session loss event test");

  test("sdm:session-lost event drops the shell out of `ready` state", async ({ isolatedPage }) => {
    await isolatedPage.goto("/");
    await isolatedPage.getByTestId("top-bar").waitFor({ timeout: 20_000 });
    await isolatedPage.getByTestId("user-pill").waitFor({ timeout: 20_000 });

    await isolatedPage.evaluate(() => {
      window.dispatchEvent(new Event("sdm:session-lost"));
    });

    // The `<TopBar>` only renders the user pill when status === "ready"
    // (see `top-bar.tsx`). After the event the provider sets
    // `status = "anonymous"` and the pill unmounts.
    await expect(isolatedPage.getByTestId("user-pill")).toBeHidden({ timeout: 5_000 });
  });
});
