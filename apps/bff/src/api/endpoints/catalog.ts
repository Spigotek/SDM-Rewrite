import type { Hono } from "hono";

/**
 * /api/catalog/items — Service Catalog item directory + dynamic-form schema.
 *
 * Real CA SDM does not expose `Request Item template` (catalog metadata) via
 * the REST factory surface — service-catalog browsing typically lives in
 * CA Service Management (separate product). Until a contract exists, this
 * BFF endpoint serves a deterministic fixture set that matches the MSW
 * handler shape (`packages/api-mocks/src/fixtures/catalog.ts`) so the H.5
 * portal feature can demo end-to-end against either runtime. Per H.5 plan
 * "Open items already resolved" — fixtures are acceptable for the MVP and
 * the swap-in point is this file alone.
 *
 * Response shapes:
 *   GET /api/catalog/items                 → { items: CatalogItemSummary[] }
 *   GET /api/catalog/items/:id             → { item, fields: CatalogField[] }
 *
 * Tenant scoping is a no-op in the fixture path (the items are global). When
 * the real backend lands the tenant filter moves into the upstream call.
 */

export type CatalogFieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "select"
  | "multi"
  | "radio"
  | "checkbox"
  | "file"
  | "user-picker"
  | "ci-picker"
  | "markdown-help";

export interface CatalogFieldOption {
  readonly value: string;
  readonly label: string;
}

export interface CatalogFieldVisibility {
  readonly when: { readonly field: string; readonly equals: string };
}

export interface CatalogField {
  readonly key: string;
  readonly label: string;
  readonly type: CatalogFieldType;
  readonly required: boolean;
  readonly helper?: string;
  readonly placeholder?: string;
  readonly options?: ReadonlyArray<CatalogFieldOption>;
  readonly min?: number;
  readonly max?: number;
  readonly content?: string;
  readonly visibleIf?: CatalogFieldVisibility;
}

export interface CatalogItemSummary {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: "hardware" | "software" | "access" | "other";
  readonly sla?: string;
  readonly cost?: string;
  readonly featured?: boolean;
}

interface CatalogItemFull extends CatalogItemSummary {
  readonly fields: ReadonlyArray<CatalogField>;
}

const ITEMS: ReadonlyArray<CatalogItemFull> = [
  {
    id: "catalog:figma",
    name: "Figma Professional License",
    description: "Ročná licencia pre design tooling.",
    category: "software",
    sla: "~ 2 dni",
    cost: "~ 180 € / ročne",
    featured: true,
    fields: [
      {
        key: "audience",
        label: "Pre koho je licencia?",
        type: "radio",
        required: true,
        options: [
          { value: "self", label: "Pre mňa" },
          { value: "colleague", label: "Pre kolegu" },
        ],
      },
      {
        key: "colleague",
        label: "Vyber kolegu",
        type: "user-picker",
        required: true,
        visibleIf: { when: { field: "audience", equals: "colleague" } },
      },
      {
        key: "duration",
        label: "Trvanie licencie",
        type: "select",
        required: true,
        options: [
          { value: "12", label: "12 mesiacov" },
          { value: "24", label: "24 mesiacov" },
        ],
      },
      { key: "costCenter", label: "Projekt / cost center", type: "text", required: true },
      { key: "comment", label: "Komentár pre schvaľovateľa", type: "textarea", required: false },
    ],
  },
  {
    id: "catalog:vpn",
    name: "VPN prístup pre nového zamestnanca",
    description: "Setup VPN klienta na firemnom zariadení.",
    category: "access",
    sla: "~ 1 deň",
    featured: true,
    fields: [
      { key: "device", label: "Zariadenie (CMDB CI)", type: "ci-picker", required: true },
      { key: "until", label: "Platnosť do", type: "date", required: true },
      { key: "reason", label: "Dôvod prístupu", type: "textarea", required: true },
    ],
  },
  {
    id: "catalog:external-disk",
    name: "Externý disk (1 TB)",
    description: "Šifrovaný externý disk pre projekty s veľkými dátami.",
    category: "hardware",
    sla: "~ 3-5 dní",
    featured: true,
    fields: [
      {
        key: "capacity",
        label: "Kapacita",
        type: "select",
        required: true,
        options: [
          { value: "1tb", label: "1 TB" },
          { value: "2tb", label: "2 TB" },
          { value: "4tb", label: "4 TB" },
        ],
      },
      { key: "encryption", label: "Vyžaduje šifrovanie", type: "checkbox", required: false },
      { key: "justification", label: "Odôvodnenie", type: "textarea", required: true },
    ],
  },
];

function toSummary(item: CatalogItemFull): CatalogItemSummary {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    category: item.category,
    ...(item.sla ? { sla: item.sla } : {}),
    ...(item.cost ? { cost: item.cost } : {}),
    ...(item.featured !== undefined ? { featured: item.featured } : {}),
  };
}

const SUMMARIES: ReadonlyArray<CatalogItemSummary> = ITEMS.map(toSummary);

export function registerCatalogRoutes(app: Hono): void {
  app.get("/api/catalog/items", (c) => {
    const url = new URL(c.req.url);
    const category = url.searchParams.get("category");
    const featuredOnly = url.searchParams.get("featured") === "true";
    const items = SUMMARIES.filter((it) => (category ? it.category === category : true)).filter(
      (it) => (featuredOnly ? it.featured === true : true),
    );
    return c.json({ items });
  });

  app.get("/api/catalog/items/:id", (c) => {
    const id = c.req.param("id");
    const found = ITEMS.find((it) => it.id === id);
    if (!found) {
      return c.json({ error: { code: "NOT_FOUND", message: `catalog item ${id} not found` } }, 404);
    }
    return c.json({ item: toSummary(found), fields: found.fields });
  });
}
