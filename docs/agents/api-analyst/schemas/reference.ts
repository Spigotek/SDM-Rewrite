/**
 * Reference / lookup typy — priorities, severity, categories, status, transitions.
 *
 * V CA SDM je veľa enum-like tabuliek, ktoré sa volajú "reference" a sú
 * editovateľné cez admin UI. REST API ich exponuje ako bežné objekty cez
 * `/caisd-rest/{factory}/`.
 */

import type {
  IsoTimestamp,
  SdmIntegerId,
  SrelReference,
  ActiveBool,
  HateoasLink,
  SdmPersistentId,
  MajicUuidLiteral,
} from "./common";

/** Priority (pri). */
export interface Priority {
  enum: number;
  sym: string;
  description?: string;
  delete_flag?: ActiveBool;
  duration?: number;
}

/** Severity (sevrty). */
export interface Severity {
  enum: number;
  sym: string;
  description?: string;
  delete_flag?: ActiveBool;
}

/** Impact (imp). */
export interface Impact {
  enum: number;
  sym: string;
  description?: string;
  delete_flag?: ActiveBool;
}

/** Urgency (urg / urgncy). */
export interface Urgency {
  enum: number;
  sym: string;
  description?: string;
  delete_flag?: ActiveBool;
}

/** Activity type (act_type). */
export interface ActivityType {
  code: string;
  sym: string;
  description?: string;
  delete_flag?: ActiveBool;
  /** 1 = type je pre internal-only (nezobrazí sa u zákazníkov). */
  internal?: 0 | 1;
  notify_assignee?: 0 | 1;
  notify_customer?: 0 | 1;
  notify_group?: 0 | 1;
}

/** Problem category (pcat). */
export interface ProblemCategory {
  persistent_id: SdmPersistentId;
  sym: string;
  description?: string;
  parent?: SrelReference;
  assignee?: SrelReference;
  group?: MajicUuidLiteral;
  auto_assign?: 0 | 1;
  delete_flag?: ActiveBool;
  schedule?: SrelReference;
  /** Default priority. */
  priority?: SrelReference;
  /** Default severity. */
  severity?: SrelReference;
  /** Default urgency. */
  urgency?: SrelReference;
  /** Default impact. */
  impact?: SrelReference;
  /** Symptom code. */
  symptom_code?: SrelReference;
  /** SLA target. */
  slatpl?: SrelReference;
  /** Survey template. */
  survey_default?: SrelReference;
  workflow?: SrelReference;
  catalog_id?: number;
  link?: HateoasLink;
}

/** Issue category (isscat). */
export interface IssueCategory {
  code: string;
  sym: string;
  description?: string;
  parent?: SrelReference;
  delete_flag?: ActiveBool;
  assignee?: SrelReference;
  cawf_defid?: string;
}

/** Root cause (rc). */
export interface RootCause {
  id: SdmIntegerId;
  sym: string;
  description?: string;
  delete_flag?: ActiveBool;
  persistent_id?: SdmPersistentId;
  last_mod_dt?: IsoTimestamp;
  last_mod_by?: MajicUuidLiteral;
}

/** Symptom code. */
export interface SymptomCode {
  id: SdmIntegerId;
  sym: string;
  description?: string;
  delete_flag?: ActiveBool;
  persistent_id?: SdmPersistentId;
}

/** Closure code. */
export interface ClosureCode {
  id: SdmIntegerId;
  sym: string;
  description?: string;
  delete_flag?: ActiveBool;
}

/** Active boolean (actbool) — inštancia sa používa ako lookup pre 0/1 polia. */
export interface ActiveBoolean {
  enum: 0 | 1;
  sym: "Active" | "Inactive" | string;
  description?: string;
  delete_flag?: ActiveBool;
  last_mod_dt?: IsoTimestamp;
}

/** Organization (org). */
export interface Organization {
  id: SdmIntegerId;
  name: string;
  description?: string;
  parent_org?: SrelReference;
  org_type?: SrelReference;
  delete_flag?: ActiveBool;
  /** Tenant ownership. */
  tenant?: SrelReference;
}

/** Department. */
export interface Department {
  id: SdmIntegerId;
  name: string;
  description?: string;
  organization?: SrelReference;
  delete_flag?: ActiveBool;
}

/** Cost center. */
export interface CostCenter {
  id: SdmIntegerId;
  name: string;
  description?: string;
  delete_flag?: ActiveBool;
  creation_date?: IsoTimestamp;
  creation_user?: string;
  last_update_date?: IsoTimestamp;
  last_update_user?: string;
  version_number?: number;
}

/** Country. */
export interface Country {
  id: SdmIntegerId;
  name: string;
  description?: string;
  delete_flag?: ActiveBool;
}
