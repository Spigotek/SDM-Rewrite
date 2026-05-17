import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isValidRunId, newRunId, runArtifact, runDir } from "./lib/run-id.js";
import {
  parsePlaywrightReport,
  readConsoleErrors,
  readNetworkErrors,
  writeSummary,
  type RunSummary,
} from "./lib/summary.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");

interface Args {
  runId?: string;
  scenario: string;
  baseUrl: string;
  tenantId?: string;
  maxDurationMs?: number;
  adHocSpecPath?: string;
}

const KNOWN_SCENARIOS: Record<string, string> = {
  "smoke.portal": "scenarios/smoke-portal.spec.ts",
  "smoke.workspace": "scenarios/smoke-workspace.spec.ts",
  "mocks.tenant-isolation": "scenarios/mocks-tenant-isolation.spec.ts",
  "mocks.mutation-roundtrip": "scenarios/mocks-mutation-roundtrip.spec.ts",
  "auth.session-cookie": "scenarios/auth-session-cookie.spec.ts",
  "ad-hoc": "ad-hoc-placeholder",
};

function parseArgs(): Args {
  const argv = process.argv.slice(2).filter((a) => a !== "--");
  const out: Record<string, string | number | undefined> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    const eq = a.indexOf("=");
    const [flag, valFromEq] = eq > 0 ? [a.slice(0, eq), a.slice(eq + 1)] : [a, undefined];
    const next = valFromEq ?? argv[++i];
    if (flag === "--run-id") out["runId"] = next;
    else if (flag === "--scenario") out["scenario"] = next;
    else if (flag === "--base-url") out["baseUrl"] = next;
    else if (flag === "--tenant-id") out["tenantId"] = next;
    else if (flag === "--max-duration-ms") out["maxDurationMs"] = Number(next);
    else if (flag === "--ad-hoc-spec") out["adHocSpecPath"] = next;
  }
  if (!out["scenario"] || typeof out["scenario"] !== "string") bail("missing --scenario");
  const baseUrl = (typeof out["baseUrl"] === "string" && out["baseUrl"]) || "http://localhost:5173";
  const result: Args = {
    scenario: out["scenario"] as string,
    baseUrl,
  };
  if (typeof out["runId"] === "string") result.runId = out["runId"];
  if (typeof out["tenantId"] === "string") result.tenantId = out["tenantId"];
  if (typeof out["maxDurationMs"] === "number" && Number.isFinite(out["maxDurationMs"])) {
    result.maxDurationMs = out["maxDurationMs"];
  }
  if (typeof out["adHocSpecPath"] === "string") result.adHocSpecPath = out["adHocSpecPath"];
  return result;
}

function bail(message: string, runIdForSummary?: string): never {
  process.stderr.write(`browser-test: ${message}\n`);
  if (runIdForSummary) {
    const dir = runDir(REPO_ROOT, runIdForSummary);
    if (existsSync(dir)) {
      writeSummary(dir, {
        runId: runIdForSummary,
        scenario: process.env["SDM_BROWSER_TEST_SCENARIO"] ?? "(unknown)",
        result: "aborted",
        durationMs: 0,
        passed: 0,
        total: 0,
        artifactsDir: path.relative(REPO_ROOT, dir),
        consoleErrors: [],
        networkErrors: [],
        notes: message,
      });
    }
  }
  process.exit(2);
}

function healthCheck(baseUrl: string): boolean {
  const r = spawnSync("curl", ["-fsI", `${baseUrl}/`], { stdio: "pipe" });
  return r.status === 0;
}

function workerCheck(baseUrl: string): boolean {
  const r = spawnSync("curl", ["-fsI", `${baseUrl}/mockServiceWorker.js`], { stdio: "pipe" });
  return r.status === 0;
}

function main(): void {
  const args = parseArgs();
  const runId = args.runId ?? newRunId();
  if (!isValidRunId(runId)) bail(`invalid runId ${runId} (expected 6-hex)`);

  const dir = runDir(REPO_ROOT, runId);
  if (existsSync(dir)) bail(`run directory ${dir} already exists`);
  mkdirSync(dir, { recursive: true });

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    SDM_BROWSER_TEST_RUN_ID: runId,
    SDM_BROWSER_TEST_BASE_URL: args.baseUrl,
    SDM_BROWSER_TEST_SCENARIO: args.scenario,
  };
  if (args.tenantId) env["SDM_BROWSER_TEST_TENANT"] = args.tenantId;
  if (args.maxDurationMs) env["SDM_BROWSER_TEST_MAX_DURATION_MS"] = String(args.maxDurationMs);

  // Pre-flight
  if (!healthCheck(args.baseUrl)) {
    writeSummary(dir, {
      runId,
      scenario: args.scenario,
      result: "aborted",
      durationMs: 0,
      passed: 0,
      total: 0,
      artifactsDir: path.relative(REPO_ROOT, dir),
      consoleErrors: [],
      networkErrors: [],
      notes: `dev server not reachable at ${args.baseUrl} — start \`pnpm dev\` first`,
    });
    emit(dir);
    process.exit(2);
  }
  if (!workerCheck(args.baseUrl)) {
    writeSummary(dir, {
      runId,
      scenario: args.scenario,
      result: "aborted",
      durationMs: 0,
      passed: 0,
      total: 0,
      artifactsDir: path.relative(REPO_ROOT, dir),
      consoleErrors: [],
      networkErrors: [],
      notes: `mockServiceWorker.js not reachable at ${args.baseUrl}/mockServiceWorker.js — run \`pnpm exec msw init\``,
    });
    emit(dir);
    process.exit(2);
  }

  // Resolve scenario file
  const scenarioPath = resolveScenario(args, dir, runId);
  if (!scenarioPath) {
    writeSummary(dir, {
      runId,
      scenario: args.scenario,
      result: "aborted",
      durationMs: 0,
      passed: 0,
      total: 0,
      artifactsDir: path.relative(REPO_ROOT, dir),
      consoleErrors: [],
      networkErrors: [],
      notes: `unknown scenario "${args.scenario}" (known: ${Object.keys(KNOWN_SCENARIOS).join(", ")})`,
    });
    emit(dir);
    process.exit(2);
  }

  // Run Playwright
  const startedAt = Date.now();
  const playwright = spawnSync(
    "pnpm",
    ["exec", "playwright", "test", scenarioPath, "--config=playwright.config.ts"],
    { cwd: __dirname, env, stdio: "inherit" },
  );
  const elapsed = Date.now() - startedAt;

  const reportPath = runArtifact(REPO_ROOT, runId, "report.json");
  const parsed = parsePlaywrightReport(reportPath);

  const consoleErrors = readConsoleErrors(runArtifact(REPO_ROOT, runId, "console.log"));
  const networkErrors = readNetworkErrors(runArtifact(REPO_ROOT, runId, "network.log"));

  const total = parsed.passed + parsed.failed;
  const result: RunSummary["result"] =
    playwright.status === 0 && parsed.failed === 0 ? "passed" : "failed";

  const notes = buildNotes({ result, elapsed, parsed });

  writeSummary(dir, {
    runId,
    scenario: args.scenario,
    result,
    durationMs: parsed.durationMs > 0 ? parsed.durationMs : elapsed,
    passed: parsed.passed,
    total,
    artifactsDir: path.relative(REPO_ROOT, dir),
    consoleErrors,
    networkErrors,
    notes,
  });
  emit(dir);
  process.exit(result === "passed" ? 0 : 1);
}

function buildNotes({
  result,
  elapsed,
  parsed,
}: {
  result: RunSummary["result"];
  elapsed: number;
  parsed: { passed: number; failed: number; errors: string[] };
}): string {
  if (result === "passed") return "all assertions passed";
  const flake = parsed.failed > 0 && elapsed < 5_000 ? " (suspected-flake: very short run)" : "";
  const firstErr = parsed.errors[0] ?? "";
  return `${parsed.failed} failed${flake}; first error: ${firstErr}`.slice(0, 800);
}

function resolveScenario(args: Args, dir: string, runId: string): string | null {
  if (args.scenario !== "ad-hoc") {
    const rel = KNOWN_SCENARIOS[args.scenario];
    if (!rel) return null;
    return rel;
  }
  // ad-hoc: copy caller-provided snippet path or expect default location
  const source = args.adHocSpecPath ?? path.join(dir, "ad-hoc.spec.ts");
  if (!existsSync(source)) return null;
  // Stage ad-hoc spec under scenarios/ so Playwright config picks it up
  const staged = path.join(__dirname, "scenarios", `ad-hoc-${runId}.spec.ts`);
  copyFileSync(source, staged);
  // Best-effort cleanup at exit
  process.on("exit", () => {
    try {
      rmSync(staged, { force: true });
    } catch {
      /* ignore */
    }
  });
  return path.relative(__dirname, staged);
}

function emit(dir: string): void {
  const summaryPath = path.join(dir, "summary.md");
  if (!existsSync(summaryPath)) return;
  process.stdout.write(readFileSync(summaryPath, "utf8"));
}

main();
