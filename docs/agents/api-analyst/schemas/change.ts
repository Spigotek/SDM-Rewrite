/**
 * `chg` (Change Order) — Change Management.
 * Zdroj: PDF s. 3850–3854.
 *
 * Factory: `chg`, REL_ATTR: `id`, Common Name: `chg_ref_num`.
 * Function group: `change_mgr`. Tabuľka `Change_Request`.
 */

import type {
  IsoTimestamp,
  MajicUuidLiteral,
  SdmIntegerId,
  SrelReference,
  ActiveBool,
  HateoasLink,
  SdmPersistentId,
} from "./common";
import type { SeverityCode } from "./incident";

/** Change type — Standard / Normal / Emergency / Major. */
export interface ChangeType {
  id: SdmIntegerId;
  sym: string;
  description?: string;
  delete_flag?: ActiveBool;
}

/** Change category. */
export interface ChangeCategory {
  code: string;
  sym: string;
  description?: string;
  assignee?: SrelReference;
  auto_assign?: 0 | 1;
  cab?: MajicUuidLiteral;
  cawf_defid?: string;
  chgtype?: SrelReference;
  children_ok?: 0 | 1;
  delete_flag?: ActiveBool;
}

/** Change status (chgstat). */
export interface ChangeStatus {
  code: string;
  sym: string;
  delete_flag?: ActiveBool;
  /** 1 = approval pending. */
  approval?: 0 | 1;
  /** 1 = closed. */
  closed?: 0 | 1;
}

export interface ChangeOrder {
  id: SdmIntegerId;
  persistent_id?: SdmPersistentId;
  chg_ref_num?: string;
  description?: string;
  summary?: string;
  actions?: string;
  active?: ActiveBool;

  // Classification
  category?: SrelReference;
  category_prev?: string;
  chgtype?: SrelReference;
  priority?: SeverityCode;
  priority_prev?: SeverityCode;
  impact?: SeverityCode;
  impact_prev?: SeverityCode;
  risk?: SrelReference;
  rootcause?: SrelReference;
  status?: SrelReference;
  status_prev?: string;

  // People
  affected_contact: MajicUuidLiteral | SrelReference;
  log_agent: MajicUuidLiteral | SrelReference;
  requestor: MajicUuidLiteral | SrelReference;
  assignee?: MajicUuidLiteral | SrelReference;
  assignee_prev?: SrelReference;
  group?: MajicUuidLiteral;
  group_prev?: SrelReference;
  requested_by?: SrelReference;
  organization?: MajicUuidLiteral;

  // Planning
  backout_plan?: string;
  business_case?: string;
  justification?: string;
  effort?: string;
  /** Schedule (planned). */
  sched_start_date?: IsoTimestamp;
  sched_end_date?: IsoTimestamp;
  sched_duration?: IsoTimestamp;
  start_date?: IsoTimestamp;
  service_date?: IsoTimestamp;
  est_comp_date?: IsoTimestamp;
  /** Actual completion. */
  actual_comp_date?: IsoTimestamp;
  est_cost?: number;
  est_total_time?: number;
  cost?: number;
  actual_total_time?: number;

  // CAB / approval
  cab?: MajicUuidLiteral;
  cab_approval?: 0 | 1;

  // Lifecycle
  open_date?: IsoTimestamp;
  close_date?: IsoTimestamp;
  resolve_date?: IsoTimestamp;
  call_back_date?: IsoTimestamp;
  call_back_flag?: ActiveBool;
  need_by?: IsoTimestamp;
  modified_date?: IsoTimestamp;
  last_mod_by?: MajicUuidLiteral;
  closure_code?: SrelReference;

  // Misc
  parent?: SdmIntegerId;
  external_system_ticket?: string;
  reporting_method?: SrelReference;
  product?: SrelReference;
  service_num?: string;
  type_of_contact?: SrelReference;
  template_name?: string;
  cawf_procid?: string;
  person_contacting?: SrelReference;
  predicted_sla_violation?: 0 | 1;
  sla_violation?: 0 | 1;
  support_lev?: string;
  flag1?: number;
  flag2?: number;
  flag3?: number;
  flag4?: number;
  flag5?: number;
  flag6?: number;
  user1?: string;
  user2?: string;
  user3?: string;
  string1?: string;
  string2?: string;
  string3?: string;
  string4?: string;
  string5?: string;
  string6?: string;
  link?: HateoasLink;
}

/** Workflow task pre Change order. */
export interface WorkflowTask {
  id: SdmIntegerId;
  persistent_id?: SdmPersistentId;
  description?: string;
  /** Object type — typicky `chg` ale aj `iss`. */
  object_type: "chg" | "iss" | string;
  /** Foreign key na chg.id (alebo iss.id). */
  chg?: SdmIntegerId;
  task: string;
  status?: SrelReference;
  assignee?: MajicUuidLiteral;
  group?: MajicUuidLiteral;
  group_task?: 0 | 1;
  sequence: number;
  asset?: MajicUuidLiteral;
  start_date?: IsoTimestamp;
  est_comp_date?: IsoTimestamp;
  completion_date?: IsoTimestamp;
  est_cost?: number;
  cost?: number;
  est_duration?: number;
  actual_duration?: number;
  comments?: string;
  creator?: MajicUuidLiteral;
  done_by?: MajicUuidLiteral;
  date_created?: IsoTimestamp;
  delete_flag?: ActiveBool;
  wf_template?: SrelReference;
  support_lev?: string;
  last_mod_by?: MajicUuidLiteral;
  last_mod_dt?: IsoTimestamp;
}

/** Change activity log (chgalg). */
export interface ChangeActivityLog {
  id: SdmIntegerId;
  persistent_id?: SdmPersistentId;
  description?: string;
  action_desc?: string;
  analyst?: SrelReference;
  change_id?: SdmIntegerId;
  internal?: 0 | 1;
  knowledge_session?: string;
  knowledge_tool?: string;
  type?: SrelReference;
  time_spent?: number;
  time_stamp?: IsoTimestamp;
  system_time?: IsoTimestamp;
  last_mod_dt?: IsoTimestamp;
}
