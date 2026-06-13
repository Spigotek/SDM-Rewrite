# Phase L.1 — v1.3.0 "Live + Identity" post-mortem

> v1.3 = the "prekvap ma" pass. Owner brief after v1.2.2 landed:
> "stále nie som spokojný s dizajnom a komplexitou UI. Prekvap ma!".
> Phase K shipped foundation + redesign + polish; v1.3 layers
> functional + interactive surprise on top.

## Status

- 🟢 **L.1.A — Brand identity (DONE 2026-06-14)** — Wordmark primitive,
  brand gradient on portal hero, serif accent on H1, count-up KPI ticker.
  Commit `4006dd6` (joint with L.1.B).
- 🟢 **L.1.B — Live SSE notification center (DONE 2026-06-14)** —
  NotificationPopover primitive, `useNotifications` hook in each shell,
  bell wired to J.3 `/api/events` via the new `useAppEvents()` fan-out.
  Commit `4006dd6` (joint with L.1.A).
- 🟡 **L.1.C — JSM inline status transitions (IN-FLIGHT)** — StatusBadge
  transitionable mode, CA_SDM_TRANSITIONS lifecycle map, workspace
  queue / ticket / problem / change consumers wired with optimistic
  mutations.
- ⏳ **L.1.D — v1.3.0 release** — PR, CI, squash merge, tag, release.yml,
  ssh-deploy on `10.11.36.14`.

## Headline numbers (will fill in post-release)

| Metric                           | v1.2.2 baseline | v1.3.0                                             |
| -------------------------------- | --------------- | -------------------------------------------------- |
| Design-system primitives         | 22              | 24 (+ Wordmark + NotificationPopover)              |
| Design-system test count         | 134             | 158+ (target — L.1.C adds ~7)                      |
| Workspace i18n keys              | 727             | 734 → 738+ (L.1.C adds status.transition.\*)       |
| Portal i18n keys                 | 223             | 230 → 234+ (notifications.\*)                      |
| Shared i18n keys                 | 81              | 81                                                 |
| Routes with count-up KPI tickers | 0               | 2 (portal home + workspace queue)                  |
| Live SSE notification bell       | hardcoded 0     | wired to J.3 `/api/events`                         |
| Inline status transitions        | n/a             | workspace queue + ticket + problem + change detail |

## Three "surprise" pillars

1. **Visual identity** — generic indigo "SDM" replaced by a designed
   wordmark with animated entry; serif accent on hero headings;
   subtle radial gradient on portal home hero; KPI numbers count up
   from 0 on mount.
2. **Real-time** — bell that has been hardcoded to 0 since v1.1.4 now
   reflects live SSE events. NotificationPopover groups by ticket,
   marks read, click-throughs (when ticket-level events land on BFF).
3. **Interactive** — clicking any workspace status badge opens the
   transition menu and triggers an optimistic mutation. JSM-quality
   lozenge-as-button UX. Read-only on portal (customers can't
   transition).

## Operator helpers

```bash
# After tag v1.3.0 + release.yml CI green:
sshpass -p 'wGHF_z9EjrEgU2tV' ssh -n root@10.11.36.14 \
  "sed -i 's/^SDM_TAG=.*/SDM_TAG=1.3.0/' /root/sdm-staging/.env.staging \
   && export BFF_DEPLOYED_AT=\$(date -u +%Y-%m-%dT%H:%M:%SZ) \
   && cd /root/sdm-staging \
   && docker compose -f compose.staging.yml --env-file .env.staging pull \
   && docker compose -f compose.staging.yml --env-file .env.staging up -d --wait \
   && docker compose -f compose.staging.yml --env-file .env.staging restart frontdoor"
```
