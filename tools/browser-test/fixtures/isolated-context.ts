import { test as base, type Page } from "@playwright/test";
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

interface IsolatedFixtures {
  isolatedPage: Page;
}

const runId = process.env["SDM_BROWSER_TEST_RUN_ID"];
const runDir = runId ? path.resolve(process.cwd(), ".playwright", "runs", runId) : null;

if (runDir) mkdirSync(runDir, { recursive: true });

function logLine(file: string, line: string): void {
  if (!runDir) return;
  appendFileSync(path.join(runDir, file), line + "\n");
}

export const test = base.extend<IsolatedFixtures>({
  isolatedPage: async ({ browser }, use, testInfo) => {
    const headers: Record<string, string> = {};
    const tenant = process.env["SDM_BROWSER_TEST_TENANT"];
    if (tenant) headers["X-CA-SDM-Tenant"] = tenant;

    const contextOptions: NonNullable<Parameters<typeof browser.newContext>[0]> = {
      serviceWorkers: "allow",
    };
    if (Object.keys(headers).length > 0) contextOptions.extraHTTPHeaders = headers;
    const context = await browser.newContext(contextOptions);

    const page = await context.newPage();

    page.on("console", (msg) => {
      const level = msg.type().toUpperCase();
      if (level === "ERROR" || level === "WARNING") {
        logLine("console.log", `${level}\t${msg.text()}`);
      }
    });

    page.on("pageerror", (err) => {
      logLine("console.log", `ERROR\tuncaught: ${err.message}`);
    });

    page.on("requestfailed", (req) => {
      const failure = req.failure();
      logLine("network.log", `${req.method()}\t${req.url()}\t${failure?.errorText ?? "failed"}`);
    });

    page.on("response", (resp) => {
      if (resp.status() >= 400) {
        logLine("network.log", `${resp.request().method()}\t${resp.url()}\t${resp.status()}`);
      }
    });

    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
    await context.close();

    // touch testInfo to keep TS happy under noUnusedParameters
    void testInfo.title;
  },
});

export { expect } from "@playwright/test";
