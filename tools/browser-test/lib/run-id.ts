import { randomBytes } from "node:crypto";
import path from "node:path";

const RUN_ID_RE = /^[0-9a-f]{6}$/;

export function newRunId(): string {
  return randomBytes(3).toString("hex");
}

export function isValidRunId(id: string): boolean {
  return RUN_ID_RE.test(id);
}

export function runDir(repoRoot: string, runId: string): string {
  return path.join(repoRoot, ".playwright", "runs", runId);
}

export function runArtifact(repoRoot: string, runId: string, ...parts: string[]): string {
  return path.join(runDir(repoRoot, runId), ...parts);
}
