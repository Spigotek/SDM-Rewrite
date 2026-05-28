/**
 * Service Catalog FE types.
 *
 * `CatalogField` is the discriminated union of every renderable input the
 * Service Catalog supports (per `design-system/components.md
 * §ServiceCatalogRenderer` table). The DynamicForm renderer dispatches off
 * `type` — one branch per FieldRenderer entry — so adding a new field type
 * is a 3-step change: union member here → registry entry in `schema-builder`
 * → renderer in `FieldRenderer`. Nothing else moves.
 *
 * The shape mirrors what the BFF (`apps/bff/src/api/endpoints/catalog.ts`)
 * and the MSW handler (`packages/api-mocks/src/fixtures/catalog.ts`) produce —
 * both serve the same `{ item, fields }` envelope.
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

/** Hide the field unless the referenced field's value equals `equals`. */
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

export type CatalogCategory = "hardware" | "software" | "access" | "other";

export interface CatalogItem {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: CatalogCategory;
  readonly sla?: string;
  readonly cost?: string;
  readonly featured?: boolean;
}

export const CATEGORIES: ReadonlyArray<CatalogCategory> = [
  "hardware",
  "software",
  "access",
  "other",
] as const;
