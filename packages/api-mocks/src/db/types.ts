import type {
  Change,
  Ci,
  CIRelationship,
  Incident,
  KbArticle,
  KbCategory,
  Problem,
  Request as ServiceRequest,
  Tenant,
  User,
} from "@sdm/domain";

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

export type CatalogFieldOption = { readonly value: string; readonly label: string };

/**
 * Visibility condition — `{ when: { field, equals } }` hides the field unless
 * the referenced field's value equals the predicate. Renderer announces show /
 * hide transitions via `aria-live` (per microcopy.md §13).
 */
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
  readonly options?: readonly CatalogFieldOption[];
  readonly min?: number;
  readonly max?: number;
  /** Read-only markdown body for `markdown-help` fields. */
  readonly content?: string;
  readonly visibleIf?: CatalogFieldVisibility;
}

/** Legacy alias preserved for back-compat with the H.0 fixtures. */
export type CatalogOptionField = CatalogField;

export type CatalogCategory = "hardware" | "software" | "access" | "other";

export interface CatalogOffering {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly description: string;
  readonly category: CatalogCategory;
  /** Optional ~text SLA descriptor (e.g. "1 deň", "~ 2 dni"). */
  readonly sla?: string;
  /** Optional cost preview (e.g. "~ 180 € / ročne"). */
  readonly cost?: string;
  /** Featured-grid surface flag — small subset of items shown on `/catalog`. */
  readonly featured?: boolean;
  readonly form: { readonly fields: readonly CatalogField[] };
}

export type AuditEventOutcome = "success" | "failure";

export interface AuditEvent {
  readonly id: string;
  readonly timestamp: string;
  readonly eventType: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly outcome: AuditEventOutcome;
  readonly details: Readonly<Record<string, unknown>>;
}

export interface MockStore {
  tenants: Tenant[];
  users: User[];
  incidents: Incident[];
  requests: ServiceRequest[];
  problems: Problem[];
  changes: Change[];
  kbArticles: KbArticle[];
  kbCategories: KbCategory[];
  cis: Ci[];
  ciRelationships: CIRelationship[];
  catalog: CatalogOffering[];
  auditEvents: AuditEvent[];
}
