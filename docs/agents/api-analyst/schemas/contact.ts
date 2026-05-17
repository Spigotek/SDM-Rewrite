/**
 * `cnt` (Contact) — používateľ, žiadateľ, agent.
 * Zdroj: PDF s. 3779–3781.
 *
 * Factories: `default`, `agt` (analyst), `cst` (customer/end-user), `grp` (group).
 * REL_ATTR: `id` (UUID). Common Name: `combo_name`.
 */

import type {
  IsoTimestamp,
  MajicUuidLiteral,
  SdmIntegerId,
  SrelReference,
  ActiveBool,
  HateoasLink,
} from "./common";

/** Hlavná Contact entity-typ — pokrýva kontaktov, agentov aj skupiny. */
export interface Contact {
  /** UUID literál (v Majic notation `U'...'`). */
  id: MajicUuidLiteral;
  /** Prihlasovacie meno. */
  userid?: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  combo_name?: string;
  email_address?: string;
  pemail_address?: string;
  /** Primary phone number. */
  phone_number?: string;
  alt_phone?: string;
  fax_phone?: string;
  mobile_phone?: string;
  beeper_phone?: string;
  /** 1 = inactive, 0 = active. */
  delete_flag?: ActiveBool;
  alias?: string;
  contact_num?: string;
  /** Internal contact_type ID (1=Employee, 2=Group, 3=Analyst, …). */
  type?: number;
  /** Access type SREL — definuje function-access. */
  access_type?: SrelReference;
  /** Default tenant SREL → `tenant.id`. */
  tenant?: SrelReference;
  organization?: SrelReference;
  admin_org?: MajicUuidLiteral;
  dept?: SrelReference;
  position?: SrelReference;
  job_function?: SrelReference;
  location?: SrelReference;
  company?: SrelReference;
  supervisor_contact_uuid?: MajicUuidLiteral;
  billing_code?: SrelReference;
  /** List of role assignments (SREL → cnt_role). */
  roles?: SrelReference[];
  notes?: string;
  creation_date?: IsoTimestamp;
  creation_user?: string;
  delete_time?: IsoTimestamp;
  last_mod?: IsoTimestamp;
  last_mod_by?: string;
  /** Optimistic concurrency token. */
  version_number?: number;
  link?: HateoasLink;
}

/** Per-role asociácia kontaktu (cnt_role). */
export interface ContactRole {
  id: SdmIntegerId;
  contact: SrelReference;
  /** SREL → `role.id`. */
  role_obj: SrelReference;
  /** 1 = je default role pre tohto kontaktu. */
  is_default: 0 | 1;
  last_mod_dt?: IsoTimestamp;
}

/** Tenant — poskytovateľ multi-tenancy izolácie. */
export interface Tenant {
  id: MajicUuidLiteral;
  name: string;
  tenant_number?: string;
  /** 1 = service provider tenant (môže vidieť všetky tenanty). */
  service_provider?: 0 | 1;
  contact?: SrelReference;
  description?: string;
  logo?: string;
  phone_number?: string;
  fax_number?: string;
  alt_phone?: string;
  location?: SrelReference;
  delete_flag?: ActiveBool;
  ldap_tenant_group?: SrelReference;
  terms_of_usage?: SrelReference;
  creation_date?: IsoTimestamp;
  creation_user?: string;
  last_update_date?: IsoTimestamp;
  last_update_user?: string;
  version_number?: number;
}

/** Tenant group (logické zoskupenie tenantov, napr. service provider hierarchy). */
export interface TenantGroup {
  id: MajicUuidLiteral;
  name: string;
  description?: string;
  delete_flag?: ActiveBool;
  creation_date?: IsoTimestamp;
  creation_user?: string;
  last_update_date?: IsoTimestamp;
  last_update_user?: string;
  version_number?: number;
}

/** N:M asociácia tenant ↔ tenant_group. */
export interface TenantGroupMember {
  id: MajicUuidLiteral;
  tenant_id: SrelReference;
  tenant_group: SrelReference;
  /** Vlastníci-tenant (kvôli multi-tenancy). */
  tenant: SrelReference;
  creation_date?: IsoTimestamp;
  creation_user?: string;
}

/** Group (skupina používateľov). */
export interface Group {
  id: MajicUuidLiteral;
  /** Common name. */
  combo_name: string;
  delete_flag?: ActiveBool;
  /** Members ako BREL → grpmem. */
  member_list?: SrelReference[];
  /** Roles → BREL → cnt_role. */
  roles?: SrelReference[];
}
