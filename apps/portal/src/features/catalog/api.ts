import type { TenantId } from "@sdm/domain";
import { toSubmitError } from "../../lib/submit-error";
import type { CatalogField, CatalogItem } from "./types";

/**
 * Service Catalog data plumbing.
 *
 * Two read queries — list + detail — both keyed by tenant. The list comes
 * back as `{ items: CatalogItem[] }`; the detail is `{ item, fields }`. The
 * POST `/api/requests` payload follows H.3's pattern (server resolves
 * customer + tenant from session cookie).
 *
 * Both queries throw on non-2xx; the route component handles the loading +
 * error UI. We don't normalise across BFF + MSW here because both runtimes
 * already serve the same shape — see
 * `apps/bff/src/api/endpoints/catalog.ts` and
 * `packages/api-mocks/src/handlers/requests.ts` for the contracts.
 */

interface CatalogItemsResponse {
  readonly items: ReadonlyArray<CatalogItem>;
}

interface CatalogItemDetailResponse {
  readonly item: CatalogItem;
  readonly fields: ReadonlyArray<CatalogField>;
}

async function jsonOrThrow<T>(resp: Response, op: string): Promise<T> {
  if (!resp.ok) {
    const error = new Error(`[${op}] HTTP ${resp.status}`) as Error & { status?: number };
    error.status = resp.status;
    throw error;
  }
  return (await resp.json()) as T;
}

async function fetchCatalogItems(): Promise<ReadonlyArray<CatalogItem>> {
  const resp = await fetch("/api/catalog/items", {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const payload = await jsonOrThrow<CatalogItemsResponse>(resp, "catalog-items");
  return payload.items;
}

async function fetchCatalogItem(id: string): Promise<CatalogItemDetailResponse> {
  const resp = await fetch(`/api/catalog/items/${encodeURIComponent(id)}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  return jsonOrThrow<CatalogItemDetailResponse>(resp, "catalog-item-detail");
}

export function catalogItemsQuery(tenantId: TenantId) {
  return {
    queryKey: ["catalog", tenantId, "items"] as const,
    queryFn: fetchCatalogItems,
    staleTime: 5 * 60_000,
  };
}

export function catalogItemQuery(tenantId: TenantId, itemId: string) {
  return {
    queryKey: ["catalog", tenantId, "item", itemId] as const,
    queryFn: () => fetchCatalogItem(itemId),
    staleTime: 5 * 60_000,
  };
}

/**
 * Submit a Service Catalog request.
 *
 * The portal posts to `POST /api/requests` (the same endpoint as H.3's new
 * incident, but with `catalogItemId` + `fields` carrying the dynamic-form
 * payload). The MSW handler echoes back the created `Request`; the BFF
 * proxies to CA SDM factory `cr` (type=R) and returns the FE-mapped row.
 *
 * The `fields` map values are normalised to JSON-friendly primitives
 * (strings, numbers, booleans, arrays of strings, or null) — RHF retains
 * field-level types so this serialiser is a no-op for the supported set.
 */
export type CatalogRequestFieldValue = string | number | boolean | ReadonlyArray<string> | null;

export interface CatalogRequestPayload {
  readonly catalogItemId: string;
  readonly summary: string;
  readonly fields: Readonly<Record<string, CatalogRequestFieldValue>>;
}

export interface CatalogRequestResponse {
  readonly id: string;
  readonly ref: string;
}

export async function postCatalogRequest(
  payload: CatalogRequestPayload,
): Promise<CatalogRequestResponse> {
  // The MSW handler expects a `requesterId` — fill it from the cookie session
  // as `me` so the handler treats it as the default user. The BFF derives the
  // requester from the cookie regardless.
  const body = {
    summary: payload.summary,
    requesterId: "me",
    serviceCatalogItemId: payload.catalogItemId,
    formData: payload.fields,
  };
  const resp = await fetch("/api/requests", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    throw await toSubmitError(resp, "catalog-request");
  }
  const created = (await resp.json()) as { id: string; ref?: string };
  return { id: created.id, ref: created.ref ?? created.id };
}

/**
 * Lookup helpers for `user-picker` + `ci-picker` async loadOptions. Used by
 * `FieldRenderer` — debounced inside the component. Both endpoints are
 * tenant-scoped server-side via the session cookie.
 */
export interface UserOption {
  readonly id: string;
  readonly displayName: string;
  readonly email: string;
}

export interface CiOption {
  readonly id: string;
  readonly name: string;
  readonly class: string;
}

export async function searchUsers(q: string): Promise<ReadonlyArray<UserOption>> {
  const params = new URLSearchParams({ q });
  const resp = await fetch(`/api/users?${params.toString()}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!resp.ok) return [];
  const body = (await resp.json()) as { users: ReadonlyArray<UserOption> };
  return body.users;
}

interface CiPayloadMixed {
  readonly items?: ReadonlyArray<CiOption>;
  readonly data?: ReadonlyArray<{
    readonly id: string;
    readonly name?: string;
    readonly description?: string;
    readonly class?: { readonly label?: string } | string;
  }>;
}

export async function searchCis(q: string): Promise<ReadonlyArray<CiOption>> {
  const params = new URLSearchParams({ q });
  const resp = await fetch(`/api/cmdb?${params.toString()}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!resp.ok) return [];
  // MSW returns `{ items }`; BFF F.4 entity route returns `{ data, page }`.
  // Normalise both so the caller's `.map` never lands on `undefined`.
  const body = (await resp.json()) as CiPayloadMixed;
  if (Array.isArray(body.items)) return body.items;
  if (Array.isArray(body.data)) {
    return body.data.map((row) => ({
      id: row.id,
      name: row.name ?? row.id,
      class: typeof row.class === "string" ? row.class : (row.class?.label ?? ""),
    }));
  }
  return [];
}
