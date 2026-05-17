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
    ...devices["Desktop Chrome"],
  },
});
