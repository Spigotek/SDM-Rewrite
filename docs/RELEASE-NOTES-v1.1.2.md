# Service Desk Management v1.1.2

**Service Desk Management v1.1.2** — hotfix release. Single-line change in the portal SPA's
`parseTicketParam` so the "My active tickets" home list → ticket detail click works against
the live BFF talking to real CA SDM 17.4.

> Released 2026-MM-DD. Source tag: [`v1.1.2`](https://github.com/Spigotek/SDM-Rewrite/releases/tag/v1.1.2).
> Full changelog: [`docs/CHANGELOG.md`](./CHANGELOG.md).

## What broke

In the portal SPA, `apps/portal/src/features/tickets/TicketDetailRoute.tsx#parseTicketParam`
only accepted two ID shapes on the `/tickets/:id` route: colon-prefixed (`incident:407804`)
and ref-based (`IN-407804`). MSW fixtures emit colon-prefixed IDs through the home's
`/api/incidents` list, so the dev/CI matrix has always exercised that branch and journey-01
remained green. The **live** BFF — once exercised for the first time on 2026-06-12 against
real CA SDM 17.4 — returns raw numeric IDs like `407804` directly. The home's
`MyRecentTickets` component preserves those raw IDs in its link targets, the click navigates
to `/tickets/407804`, and `parseTicketParam` returns `null` → `NotFoundElement` renders the
"Stránka sa nenašla" 404 page despite the underlying BFF endpoint being healthy.

Three call sites are affected by this gap on live deploys: the home list, the post-create
incident success screen, and the post-create catalog request success screen. All three were
silently broken since v1.0; the bug was invisible until J.0 closure put a real CA SDM behind
the BFF.

## Fix

`apps/portal/src/features/tickets/TicketDetailRoute.tsx`:

```diff
   if (/^IN-/i.test(raw)) return { type: "incident", id: raw };
   if (/^REQ-/i.test(raw)) return { type: "request", id: raw };
   if (/^PR-/i.test(raw)) return { type: "problem", id: raw };
   if (/^CHG-/i.test(raw)) return { type: "change", id: raw };
+  // Bare numeric ID — default to `incident`. The portal home lists tickets
+  // from `/api/incidents`, and the live BFF returns raw numeric IDs,
+  // not the prefixed shape the MSW fixtures use.
+  if (/^\d+$/.test(raw)) return { type: "incident", id: raw };
   return null;
```

The portal home + post-create flows only ever produce incident IDs from the BFF (the home
calls `/api/incidents`, the success screens are gated on having just created an incident or
request), so defaulting bare numeric IDs to `incident` is safe. The workspace SPA already
has the same default-to-incident behaviour in its own `parseTicketParam` — this hotfix
brings the portal in line.

## Verification

After re-cutting the portal image at `1.1.1` → `1.1.2`, clicking any ticket in "Tvoje
aktívne tickety" on `http://10.11.36.14:88/` navigates to `/tickets/<raw-id>` and the
SPA fetches `/api/tickets/incident/<raw-id>` against the BFF, which returns the full ticket
detail (status, priority, customer, activity timeline) from real CA SDM 17.4 in ~100 ms.

## Affected artefacts

- `ghcr.io/spigotek/sdm-portal:1.1.2` (also `1.1`, `latest`) — multi-arch
  (`linux/amd64` + `linux/arm64`).
- `ghcr.io/spigotek/sdm-bff:1.1.2` / `sdm-workspace:1.1.2` — unchanged source, re-published
  at the new tag for chart parity.
- Helm chart `oci://ghcr.io/spigotek/charts/sdm:1.1.2` — chart version + appVersion bumped
  to `1.1.2` by `release.yml` packaging step; no chart template changes.

## Not affected

- BFF, workspace SPA, and CMDB / KB / change calendar features all behave identically to
  v1.1.1.
- F.4 audit taxonomy frozen; no new event names.
- No API breaking changes; in-place `helm upgrade` from `1.1.1` to `1.1.2`.

## Migration

`helm upgrade --install sdm oci://ghcr.io/spigotek/charts/sdm --version 1.1.2`, or for the
Docker-compose path used by the on-prem `10.11.36.14` staging:

```bash
SDM_TAG=1.1.2 docker compose -f compose.staging.yml --env-file .env.staging up -d --pull always
```
