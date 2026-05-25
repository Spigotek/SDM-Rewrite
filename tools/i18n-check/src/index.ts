/**
 * `@sdm/i18n-check` — CI gate enforcing SK ↔ EN catalog key parity.
 *
 * Per ADR-07 §Dôsledky / Negatívne — bez gate-u SK ↔ EN drift sa nahromadí
 * a nedeklarovaný key sa silently fallbackuje na druhý locale → degradácia UX
 * "tichý mix jazykov".
 *
 * Logika: rekurzívne walknime každý catalog pair (`shared/{sk,en}.json`,
 * `portal/{sk,en}.json`, `workspace/{sk,en}.json`), collect-neme dotted key
 * paths, diffneme symetrický rozdiel. Exit 1 ak set nie je rovnaký.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const TOOL_NAME = "@sdm/i18n-check";

type Catalog = Record<string, unknown>;

export function collectKeys(catalog: Catalog, prefix = ""): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(catalog)) {
    const path = prefix === "" ? key : `${prefix}.${key}`;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      out.push(...collectKeys(value as Catalog, path));
    } else {
      out.push(path);
    }
  }
  return out.sort();
}

export interface ParityResult {
  readonly namespace: string;
  readonly onlyInSk: readonly string[];
  readonly onlyInEn: readonly string[];
}

export function diffCatalogs(sk: Catalog, en: Catalog, namespace: string): ParityResult {
  const skKeys = new Set(collectKeys(sk));
  const enKeys = new Set(collectKeys(en));
  const onlyInSk = [...skKeys].filter((k) => !enKeys.has(k)).sort();
  const onlyInEn = [...enKeys].filter((k) => !skKeys.has(k)).sort();
  return { namespace, onlyInSk, onlyInEn };
}

export function loadCatalog(absPath: string): Catalog {
  const raw = readFileSync(absPath, "utf8");
  return JSON.parse(raw) as Catalog;
}

export interface CheckOptions {
  readonly catalogsRoot: string;
  readonly namespaces: readonly string[];
}

export function check({ catalogsRoot, namespaces }: CheckOptions): ParityResult[] {
  return namespaces.map((ns) => {
    const sk = loadCatalog(resolve(catalogsRoot, ns, "sk.json"));
    const en = loadCatalog(resolve(catalogsRoot, ns, "en.json"));
    return diffCatalogs(sk, en, ns);
  });
}
