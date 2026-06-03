import { test as base, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

interface IsolatedFixtures {
  isolatedPage: Page;
  /**
   * I.4 — opt-in MSW persona helper. Returns a Page hydrated with the
   * `x-msw-user-id` header set to the requested user id (e.g. `user-7`
   * for `kb_editor_jana`). The MSW handlers in `users.ts` honour the
   * header so `/me`, `/whoami`, and active-tenant resolution use the
   * impersonated user. Defaults to `user-7` (Jana) when no id is passed.
   */
  isolatedPageAs: (userId?: string) => Promise<Page>;
}

const runId = process.env["SDM_BROWSER_TEST_RUN_ID"];
const runDir = runId ? path.resolve(process.cwd(), ".playwright", "runs", runId) : null;

if (runDir) mkdirSync(runDir, { recursive: true });

function logLine(file: string, line: string): void {
  if (!runDir) return;
  appendFileSync(path.join(runDir, file), line + "\n");
}

async function buildContext(
  browser: Browser,
  extraHeaders: Record<string, string>,
): Promise<{ context: BrowserContext; page: Page }> {
  const headers: Record<string, string> = { ...extraHeaders };
  const tenant = process.env["SDM_BROWSER_TEST_TENANT"];
  if (tenant && !headers["X-CA-SDM-Tenant"]) headers["X-CA-SDM-Tenant"] = tenant;
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

  return { context, page };
}

export const test = base.extend<IsolatedFixtures>({
  isolatedPage: async ({ browser }, use, testInfo) => {
    const { context, page } = await buildContext(browser, {});
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
    await context.close();
    void testInfo.title;
  },
  isolatedPageAs: async ({ browser }, use) => {
    const cleanup: Array<() => Promise<void>> = [];
    const factory = async (userId?: string) => {
      const headers: Record<string, string> = {};
      headers["x-msw-user-id"] = userId ?? "user-7"; // Jana / kb_editor default
      const { context, page } = await buildContext(browser, headers);
      cleanup.push(() => context.close());
      return page;
    };
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(factory);
    for (const fn of cleanup) await fn();
  },
});

export { expect } from "@playwright/test";
