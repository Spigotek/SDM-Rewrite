/**
 * CA SDM 17.4 — common building blocks pre REST API typy.
 *
 * Pravidlá:
 *  - ISO timestamp serializuje CA SDM ako epoch seconds (number) v JSON, alebo
 *    `LOCAL_TIME` ISO string v XML. V JSON odpovediach pozorované oba varianty
 *    (BUI vrstva vracia epoch, primárny REST vracia ISO string podľa
 *    `Accept` headera). Typujeme oboje a v BFF normalizujeme na ISO 8601.
 *  - Reference attributy (SREL) sú v REST odpovediach reprezentované buď
 *    ako wrapped objekt s `id`, `REL_ATTR`, `COMMON_NAME` a `link`, alebo
 *    ako plain ID v JSON-only formáte. Vyjadrujeme ako diskriminovaný typ.
 *  - UUID stringy CA SDM predtuhuje literálom `U'...'` (Majic notation).
 *    V request body to ostáva — typujeme ako `MajicUuidLiteral`.
 */

/** ISO 8601 timestamp string (preferovaný formát po normalizácii v BFF). */
export type IsoTimestamp = string;

/** Epoch seconds (CA SDM JSON pre LOCAL_TIME polia). */
export type EpochSeconds = number;

/** UUID literál v CA SDM Majic syntaxi: `U'279B25DD051D0A47B54880D86700397F'`. */
export type MajicUuidLiteral = string;

/** Číselný ID record-u (INTEGER primary key v ca_xxx tabuľkách). */
export type SdmIntegerId = number;

/** Persistent ID — `<factory>:<id>`, napr. `cr:400055`, `attmnt:400015`. */
export type SdmPersistentId = string;

/** REL_ATTR — relation attribute — typicky `id`, `enum`, `code`, alebo `persistent_id`. */
export type RelAttr = string | number;

/**
 * Wrapped SREL/UUID reference v JSON odpovedi.
 * Príklad: `{ id: "U'ADE...'", REL_ATTR: "U'ADE...'", COMMON_NAME: "John Doe", link: { href, rel } }`.
 */
export interface SrelReference {
  id: MajicUuidLiteral | SdmIntegerId | string;
  REL_ATTR?: RelAttr;
  COMMON_NAME?: string;
  link?: HateoasLink;
}

/** HATEOAS link element vracaný v každej response. */
export interface HateoasLink {
  href: string;
  rel: "self" | "previous" | "next" | "all" | string;
}

/** Active boolean enum (CA SDM `actbool`). */
export type ActiveBool = 0 | 1;

/** Generická paginated odpoveď — collection GET. */
export interface PaginatedResponse<T> {
  /** Celkový počet záznamov v rámci aktuálnej query. */
  totalCount: number;
  /** Page-size pre tento response. */
  size?: number;
  /** Začiatočný index (1-based). */
  start?: number;
  /** Položky aktuálnej stránky. */
  results: T[];
  /** ATOM-style next/prev/all linky. */
  links?: HateoasLink[];
}

/** Štandardná error response z REST API. */
export interface SdmErrorResponse {
  /** HTTP status code (vrátane code-matching limitations — viď auth.md). */
  status: 400 | 401 | 404 | 405 | 406 | 409 | 415 | 500;
  /** Krátka správa od servera. */
  message: string;
  /** Voliteľný detail (napr. SQL error). */
  detail?: string;
}

/** Query string parametre pre collection GET. */
export interface CollectionQuery {
  /** WHERE clause (Majic notation, percent-encoded). Napr. `WC=priority%3D4`. */
  WC?: string;
  /** SORT clause. Napr. `SORT=open_date DESC, priority ASC`. */
  SORT?: string;
  /** Page start (1-based). Default 1. */
  start?: number;
  /** Page size. Default 25, max `rest_webservice_list_max_length`. */
  size?: number;
  /** Format prepínanie (`xml` / `json` / `atom`). */
  _type?: "xml" | "json" | "atom";
}

/** HTTP headers ktoré klient musí/môže posielať. */
export interface SdmRequestHeaders {
  /** Access Key (numeric string). Povinný pre všetky volania okrem `POST /rest_access`. */
  "X-AccessKey": string;
  /** Override default role. Optional. */
  "X-Role"?: string;
  /** Comma-separated zoznam atribútov, ktoré sa majú vrátiť v response. */
  "X-Obj-Attrs"?: string;
  /** Comma-separated zoznam atribútov, ktoré sa majú nastaviť na NULL pri PUT. */
  "X-AttrsToNull"?: string;
  /** Akceptovaný formát odpovede (`application/xml` | `application/json` | `application/atom+xml`). */
  Accept?: string;
  /** Content-Type request body. */
  "Content-Type"?: string;
}
