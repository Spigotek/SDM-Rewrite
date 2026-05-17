/**
 * `cr` (Call Request / Service Request) — Request Management.
 * Zdroj: PDF s. 3783–3786.
 *
 * `cr` factory zdiela tabuľku `Call_Req` s `in`, `pr`. Reprezentuje generický
 * Service Request. Pre Service Catalog requests sa používa kombinácia
 * `cr` + `crsq` (catalog request reference) + `pcat` (category).
 *
 * Factory: `cr`, REL_ATTR: `persistent_id`, Common Name: `ref_num`.
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
import type { SeverityCode, IncidentStatusCode } from "./incident";

export interface ServiceRequest {
  id: SdmIntegerId;
  persistent_id?: SdmPersistentId;
  ref_num?: string;
  description?: string;
  summary?: string;

  // ---- Lifecycle ----
  active?: ActiveBool;
  status?: SrelReference;
  status_prev?: IncidentStatusCode;

  // ---- Classification ----
  category?: SrelReference;
  category_prev?: string;
  type?: "R" | "I" | "P" | string;
  priority?: SeverityCode;
  priority_prev?: SeverityCode;
  severity?: SeverityCode;
  severity_prev?: SeverityCode;
  impact?: SeverityCode;
  impact_prev?: SeverityCode;
  urgency?: SeverityCode;
  urgency_prev?: SeverityCode;
  incident_priority?: number;
  rootcause?: SrelReference;
  symptom_code?: SrelReference;

  // ---- People ----
  customer: MajicUuidLiteral | SrelReference;
  log_agent: MajicUuidLiteral | SrelReference;
  assignee?: MajicUuidLiteral | SrelReference;
  assignee_prev?: SrelReference;
  group?: MajicUuidLiteral | SrelReference;
  group_prev?: SrelReference;
  /** Requested-by contact (môže byť rôzny od `customer`). */
  requested_by?: MajicUuidLiteral | SrelReference;

  // ---- Asset / Service ----
  affected_resource?: MajicUuidLiteral;
  /** Service offering — link na `nr` (named resource = service). */
  affected_service?: SrelReference;

  // ---- Time ----
  open_date?: IsoTimestamp;
  resolve_date?: IsoTimestamp;
  close_date?: IsoTimestamp;
  call_back_date?: IsoTimestamp;
  call_back_flag?: ActiveBool;
  outage_start_time?: IsoTimestamp;
  outage_end_time?: IsoTimestamp;
  last_mod_dt?: IsoTimestamp;
  time_spent_sum?: number;

  // ---- SLA ----
  sla_violation?: 0 | 1;
  predicted_sla_violation?: 0 | 1;
  target_start_last?: IsoTimestamp;
  target_hold_last?: IsoTimestamp;
  target_hold_count?: number;
  target_resolved_last?: IsoTimestamp;
  target_resolved_count?: number;
  target_closed_last?: IsoTimestamp;
  target_closed_count?: number;

  // ---- Outage details (pre service-impacting requests) ----
  outage_type?: SrelReference;
  outage_reason?: SrelReference;
  outage_detail_what?: string;
  outage_detail_who?: string;
  outage_detail_why?: string;
  pct_service_restored?: number;
  remote_control_used?: SrelReference;
  return_to_service?: SrelReference;

  // ---- Originating user context (denormalised pre tenancy/reporting) ----
  orig_user_admin_org?: SrelReference;
  orig_user_cost_center?: SrelReference;
  orig_user_dept?: SrelReference;
  orig_user_organization?: SrelReference;

  // ---- Misc ----
  parent?: SdmPersistentId;
  caused_by_chg?: SrelReference;
  change?: SdmIntegerId;
  problem?: string;
  external_system_ticket?: string;
  extern_ref?: string;
  charge_back_id?: string;
  cr_tticket?: SdmIntegerId;
  base_template?: SdmPersistentId;
  template_name?: string;
  major_incident?: SrelReference;
  resolvable_at_lower?: SrelReference;
  incorrectly_assigned?: SrelReference;
  support_lev?: string;
  string1?: string;
  string2?: string;
  string3?: string;
  string4?: string;
  string5?: string;
  string6?: string;
  link?: HateoasLink;
}

/** Service request activity log (alg). */
export interface ServiceRequestActivityLog {
  id: SdmIntegerId;
  persistent_id?: SdmPersistentId;
  description?: string;
  type?: SrelReference;
  analyst?: SrelReference;
  call_req_id?: SdmIntegerId;
  internal?: 0 | 1;
  time_spent?: number;
  time_stamp?: IsoTimestamp;
  system_time?: IsoTimestamp;
  last_mod_dt?: IsoTimestamp;
}

/** Status transition (cr_stat → crs). */
export interface ServiceRequestStatus {
  id: SdmIntegerId;
  code: string;
  sym: string;
  active?: ActiveBool;
  delete_flag?: ActiveBool;
  hold?: 0 | 1;
  resolved?: 0 | 1;
  closed?: 0 | 1;
}
