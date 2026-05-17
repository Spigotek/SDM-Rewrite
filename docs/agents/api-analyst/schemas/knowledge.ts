/**
 * Knowledge Management — KCAT (categories), SKELETONS / KD (documents),
 * O_COMMENTS, O_EVENTS, kdlinks.
 *
 * Zdroj: PDF s. 3803–3807, 3816 (O_COMMENTS, O_EVENTS), 3801 (INDEX_DOC_LINKS).
 *
 * Pre čítanie KB článkov primárny REST API endpoint je `/caisd-rest/KCAT/{id}`
 * (kategória) alebo cez `/bui/getDocument({id})` ak chceme rich-text content
 * spracovaný pre Service Point UI.
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

/** Knowledge Category (KCAT). */
export interface KnowledgeCategory {
  /** ID = O_INDEXES.id. */
  id: SdmIntegerId;
  /** Caption / display name. REQUIRED. */
  CAPTION: string;
  DESCRIPTION?: string;
  KEYWORDS?: string;
  /** Author UUID. */
  AUTHOR_ID?: MajicUuidLiteral;
  OWNER_ID?: MajicUuidLiteral;
  /** Subject expert. */
  SUBJECT_EXPERT_ID?: MajicUuidLiteral;
  /** Parent category (tree). */
  PARENT_ID?: SrelReference;
  HAS_CHILDREN?: 0 | 1;
  HAS_DOCS?: 0 | 1;
  ALLOW_QA?: 0 | 1;
  /** Read group/role. */
  READ_PGROUP?: SrelReference;
  WRITE_PGROUP?: SrelReference;
  /** 1 = Groups, 2 = Roles. */
  PGROUP_TYPE?: 1 | 2;
  PERMISSION_INDEX_ID?: SrelReference;
  WF_TEMPLATE?: SrelReference;
  DOC_TEMPLATE?: SrelReference;
  RELATIONAL_ID?: string;
  ON_COPY_PASTE?: number;
  ON_CUT_PASTE?: number;
  persistent_id?: SdmPersistentId;
  last_mod_dt?: IsoTimestamp;
  last_mod_by?: SrelReference;
  link?: HateoasLink;
}

/** Knowledge document (SKELETONS / KD). */
export interface KnowledgeDocument {
  id: SdmIntegerId;
  /** Document title. */
  TITLE?: string;
  /** Document body (HTML). */
  CONTENT?: string;
  /** Status enum (1 = Draft, 2 = Published, 3 = Retired). */
  STATUS?: number;
  /** Document type. */
  DOC_TYPE?: SrelReference;
  /** Hit count. */
  HITS?: number;
  AUTHOR?: MajicUuidLiteral;
  ASSIGNEE?: MajicUuidLiteral;
  /** Effective date. */
  EFFECTIVE_DATE?: IsoTimestamp;
  EXPIRATION_DATE?: IsoTimestamp;
  /** Linked KCAT. */
  CATEGORY_ID?: SrelReference;
  RELATIONAL_ID?: string;
  persistent_id?: SdmPersistentId;
  last_mod_dt?: IsoTimestamp;
  last_mod_by?: SrelReference;
  /** Average rating (DOUBLE — REST API doesn't expose DOUBLE; pozri PDF s. 3438). */
  AVG_RATING?: number;
  link?: HateoasLink;
}

/** Comment / flag na knowledge dokumente (O_COMMENTS). */
export interface KnowledgeComment {
  id: SdmIntegerId;
  /** Reference na knowledge document. */
  DOC_ID: SrelReference;
  COMMENT_TEXT: string;
  COMMENT_TIMESTAMP?: IsoTimestamp;
  USER_ID?: SrelReference;
  USER_NAME?: string;
  EMAIL_ADDRESS?: string;
  ASSIGNEE?: SrelReference;
  FLG_TYPE?: SrelReference;
  FLG_STATUS?: SrelReference;
  FLG_CODE?: string;
  CLOSE_DESC?: string;
  CLOSE_DATE?: IsoTimestamp;
  DEADLINE_DATE?: IsoTimestamp;
  VER_COUNT?: number;
  SUPPRESS_OEVENTS?: 0 | 1;
  /** Tenant. */
  tenant?: MajicUuidLiteral;
  last_mod_dt?: IsoTimestamp;
  last_mod_by?: SrelReference;
  link?: HateoasLink;
}

/** Knowledge ↔ ticket link (kdlinks). */
export interface KnowledgeLink {
  id: SdmIntegerId;
  persistent_id?: SdmPersistentId;
  /** Linked CR persistent_id. */
  cr?: SdmPersistentId;
  /** Linked Issue persistent_id. */
  iss?: SdmPersistentId;
  /** KD ID. */
  kd: SdmIntegerId;
  /** "cr" | "iss" | "chg" | etc. */
  sd_obj_type: string;
  sd_obj_id: SdmIntegerId;
  link_type: number;
  Analyst?: MajicUuidLiteral;
  LAST_MOD_DT?: IsoTimestamp;
}

/** Audit event na knowledge dokumente (O_EVENTS). */
export interface KnowledgeEvent {
  ID: SdmIntegerId;
  EVENT_NAME?: string;
  EVENT_TIMESTAMP?: IsoTimestamp;
  ENTITY_ID?: SrelReference;
  ACTION?: string;
  WF_USER_ID?: MajicUuidLiteral;
  WF_ACTION_ID?: number;
  LAST_MOD_DT?: IsoTimestamp;
}
