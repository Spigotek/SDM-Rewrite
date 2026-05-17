import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

export type RunResult = "passed" | "failed" | "aborted";

export interface RunSummary {
  runId: string;
  scenario: string;
  result: RunResult;
  durationMs: number;
  passed: number;
  total: number;
  artifactsDir: string;
  consoleErrors: readonly string[];
  networkErrors: readonly string[];
  notes: string;
}

interface PlaywrightSuite {
  specs?: {
    tests?: { results?: { status: string; duration: number; error?: { message?: string } }[] }[];
  }[];
  suites?: PlaywrightSuite[];
}

interface PlaywrightReport {
  suites?: PlaywrightSuite[];
  stats?: {
    startTime?: string;
    duration?: number;
    expected?: number;
    unexpected?: number;
    flaky?: number;
    skipped?: number;
  };
}

function flatten(
  suite: PlaywrightSuite,
  acc: { passed: number; failed: number; durationMs: number; errors: string[] },
): void {
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests ?? []) {
      for (const r of t.results ?? []) {
        acc.durationMs += r.duration;
        if (r.status === "passed") acc.passed += 1;
        else acc.failed += 1;
        if (r.error?.message) acc.errors.push(r.error.message.split("\n")[0] ?? "");
      }
    }
  }
  for (const child of suite.suites ?? []) flatten(child, acc);
}

export function parsePlaywrightReport(reportPath: string): {
  passed: number;
  failed: number;
  durationMs: number;
  errors: string[];
} {
  if (!existsSync(reportPath)) return { passed: 0, failed: 0, durationMs: 0, errors: [] };
  const raw = readFileSync(reportPath, "utf8");
  const report = JSON.parse(raw) as PlaywrightReport;
  const acc = { passed: 0, failed: 0, durationMs: 0, errors: [] as string[] };
  for (const s of report.suites ?? []) flatten(s, acc);
  if (acc.passed === 0 && acc.failed === 0 && report.stats) {
    acc.passed = report.stats.expected ?? 0;
    acc.failed = report.stats.unexpected ?? 0;
    acc.durationMs = report.stats.duration ?? 0;
  }
  return acc;
}

export function writeSummary(runDir: string, summary: RunSummary): void {
  const lines: string[] = [];
  lines.push(`**Run:** ${summary.runId}`);
  lines.push(`**Scenario:** ${summary.scenario}`);
  lines.push(`**Result:** ${summary.result}`);
  lines.push(`**Duration:** ${summary.durationMs}`);
  lines.push(`**Assertions:** ${summary.passed}/${summary.total}`);
  lines.push(`**Artifacts:** ${summary.artifactsDir}`);
  if (summary.consoleErrors.length > 0) {
    lines.push(`**Console errors:** ${summary.consoleErrors.length}`);
    for (const e of summary.consoleErrors.slice(0, 3)) lines.push(`  - ${truncate(e, 200)}`);
  }
  if (summary.networkErrors.length > 0) {
    lines.push(`**Network errors:** ${summary.networkErrors.length}`);
    for (const e of summary.networkErrors.slice(0, 3)) lines.push(`  - ${truncate(e, 200)}`);
  }
  lines.push(`**Notes:** ${truncate(summary.notes, 800)}`);
  writeFileSync(path.join(runDir, "summary.md"), lines.join("\n") + "\n");
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export function readConsoleErrors(consoleLogPath: string): string[] {
  if (!existsSync(consoleLogPath)) return [];
  return readFileSync(consoleLogPath, "utf8")
    .split("\n")
    .filter((l) => l.startsWith("ERROR\t"))
    .map((l) => l.slice("ERROR\t".length));
}

export function readNetworkErrors(networkLogPath: string): string[] {
  if (!existsSync(networkLogPath)) return [];
  return readFileSync(networkLogPath, "utf8")
    .split("\n")
    .filter((l) => l.length > 0);
}
