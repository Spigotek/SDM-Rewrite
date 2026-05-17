/**
 * `attmnt` (Attachment) — file uploads pre tickets, KB, CIs.
 * Zdroj: PDF s. 3845–3846.
 *
 * Factory: `attmnt`, REL_ATTR: `id`, Common Name: `created_dt`.
 *
 * Pri vytváraní attachmentu cez REST API ide o multipart/form-data POST
 * (pozri PDF s. 3450). File-resource sa sťahuje cez
 * `GET /caisd-rest/attmnt/{id}/file-resource` (`application/octet-stream`).
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

export interface Attachment {
  id: SdmIntegerId;
  persistent_id?: SdmPersistentId;
  attmnt_uuid?: MajicUuidLiteral;
  /** Logical attachment name. */
  attmnt_name?: string;
  /** Original filename uploaded. */
  orig_file_name?: string;
  /** Server-side filename. */
  file_name?: string;
  file_size?: number;
  file_type?: string;
  file_date?: IsoTimestamp;
  description?: string;
  /** SREL → doc_rep persid (storage repository). */
  repository?: SrelReference;
  folder_id?: SrelReference;
  folder_path_ids?: string;
  inherit_permission_id?: number;
  /** Pgroup type — 1 = group, 2 = role. */
  pgroup_type?: 1 | 2;
  read_pgroup?: SrelReference;
  write_pgroup?: SrelReference;
  /** 1 = link only (URL), 0 = file. */
  link_only?: 0 | 1;
  link_type?: string;
  rel_file_path?: string;
  zip_flag?: 0 | 1;
  /** Tenant (multi-tenancy). */
  tenant?: MajicUuidLiteral;
  /** Status string. */
  status?: string;
  exec_cmd?: SrelReference;
  KDS_ATTACHED?: number;
  delete_flag?: ActiveBool;
  sec_uuid?: MajicUuidLiteral;
  created_by?: MajicUuidLiteral;
  created_dt?: IsoTimestamp;
  last_mod_by?: MajicUuidLiteral;
  last_mod_dt?: IsoTimestamp;
  link?: HateoasLink;
}

/** Folder pre attachments (attmnt_folder). */
export interface AttachmentFolder {
  id: SdmIntegerId;
  folder_name: string;
  description?: string;
  folder_path_ids?: string;
  folder_type?: number;
  has_children?: 0 | 1;
  parent_id?: SrelReference;
  inherit_permission_id?: SrelReference;
  read_pgroup?: SrelReference;
  write_pgroup?: SrelReference;
  repository?: SrelReference;
  last_mod_date?: IsoTimestamp;
}

/** Multipart upload payload (pre BFF). */
export interface AttachmentUploadRequest {
  /** Repository ID (numeric, default = 1002 v dokumentácii). */
  repositoryId: number;
  /** Logical name, posielaný ako form field name. */
  attachmentId: string;
  /** File MIME type. */
  mimeType: string;
  description?: string;
  serverName?: string;
  /** Binary file content. `Blob` v browseri, `Uint8Array` v Node BFF. */
  file: Blob | Uint8Array;
  /** Filename. */
  fileName: string;
}
