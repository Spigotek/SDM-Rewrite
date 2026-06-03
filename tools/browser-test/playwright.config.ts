import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const runId = process.env["SDM_BROWSER_TEST_RUN_ID"];
if (!runId) throw new Error("SDM_BROWSER_TEST_RUN_ID env var required");

const configDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(configDir, "..", "..");
const outDir = path.join(repoRoot, ".playwright", "runs", runId);

const rawTimeout = Number(process.env["SDM_BROWSER_TEST_MAX_DURATION_MS"] ?? "60000");
const timeout = Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : 60_000;

/**
 * I.2 — multi-browser projects matrix: chromium + firefox + webkit. CI selects
 * via `--project=<name>` per matrix entry; local dev defaults to chromium for
 * speed. axe-core sweeps run on chromium only (axe is browser-agnostic; ×3
 * wastes CI minutes without surfacing additional signal). Per-spec
 * `test.skip(({ browserName }) => …)` is the escape hatch when a journey
 * genuinely needs to skip a vendor (none today).
 */
export default defineConfig({
  testDir: "./scenarios",
  outputDir: path.join(outDir, "output"),
  timeout,
  expect: { timeout: 10_000 },
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: path.join(outDir, "report.json") }]],
  use: {
    baseURL: process.env["SDM_BROWSER_TEST_BASE_URL"] ?? "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
