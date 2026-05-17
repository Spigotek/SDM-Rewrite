/**
 * CMDB — Configuration Items / Named Resources.
 *
 * `nr` (named resource = CI) je hlavná entita CMDB.
 * Zdroj: PDF s. 3812–3815 (`nr`, `nr_com`, `nrf`).
 *
 * Ďalšie relevantné: `bmhier` (business management hierarchy = service tree),
 * `loc` (location), `org` (organization), `ca_company`, `ca_model_def`.
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

/** Named resource = Configuration Item. */
export interface ConfigurationItem {
  /** UUID. */
  id: MajicUuidLiteral;
  persistent_id?: SdmPersistentId;
  /** Display name. */
  name?: string;
  description?: string;
  resource_alias?: string;
  asset_num?: string; // resource_tag
  serial_number?: string;
  asset_count?: number;

  // Class / family / status
  class?: SrelReference; // → ca_resource_class
  family?: SrelReference; // → ca_resource_family
  status?: SrelReference; // → ca_resource_status
  status_date?: IsoTimestamp;
  delete_flag?: ActiveBool;

  // Networking
  system_name?: string; // host_name
  dns_name?: string;
  alarm_id?: string; // ip_address
  mac_address?: string;
  operating_system?: number;

  // Vendor & lifecycle
  manufacturer?: MajicUuidLiteral;
  supplier?: MajicUuidLiteral;
  model?: MajicUuidLiteral;
  product_version?: string;
  acquire_date?: IsoTimestamp;
  install_date?: IsoTimestamp;
  purchase_order_id?: string;
  requisition_id?: string;
  license_number?: string;
  license_uuid?: MajicUuidLiteral;

  // Location
  location?: MajicUuidLiteral;
  loc_cabinet?: string;
  loc_floor?: string;
  loc_room?: string;
  loc_shelf?: string;
  loc_slot?: string;

  // Ownership / contacts
  resource_contact?: MajicUuidLiteral;
  resource_owner_uuid?: MajicUuidLiteral;
  support_contact1_uuid?: SrelReference;
  support_contact2_uuid?: SrelReference;
  support_contact3_uuid?: SrelReference;
  backup_services_contact_uuid?: SrelReference;
  billing_contact_uuid?: SrelReference;
  disaster_recovery_contact_uuid?: SrelReference;
  network_contact_uuid?: SrelReference;
  service_org?: MajicUuidLiteral;
  vendor_repair?: MajicUuidLiteral;
  vendor_restore?: MajicUuidLiteral;
  repair_org?: MajicUuidLiteral;

  // Org
  expense_code?: SrelReference;
  department?: number;
  org_bought_for_uuid?: MajicUuidLiteral;
  company_bought_for_uuid?: MajicUuidLiteral;

  // Audit
  creation_date?: IsoTimestamp;
  creation_user?: string;
  creation_system?: string;
  last_mod?: IsoTimestamp;
  last_mod_by?: string;
  delete_time?: IsoTimestamp;
  exclude_registration?: number;
  ufam?: number;
  version_number?: number;

  // Relations (BREL/QREL)
  /** Hierarchy: child relationships. */
  child_hier?: SrelReference[];
  /** Hierarchy: parent relationships. */
  parent_hier?: SrelReference[];
  /** All requests affecting this CI. */
  all_creq?: SrelReference[];
  all_open_creq?: SrelReference[];
  /** Activity log. */
  asset_log?: SrelReference[];
  /** Business management hierarchy. */
  bm_child_hier?: SrelReference[];
  bm_parent_hier?: SrelReference[];

  link?: HateoasLink;
}

/** CI activity log entry. */
export interface ConfigurationItemLog {
  id: SdmIntegerId;
  attr_name?: string;
  log: string; // com_comment
  log_date: IsoTimestamp;
  asset_id: MajicUuidLiteral;
  writer_name: string;
  writer_id?: MajicUuidLiteral;
  new_value?: string;
  old_value?: string;
}

/** Resource family. */
export interface ResourceFamily {
  id: SdmIntegerId;
  sym: string;
  description?: string;
  delete_flag?: ActiveBool;
  include_reconciliation?: 0 | 1;
  extension_name?: string;
  physical_table_name?: string;
  creation_date?: IsoTimestamp;
  creation_user?: string;
  last_update_date?: IsoTimestamp;
  last_update_user?: string;
  version_number?: number;
}

/** CI hierarchy relationship (`hier`). Parent ↔ Child. */
export interface ConfigurationItemRelationship {
  id: SdmIntegerId;
  parent: MajicUuidLiteral;
  child: MajicUuidLiteral;
  type?: SrelReference;
  description?: string;
}

/** Location. */
export interface Location {
  id: SdmIntegerId;
  name: string;
  address1?: string;
  address2?: string;
  address3?: string;
  city?: string;
  county?: string;
  country?: SrelReference;
  description?: string;
  fax_number?: string;
  delete_flag?: ActiveBool;
}
