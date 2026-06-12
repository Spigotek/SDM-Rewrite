# Service Desk Management v1.1.3

**Service Desk Management v1.1.3** — feature follow-up release. Replaces the
chunk-1-era `/tickets` placeholder ("Zoznam tvojich ticketov dorazí v H.2.")
with a working **"My tickets"** list page in the portal SPA.

> Released 2026-MM-DD. Source tag: [`v1.1.3`](https://github.com/Spigotek/SDM-Rewrite/releases/tag/v1.1.3).
> Full changelog: [`docs/CHANGELOG.md`](./CHANGELOG.md).

## What changed

The `/tickets` route in the customer-facing portal previously rendered a
single sentence telling the user the feature would arrive in H.2. H.2 did
ship the home dashboard with a top-5 "Tvoje aktívne tickety" widget, but
the standalone full-list page was never built — the placeholder text stayed
in the i18n catalog and the home's "Vidieť všetky →" link landed on it.
The 2026-06-12 J.0 live-deploy walkthrough surfaced this on first user
click after the v1.1.2 ticket-detail hotfix.

This release replaces the placeholder with a real list page that mirrors
the home row markup, fetches up to 50 incidents where
`customer = <session.contactId>` via the existing F.3 BFF endpoint
(`GET /api/incidents?customer=me&size=50&sort=open_date DESC`), and links
each row to `/tickets/<id>` so the v1.1.2 raw-ID parser carries the click
through to the detail view.

## Fix

- New `apps/portal/src/features/tickets/MyTicketsRoute.tsx` reusing the
  home's `MyTicketSummary` projection, the `sdm-home-ticket-*` row CSS,
  and the `StatusBadge` / `formatRelative` design-system primitives.
- New `myAllTicketsQuery` factory in `apps/portal/src/features/home/api.ts`
  alongside the existing top-5 `myTicketsQuery`, parameterized on the
  same `tenantId` key so the H.1 tenant-switch cache invalidation still
  catches it.
- `apps/portal/src/routes/index.tsx` re-points the `tickets` lazy route
  to the new component; the placeholder file under
  `routes/placeholders/my-tickets.tsx` is removed.
- New SK + EN i18n keys: `myTickets.title`, `myTickets.loading`,
  `myTickets.empty`, `myTickets.error`, `myTickets.count` (ICU plural).
  The stale `placeholders.myTickets` + `placeholders.myTicketsTitle`
  catalog entries are removed.
- Small per-page CSS overlay in `my-tickets.css` for the page header +
  count subtitle.

## Verification

After re-cutting the portal image, navigating to
`http://10.11.36.14:88/tickets` from a logged-in session shows the user's
full ticket list (up to 50 rows) sourced from real CA SDM 17.4, each row
clickable to the detail view in ~100 ms. Empty state renders the same
microcopy as the home top-5 widget for visual continuity.

## Affected artefacts

- `ghcr.io/spigotek/sdm-portal:1.1.3` (also `1.1`, `latest`) — multi-arch
  (`linux/amd64` + `linux/arm64`).
- `ghcr.io/spigotek/sdm-bff:1.1.3` / `sdm-workspace:1.1.3` — unchanged
  source, re-cut at the new tag for chart parity.
- Helm chart `oci://ghcr.io/spigotek/charts/sdm:1.1.3` — chart version +
  appVersion bumped to `1.1.3` by `release.yml`; no chart template
  changes.

## Not affected

- BFF endpoints, workspace SPA, change calendar, CMDB, KB editor all
  behave identically to v1.1.2.
- F.4 audit taxonomy frozen; no new event names.
- No API breaking changes; in-place `helm upgrade` from `1.1.2` to
  `1.1.3`.

## Migration

`helm upgrade --install sdm oci://ghcr.io/spigotek/charts/sdm --version 1.1.3`,
or for the Docker-compose path used by the on-prem `10.11.36.14` staging:

```bash
SDM_TAG=1.1.3 docker compose -f compose.staging.yml --env-file .env.staging up -d --pull always
```
