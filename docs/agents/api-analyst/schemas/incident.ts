/**
 * `in` (Incident) — Incident Management.
 * Zdroj: PDF s. 3799–3800.
 *
 * `in` factory zdiela tabuľku `Call_Req` s `cr`, `pr`, `qt`. Rozdiel je v
 * `type` atribúte (`I` = Incident, `R` = Request, `P` = Problem).
 *
 * Factory: `in`, REL_ATTR: `persistent_id`, Common Name: `ref_num`.
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

/** Status code reference (cr_stat / crs). */
export type IncidentStatusCode =
  | "OP" // Open
  | "WIP" // Work in Progress
  | "HOLD" // Hold
  | "ACK" // Acknowledged
  | "RE" // Resolved
  | "CL" // Closed
  | "CAN" // Cancelled
  | string;

/** Priority/severity/impact 1..5 (lower = vyššia priorita per CA SDM convention). */
export type SeverityCode = 1 | 2 | 3 | 4 | 5;

export interface Incident {
  id: SdmIntegerId;
  /** `in:NNN` formát. */
  persistent_id?: SdmPersistentId;
  /** Human-readable ref number, e.g. `123456`. UNIQUE. */
  ref_num?: string;
  /** Hlavný popis incidenta. */
  description?: string;
  summary?: string;

  // ---- Lifecycle ----
  /** 1 = active (open), 0 = closed. */
  active?: ActiveBool;
  status?: SrelReference; // → cr_stat code
  /** Aký bol status pred touto úpravou. */
  status_prev?: IncidentStatusCode;

  // ---- Classification ----
  category?: SrelReference; // → pcat persid
  category_prev?: string;
  type?: "I" | "R" | "P" | string;
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

  // ---- People ----
  /** Customer (affected end user) — UUID kontaktu. REQUIRED. */
  customer: MajicUuidLiteral | SrelReference;
  /** Logger / agent ktorý ticket založil. REQUIRED. */
  log_agent: MajicUuidLiteral | SrelReference;
  /** Aktuálne assignovaný agent. */
  assignee?: MajicUuidLiteral | SrelReference;
  /** Predošlý assignee (sledovanie zmeny). */
  assignee_prev?: SrelReference;
  /** Group (queue) ID. */
  group?: MajicUuidLiteral | SrelReference;
  group_prev?: SrelReference;

  // ---- Asset / Service ----
  affected_resource?: MajicUuidLiteral; // → ca_owned_resource (CI)

  // ---- Time ----
  open_date?: IsoTimestamp;
  resolve_date?: IsoTimestamp;
  close_date?: IsoTimestamp;
  call_back_date?: IsoTimestamp;
  call_back_flag?: ActiveBool;
  outage_start_time?: IsoTimestamp;
  outage_end_time?: IsoTimestamp;
  last_mod_dt?: IsoTimestamp;
  time_spent_sum?: number; // DURATION (seconds)

  // ---- SLA ----
  sla_violation?: 0 | 1;
  predicted_sla_violation?: 0 | 1;
  macro_predicted_violation?: 0 | 1;
  target_start_last?: IsoTimestamp;
  target_hold_last?: IsoTimestamp;
  target_hold_count?: number;
  target_resolved_last?: IsoTimestamp;
  target_resolved_count?: number;
  target_closed_last?: IsoTimestamp;
  target_closed_count?: number;

  // ---- Misc ----
  parent?: SdmPersistentId;
  caused_by_chg?: SrelReference;
  change?: SdmIntegerId;
  external_system_ticket?: string;
  extern_ref?: string;
  charge_back_id?: string;
  cr_tticket?: SdmIntegerId;
  base_template?: SdmPersistentId;
  template_name?: string;
  problem?: string;
  support_lev?: string;
  created_via?: SrelReference;
  string1?: string;
  string2?: string;
  string3?: string;
  string4?: string;
  string5?: string;
  string6?: string;
  link?: HateoasLink;
}

/** Activity log entry pre Incident (alg). */
export interface IncidentActivityLog {
  id: SdmIntegerId;
  persistent_id?: SdmPersistentId;
  description?: string;
  /** Type code → act_type. */
  type?: SrelReference;
  analyst?: SrelReference;
  call_req_id?: SdmIntegerId;
  internal?: 0 | 1;
  time_spent?: number;
  time_stamp?: IsoTimestamp;
  system_time?: IsoTimestamp;
  last_mod_dt?: IsoTimestamp;
  action_desc?: string;
}

/** Allowed status transition. */
export interface IncidentTransition {
  id: SdmIntegerId;
  status: IncidentStatusCode;
  new_status: IncidentStatusCode;
  is_default?: 0 | 1;
  must_comment?: 0 | 1;
  delete_flag?: ActiveBool;
  description?: string;
  condition_error?: string;
}
