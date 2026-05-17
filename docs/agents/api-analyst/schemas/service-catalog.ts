/**
 * Service Catalog (offerings + categories) — primárne dostupné cez BUI
 * vrstvu (`/getOfferings`, `/pcatSearch`, `/getBrowseOfferings`, `/getServiceRequest`).
 *
 * Zdroj: PDF s. 2969–2978, swagger version `Leh-17.2 GA`.
 *
 * Tieto endpointy nie sú v primárnom `/caisd-rest` namespace — sú to BUI/SP
 * REST volania, ktoré FE bude volať priamo (cez BFF) pre Service Point UX.
 */

import type { HateoasLink, SdmIntegerId } from "./common";

/** Service offering (z CA Service Catalog cez Service Point). */
export interface ServiceOffering {
  /** Numeric offering ID. */
  id: string;
  offering_name: string;
  offering_description?: string;
  /** "1" = active, "0" = inactive. */
  offering_status?: "0" | "1";
  /** Source — `catalog` (z CA Service Catalog) alebo `pcat` (z CA SDM categories). */
  ctg_source: "catalog" | "pcat" | string;
  /** Tenant domain. */
  domain?: string;
  /** Path v category tree (e.g. `10001/10002/10003/`). */
  path?: string;
  image_file?: string;
  mobile_enabled?: "0" | "1";
  /** Options — možnosti, ktoré offer ponúka. */
  "options.option_name"?: string[];
  "options.option_id"?: (string | number)[];
}

/** Response z `GET /getOfferings`. */
export interface GetOfferingsResponse {
  type: "service_offering" | string;
  count: string;
  hasMore: "true" | "false";
  fields: ServiceOffering[];
}

/** Category record (cez `/pcatSearch`). */
export interface CatalogCategory {
  id: string;
  name: string;
  description?: string;
  /** Source: `catalog` | `pcat`. */
  ctg_source: "catalog" | "pcat" | string;
  /** Cesta v hierarchii. */
  path?: string;
  domain?: string;
  has_children?: "0" | "1";
  /** Súvisiace offerings. */
  offerings?: ServiceOffering[];
}

/** Response z `GET /pcatSearch`. */
export interface PcatSearchResponse {
  type: string;
  count: string;
  hasMore: "true" | "false";
  fields: CatalogCategory[];
}

/** Service Catalog request (cez `/getServiceRequest`). */
export interface ServiceCatalogRequestSummary {
  /** CA Service Catalog request ID. */
  id: string;
  request_name?: string;
  /** Status string (e.g. `Pending Approval`, `Completed`). */
  status?: string;
  /** Date created. */
  created_dt?: string;
  /** Owner / requestor. */
  requestor?: string;
  total_amount?: number;
}
