import type { TenantId } from "@sdm/domain";

/**
 * I.5 — SP cockpit data plumbing. Three endpoints back the cockpit:
 *
 *  - `GET  /me/sp-tenants`   — list of tenants where the caller has sp_admin.
 *  - `POST /api/sp/view-as`  — set the BFF view-as context (step-up gated).
 *  - `DELETE /api/sp/view-as`— clear.
 *
 * The aggregated tenant overview (open incidents, pending changes, critical
 * CIs) is computed client-side from the existing per-entity endpoints
 * cross-tenant queries (`?tenants=all`). Adding a dedicated `/me/sp-overview`
 * aggregator was rejected for I.5 — it doubles the BFF surface without
 * eliminating any round-trip the cockpit needs anyway.
 */

async function jsonOrThrow<T>(resp: Response, op: string): Promise<T> {
  if (!resp.ok) throw new Error(`[${op}] HTTP ${resp.status}`);
  return (await resp.json()) as T;
}

export interface SpTenantRow {
  readonly id: TenantId;
  readonly name: string;
}

export async function fetchSpTenants(): Promise<readonly SpTenantRow[]> {
  const resp = await fetch("/me/sp-tenants", {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const body = await jsonOrThrow<{ tenants: ReadonlyArray<SpTenantRow> }>(resp, "sp-tenants");
  return body.tenants;
}

export interface ViewAsResponse {
  readonly viewingAsTenantId: TenantId | null;
  readonly expiresAt?: string;
}

export async function postViewAs(tenantId: string, stepUpToken: string): Promise<ViewAsResponse> {
  const resp = await fetch("/api/sp/view-as", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Step-Up-Token": stepUpToken,
    },
    body: JSON.stringify({ tenantId }),
  });
  return jsonOrThrow<ViewAsResponse>(resp, "sp-view-as");
}

export async function deleteViewAs(): Promise<ViewAsResponse> {
  const resp = await fetch("/api/sp/view-as", {
    method: "DELETE",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  return jsonOrThrow<ViewAsResponse>(resp, "sp-view-as-clear");
}
