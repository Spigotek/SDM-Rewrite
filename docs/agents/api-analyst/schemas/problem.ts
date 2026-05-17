/**
 * `pr` (Problem) — Problem Management.
 * Zdroj: PDF s. 3821–3823.
 *
 * Factory: `pr`, REL_ATTR: `persistent_id`, Common Name: `ref_num`.
 * Function group: `call_mgr`. Zdiela tabuľku `Call_Req`.
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

export interface Problem {
  id: SdmIntegerId;
  persistent_id?: SdmPersistentId;
  ref_num?: string;
  description?: string;
  summary?: string;

  // Lifecycle
  active?: ActiveBool;
  status?: SrelReference;
  status_prev?: IncidentStatusCode;

  // Classification
  category?: SrelReference;
  category_prev?: SrelReference;
  type?: "P" | string;
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

  // People
  customer: MajicUuidLiteral | SrelReference;
  log_agent: MajicUuidLiteral | SrelReference;
  assignee?: MajicUuidLiteral | SrelReference;
  assignee_prev?: SrelReference;
  group?: MajicUuidLiteral | SrelReference;
  group_prev?: SrelReference;

  // Time
  open_date?: IsoTimestamp;
  resolve_date?: IsoTimestamp;
  close_date?: IsoTimestamp;
  call_back_date?: IsoTimestamp;
  call_back_flag?: ActiveBool;
  outage_start_time?: IsoTimestamp;
  outage_end_time?: IsoTimestamp;
  last_mod_dt?: IsoTimestamp;
  time_spent_sum?: number;

  // Misc
  parent?: SdmPersistentId;
  caused_by_chg?: SrelReference;
  change?: SdmIntegerId;
  problem?: string;
  affected_resource?: MajicUuidLiteral;
  external_system_ticket?: string;
  extern_ref?: string;
  charge_back_id?: string;
  cr_tticket?: SdmIntegerId;
  base_template?: SdmPersistentId;
  template_name?: string;
  predicted_sla_violation?: 0 | 1;
  sla_violation?: 0 | 1;
  support_lev?: string;
  string1?: string;
  string2?: string;
  string3?: string;
  string4?: string;
  string5?: string;
  string6?: string;
  link?: HateoasLink;
}
