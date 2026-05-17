import { readdirSync, statSync, rmSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), ".playwright", "runs");
const MAX_AGE_DAYS = 7;
const MAX_AGE_MS = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

function main(): void {
  let removed = 0;
  let kept = 0;
  let dirs: string[];
  try {
    dirs = readdirSync(ROOT);
  } catch {
    process.stdout.write(`(no runs at ${ROOT})\n`);
    return;
  }
  const now = Date.now();
  for (const name of dirs) {
    const full = path.join(ROOT, name);
    try {
      const st = statSync(full);
      if (!st.isDirectory()) continue;
      if (now - st.mtimeMs > MAX_AGE_MS) {
        rmSync(full, { recursive: true, force: true });
        removed += 1;
      } else {
        kept += 1;
      }
    } catch {
      // ignore
    }
  }
  process.stdout.write(`pruned ${removed} run(s) older than ${MAX_AGE_DAYS} days; kept ${kept}\n`);
}

main();
