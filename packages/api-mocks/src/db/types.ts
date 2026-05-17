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

export interface CatalogOptionField {
  readonly key: string;
  readonly label: string;
  readonly type: "text" | "textarea" | "select" | "number" | "boolean";
  readonly required: boolean;
  readonly options?: readonly { value: string; label: string }[];
}

export interface CatalogOffering {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly form: { readonly fields: readonly CatalogOptionField[] };
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
