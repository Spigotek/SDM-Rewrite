# Phase J — Post-v1.0 deferred items + production hardening v1.1

> Cieľ fázy: dotiahnuť deferred items z v1.0 RELEASE-NOTES (mobile PWA, advanced
> calendar, KB analytics + image upload, portal LCP cez SSR, real-time tenant
> push, workspace arm64), enable real BFF cross-tenant query proti CA SDM 17.4,
>
> - dotiahnuť pre-validation steps (helm staging deploy + live BFF smoke +
>   rollback test), cut v1.1.0.
>
> **8-10 chunks (TBD).** Sekvenčný dispatch per Phase G/H/I pattern.

## Phase J entry criteria

- ✅ v1.0 released (tag `v1.0.0`, GHCR images, helm OCI chart, GitHub Release).
- ⏳ **PRE-FLIGHT BLOCKER**: live staging deploy + smoke not yet executed (per
  I.6 scaffolding). Phase J **MUSÍ začať** s J.0 dry-run execution to validate
  the deployed v1.0 before adding new features on top.

## Phase J exit criteria

- v1.0 deployed do staging + live 18-journey smoke pass + rollback verified
  - RELEASE-DRY-RUN.md filled out + acceptance-coverage.md "Live BFF" column
    graduated.
- Mobile PWA offline mode (service worker + IndexedDB cache + manifest).
- Calendar drag-resize via FullCalendar's selectable + eventResize.
- KB analytics real ingest endpoint v BFF (CA SDM custom attribute or separate
  audit-derived metrics) — replaces MSW fixture v I.4.
- KB image upload binary via `/api/attachments/kb` endpoint (graduates H.3
  attachments deferral).
- Portal mobile LCP < 1500 ms — either via SSR (Vite SSR mode) alebo via
  copy/UX redesign that shifts LCP target away from empty-state text rect.
- Real-time tenant status push via WebSocket alebo SSE (graduates I.3
  next-API-call detection).
- Real BFF cross-tenant query support (graduates I.5 MSW-overlay; CA SDM
  17.4 may require WC `tenant in (...)` syntax — verify).
- Workspace image multi-arch via native arm64 runner (`ubuntu-22.04-arm`).
- ROADMAP Phase J → ✅ DONE; tag `v1.1.0` cut.

## Cross-chunk decisions (placeholder — refine pri J.0 execution)

### D1 — Per-chunk PR-flow

Identicky ako I: branch z fresh main, jedna PR per chunk, squash --admin
--delete-branch. Žiadne stacked PR. Sekvenčný subagent dispatch.

### D2 — Sequencing (placeholder priority order)

```
J.0 v1.0 staging deploy + live smoke + RELEASE-DRY-RUN.md fill         ← HARD BLOCKER
 ├→ J.1 Workspace arm64 image (ubuntu-22.04-arm)                       ← isolated fix
 ├→ J.2 Real BFF cross-tenant query (CA SDM evaluation + impl)         ← infra
 ├→ J.3 Real-time tenant push (WebSocket/SSE)                          ← infra
 ├→ J.4 KB analytics real ingest                                       ← feature
 ├→ J.5 KB image upload binary                                         ← feature
 ├→ J.6 Calendar drag-resize                                           ← feature
 ├→ J.7 Mobile PWA offline mode                                        ← feature (heavy)
 ├→ J.8 Portal SSR (alebo copy/UX redesign pre LCP target)             ← perf
 └→ J.9 v1.1 cut (semver tag, image push, helm OCI, release notes)     ← release
```

J.0 je hard prerequisite — bez staging validation nemáme dôveru že v1.0 funguje
proti real backend, a v1.1 features by stavali na neoverenom základe.

J.1-J.8 môžu byť reordered podľa priority + dependency analysis. Žiadny
implementation chunk neblokuje na inom okrem J.9 (closes-all).

### D3 — Tech stack additions (TBD per chunk)

Phase J **pridáva**:

- **service-worker / Workbox** — J.7 PWA offline mode.
- **`ws` alebo native WebSocket** v BFF — J.3 real-time push (alternatívne SSE
  via Hono streams — eval).
- **Vite SSR plugin** — J.8 (ak SSR cesta gets picked over copy redesign).
- **`@fullcalendar/interaction`** — J.6 drag-resize (already partially in
  H.10 calendar; verify).

Phase J **NEPRIDÁVA** nič mimo zoznam vyššie bez explicit per-chunk plan update.

### D4 — Backward compatibility

Phase J nesmie breakknúť v1.0 deployments. Helm chart v1.1.0 musí byť
zpätne-kompat installable proti rovnakému kube cluster. CA SDM contract
changes (J.2 cross-tenant) musia byť verzionované alebo opt-in.

### D5 — Memory pointers (cross-conversation)

`v1_0_released.md` memory (auto-loaded) → cross-conversation context pre J chunks.

## Per-chunk index (placeholder)

| Chunk   | Title                                  | Priority     | Spec / Inputs                                       |
| ------- | -------------------------------------- | ------------ | --------------------------------------------------- |
| **J.0** | v1.0 staging deploy + live smoke       | P0 (blocker) | I.6 scaffolding, deploy_target.md, real_backend.md  |
| **J.1** | Workspace arm64 image                  | P1           | I.7 release.yml, GitHub native arm64 runners        |
| **J.2** | Real BFF cross-tenant query            | P1           | spec/multi-tenancy.md, real-backend-contracts.md §6 |
| **J.3** | Real-time tenant push                  | P2           | I.3 SessionContext, Hono streams                    |
| **J.4** | KB analytics real ingest               | P2           | I.4 MSW fixture, audit log infra                    |
| **J.5** | KB image upload binary                 | P2           | H.3 attachments deferral, /api/attachments contract |
| **J.6** | Calendar drag-resize                   | P2           | H.10 FullCalendar config                            |
| **J.7** | Mobile PWA offline mode                | P3           | system-overview.md §PWA, Workbox                    |
| **J.8** | Portal LCP cez SSR (alebo UX redesign) | P3           | I.0 perf calibration, performance.md §2             |
| **J.9** | v1.1 cut                               | P0           | I.7 release.yml pattern                             |

## Notes

- **Phase J plánovanie**: per-chunk plány `docs/plans/J.{0..9}.md` sa píšu
  pre-execution (per Phase G/H/I pattern). Aktuálne tento J.md je len overview
  skeleton — full chunk plans sa píšu keď user spustí Phase J.
- **Pre J.0**: vyžaduje cluster access (kubeconfig) + real BFF creds (per
  memory). Sensitive op — operator/user beží manuálne; subagent prepares
  artifacts ak treba.
- **Post-J.9** = v1.1.0 RELEASED. Žiadna Phase K plánovaná. Ďalšie v2.0 scope
  (analytics dashboards, bulk-ops UI, advanced search, audit log explorer) =
  separate sequencing dokument post-v1.1.
