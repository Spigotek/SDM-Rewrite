import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * I.6 — live-mode Playwright config used by `scripts/release-dry-run.sh` and
 * `.github/workflows/acceptance-live.yml`. Differs from the default MSW
 * config (`playwright.config.ts`) in three deliberate ways:
 *
 * 1. **Chromium only** — live runs hit a real BFF + CA SDM 17.4, so the
 *    incremental signal from Firefox/WebKit doesn't justify ×3 cluster load.
 *    Vendor-specific regressions are already caught by the MSW acceptance
 *    matrix on every PR.
 * 2. **10 s expect timeout** — base config already uses 10 s; we keep the
 *    same envelope but bump the spec-level `timeout` to 90 s to absorb
 *    real-backend round-trip variance.
 * 3. **`retries: 1`** — single retry to absorb transient flake from the
 *    on-prem CA SDM under shared load. Two failures still mark a journey
 *    red; the goal is to suppress one-off network blips, not mask bugs.
 */

const runId = process.env["SDM_BROWSER_TEST_RUN_ID"];
if (!runId) throw new Error("SDM_BROWSER_TEST_RUN_ID env var required");

const configDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(configDir, "..", "..");
const outDir = path.join(repoRoot, ".playwright", "runs", runId);

const baseURL =
  process.env["BASE_URL"] ??
  process.env["SDM_BROWSER_TEST_BASE_URL"] ??
  "https://sdm-staging.example.com";

const rawTimeout = Number(process.env["SDM_BROWSER_TEST_MAX_DURATION_MS"] ?? "90000");
const timeout = Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : 90_000;

export default defineConfig({
  testDir: "./scenarios",
  outputDir: path.join(outDir, "output"),
  timeout,
  expect: { timeout: 10_000 },
  workers: 2,
  fullyParallel: false,
  retries: 1,
  reporter: [
    ["list"],
    ["json", { outputFile: path.join(outDir, "report.json") }],
    ["html", { outputFolder: path.join(outDir, "html"), open: "never" }],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
