/**
 * Authentication-súvisiace typy pre `/caisd-rest/rest_access` a `/api/getAccess`.
 *
 * Zdroj: PDF s. 3447–3454 (REST Authentication Scheme), s. 2906–2912 (Service
 * Point swagger).
 */

import type { EpochSeconds, HateoasLink, SdmIntegerId } from "./common";

/** Request body pre `POST /caisd-rest/rest_access` (Basic Auth flow). */
export interface RestAccessCreateRequest {
  /** Prázdny element `<rest_access/>` v XML / `{}` v JSON. */
}

/**
 * Response z `POST /caisd-rest/rest_access`.
 * `secret_key` sa vráti iba ak používaš Secret Key flow (HMAC) — pre Basic
 * flow je odpoveď bez neho.
 */
export interface RestAccessCreateResponse {
  id: SdmIntegerId;
  REL_ATTR: SdmIntegerId;
  /** COMMON_NAME = `access_key` (numeric string). */
  COMMON_NAME: string;
  /** Numeric session ID, posielaj v hlavičke `X-AccessKey`. */
  access_key: string;
  /** Vydaný iba pri Secret Key flow. */
  secret_key?: string;
  /** Epoch seconds — kedy expiruje. */
  expiration_date: EpochSeconds;
  link?: HateoasLink;
}

/** Response z `POST /caisd-rest/bopsid`. */
export interface BopsidResponse {
  bopsid_val: string;
}

/** Response z `GET /api/getAccess` (BUI vrstva). */
export interface BuiAccessResponse {
  /** V odpovedi je v hlavičke `X-AccessToken`, body je config payload. */
  config?: BuiConfig;
}

/** Service Point konfiguračný objekt vrátený `getBUIAllConfig`. */
export interface BuiConfig {
  tenant_phone_attribute: string;
  code: string;
  showMyRes: "0" | "1";
  searchCascMinWt: string;
  /** Heuristic: BUI returns dozens of feature flags as string-typed booleans. */
  [key: string]: string | number | boolean;
}

/** Headers ktoré BUI vrstva vyžaduje. */
export interface BuiRequestHeaders {
  "X-AccessToken": string;
  Accept?: string;
}

/** Auth scheme — interná diskriminácia v BFF. */
export type SdmAuthScheme =
  | "basic"
  | "secret-key"
  | "bopsid"
  | "eem-artifact";

export interface SdmCredentials {
  scheme: SdmAuthScheme;
  userid: string;
  password?: string;
  bopsidToken?: string;
  eemArtifact?: string;
  secretKey?: string;
}
