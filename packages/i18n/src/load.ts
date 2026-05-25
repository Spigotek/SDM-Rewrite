/**
 * Catalog loader — eager bootstrap (shared + jeden app namespace) + lazy switch
 * pre druhý locale.
 *
 * Vite's `import()` chunkuje per-locale JSON natívne. Provider helper
 * `bootstrapI18n(app, locale)` natiahne shared + app catalog pre default locale
 * synchrónne (await), a druhý locale lazy on demand cez `loadCatalog`.
 */

import type { Locale, Namespace } from "./types";

type CatalogResource = Record<string, unknown>;

const sharedSk = () => import("../catalogs/shared/sk.json");
const sharedEn = () => import("../catalogs/shared/en.json");
const portalSk = () => import("../catalogs/portal/sk.json");
const portalEn = () => import("../catalogs/portal/en.json");
const workspaceSk = () => import("../catalogs/workspace/sk.json");
const workspaceEn = () => import("../catalogs/workspace/en.json");

type Loader = () => Promise<{ default: CatalogResource }>;

const CATALOG_LOADERS: Record<Namespace, Record<Locale, Loader>> = {
  shared: { sk: sharedSk, en: sharedEn },
  portal: { sk: portalSk, en: portalEn },
  workspace: { sk: workspaceSk, en: workspaceEn },
};

export async function loadCatalog(namespace: Namespace, locale: Locale): Promise<CatalogResource> {
  const loader = CATALOG_LOADERS[namespace][locale];
  const mod = await loader();
  return mod.default;
}
