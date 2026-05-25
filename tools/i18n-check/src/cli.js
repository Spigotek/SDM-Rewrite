#!/usr/bin/env node
/**
 * `pnpm i18n:check` — CI gate enforcing SK ↔ EN catalog parity.
 *
 * Pure-Node stdlib (no transpile). Runs against `packages/i18n/catalogs/`
 * a checkuje shared + portal + workspace namespaces. Exits 1 on any
 * symmetric-diff mismatch.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../..");
const CATALOGS_ROOT = resolve(REPO_ROOT, "packages/i18n/catalogs");
const NAMESPACES = ["shared", "portal", "workspace"];

function collectKeys(obj, prefix = "") {
  const out = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix === "" ? key : `${prefix}.${key}`;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      out.push(...collectKeys(value, path));
    } else {
      out.push(path);
    }
  }
  return out.sort();
}

function loadCatalog(absPath) {
  return JSON.parse(readFileSync(absPath, "utf8"));
}

function diff(sk, en) {
  const skKeys = new Set(collectKeys(sk));
  const enKeys = new Set(collectKeys(en));
  const onlyInSk = [...skKeys].filter((k) => !enKeys.has(k)).sort();
  const onlyInEn = [...enKeys].filter((k) => !skKeys.has(k)).sort();
  return { onlyInSk, onlyInEn };
}

let hasMismatch = false;

console.log(`[i18n-check] catalogs root: ${CATALOGS_ROOT}`);

for (const ns of NAMESPACES) {
  const skPath = resolve(CATALOGS_ROOT, ns, "sk.json");
  const enPath = resolve(CATALOGS_ROOT, ns, "en.json");
  let sk;
  let en;
  try {
    sk = loadCatalog(skPath);
    en = loadCatalog(enPath);
  } catch (err) {
    console.error(`[i18n-check] failed to read ${ns} catalog: ${err.message}`);
    process.exit(1);
  }
  const result = diff(sk, en);
  const skCount = collectKeys(sk).length;
  if (result.onlyInSk.length === 0 && result.onlyInEn.length === 0) {
    console.log(`[i18n-check] ${ns}: OK (${skCount} keys)`);
  } else {
    hasMismatch = true;
    console.error(`[i18n-check] ${ns}: MISMATCH`);
    if (result.onlyInSk.length > 0) {
      console.error(`  Only in sk.json (${result.onlyInSk.length}):`);
      for (const k of result.onlyInSk) console.error(`    + ${k}`);
    }
    if (result.onlyInEn.length > 0) {
      console.error(`  Only in en.json (${result.onlyInEn.length}):`);
      for (const k of result.onlyInEn) console.error(`    + ${k}`);
    }
  }
}

if (hasMismatch) {
  console.error("[i18n-check] FAIL — fix key parity before merging.");
  process.exit(1);
}

console.log("[i18n-check] PASS — all catalogs in sync.");
