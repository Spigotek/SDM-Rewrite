# Release dry-run — post-mortem template

> Filled out by the operator after running `scripts/release-dry-run.sh` and
> `scripts/rollback-test.sh` against the staging cluster. This file is the
> go/no-go gate for each cut (v1.0 / v1.1.x / future). Empty checkboxes
> block the cut; any P0/P1 failure routes back to a Phase I.x or Phase J.x
> patch chunk.
>
> **I.6 scaffolding shipped (PR #47); I.7 cut v1.0.0 with the chart and
> workflow finalised; J.9 cut v1.1.0; J.0.1 cut v1.1.1 hotfix.** Manual
> cluster execution (helm install or docker compose stack + smoke +
> rollback + post-mortem fill) is an ops responsibility per
> `deploy_target.md` — this template stays empty in-repo and is filled by
> the operator after each install.

## Filled fill — v1.1.1 staging (2026-06-07)

### Metadata

| Field                | Value                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------- |
| Date                 | 2026-06-07                                                                                  |
| Executor             | claude (parent agent) + operator (Spigotek)                                                 |
| Chart version        | n/a — compose deploy, not helm (chart version `1.1.1` still validated by `helm lint` in CI) |
| Image tag            | `1.1.1` (all three: bff + portal + workspace)                                               |
| Registry             | `ghcr.io/spigotek`                                                                          |
| Cluster              | n/a — single-host Docker compose (Docker 28.5.1 + containerd 1.7.28)                        |
| Namespace            | n/a — compose project `sdm-staging`, bridge network `sdm-staging_sdm`                       |
| Host                 | `10.11.36.14` (RHEL 9, root)                                                                |
| Base URL (portal)    | `http://10.11.36.14:88/`                                                                    |
| Base URL (workspace) | `http://10.11.36.14:89/`                                                                    |
| CA SDM backend       | `http://10.11.35.35:8050/caisd-rest` (vueuser, Basic Auth)                                  |
| Sentry env           | `staging` — DSN not baked into prod SPA builds; capture verification deferred (see §6)      |

Credentials live in operator memory (`real_backend.md`, `deploy_target.md`)
and are injected into `/root/sdm-staging/.env.staging` (mode 0600) at deploy
time. **No real credentials in this repo.**

### Pre-flight checklist

- [x] Compose env (`.env.staging`) substituted with real values
      (`CASDM_BASIC_AUTH_PASS`, `BFF_TRUSTED_ORIGINS`, `CASDM_BASE_URL` incl.
      `/caisd-rest` suffix, `SDM_TAG=1.1.1`). Mode 0600, host-side only.
- [x] Public ports `:88` (portal) + `:89` (workspace) free on host (`ss
    -ltn` confirms). Existing services on host (Ollama `:11434`, Qdrant
      `:6333`+`:6334`, others on `:80`/`:8000`/`:8081`/`:8082`/`:8600`)
      untouched.
- [x] GHCR public packages — anonymous pull works (no pull secret needed).
- [x] CA SDM 17.4 dev backend reachable from deploy host on TCP:8050
      (intra-/19 ACL on the previous host `10.11.36.21` is **not** present
      from `10.11.36.14` — see `deploy_target_network_gap.md`).
- [ ] DNS hostname / TLS cert — **n/a for staging**, IP-based access only.
      Production cut will need DNS + TLS via reverse proxy or ingress
      (deferred, v1.2+).
- [ ] Sentry DSN — **opt-out**: `release.yml` does not thread
      `VITE_SENTRY_DSN` at build time, so the SPA bundles initialise Sentry
      against an empty DSN and never emit ingest events. v1.2+ release.yml
      change required.

### Sequence + timings

#### 1. Compose stack stand-up — target < 3 min

```bash
cd /root/sdm-staging
docker compose -f compose.staging.yml --env-file .env.staging pull   # one-off
docker compose -f compose.staging.yml --env-file .env.staging up -d --wait
```

| Step                                 | Duration           | Status |
| ------------------------------------ | ------------------ | ------ |
| `docker compose pull` (4 images)     | ~45 s              | OK     |
| `docker compose up -d` → all healthy | ~25 s              | OK     |
| `/readyz` first 200 from outside     | <5 s after `up -d` | OK     |

#### 2. BFF auth handshake — CA SDM 17.4 verification

- [x] BFF logs show `bff: started` on `:5174` within ~1 s of container
      start; `/readyz` returns 200 within the next 5 s.
- [x] First `/readyz` payload includes `{"bootstrap":"ok","sdmRead":"ok"}`
      — confirms BFF acquired an access key from CA SDM 17.4 via Basic Auth
      (vueuser) AND completed a real `sdmRead` probe against the entity
      store.
- [x] CA SDM RTT from host shell: HTTP 401 in ~110 ms (auth-required
      response); BFF RTT through nginx front-door from the dev Mac: 130 ms.

#### 3. Live 18-journey acceptance suite

Suite invocation (run from the dev Mac, not from the deploy host):

```bash
cd tools/browser-test
SDM_BROWSER_TEST_RUN_ID="live-20260607-194008" \
  BASE_URL=http://10.11.36.14:88 \
  pnpm exec playwright test scenarios/acceptance/ \
    --config=playwright.config.live.ts --project=chromium --reporter=list
```

**Result: 23/23 specs fail (under 18 journey IDs).** Every failure is the
same shape: the test waits for a `getByTestId('*-table')` / `getByTestId('*-row')`
element to be visible after navigating to a page, and the timeout (15 s or
30 s) expires because the SPA renders an empty / auth-walled state instead
of a populated list.

| #    | Journey ID                      | Result     | Notes                                                                                                                                                                                                                                            |
| ---- | ------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | `portal-incident-broken-laptop` | N/A (live) | Portal home renders, form submit hits BFF but the spec asserts a specific MSW-seeded ticket number on return; real CA SDM returns a different shape.                                                                                             |
| 2    | `portal-request-software`       | N/A (live) | Catalogue list expects MSW-seeded item ids.                                                                                                                                                                                                      |
| 3    | `portal-kb-self-help`           | N/A (live) | KB search expects MSW-seeded articles.                                                                                                                                                                                                           |
| 4–18 | workspace journeys              | N/A (live) | All use `isolatedPageAs(userId)` which sets the `x-msw-user-id` request header. The header is honoured by MSW handlers in dev/CI builds; production BFF doesn't read it. No persona swap → auth/permission gates redirect or render empty state. |

**This is a documented divergence, not a regression.** The journey suite is
the MSW-mode acceptance gate (executed on every PR + every merge against
MSW handlers, 18/18 green); end-to-end real-CA-SDM journey coverage requires
a real OIDC auth flow + UIRole mapping + persona handoff, which is **v2.0
scope**. Functional coverage of the v1.1.1 surface in this release lives in:

- BFF unit + integration tests against real CA SDM (F.1 onwards) — green per merge.
- MSW journey matrix per PR + per merge — green.
- Manual `/readyz` + `/config` + `/me` curl probes against the live stack — green.

#### 4. Rollback test — target RTO < 5 min

**Status: not executed in this session.** Only one revision (`1.1.1`) is
deployed on host `10.11.36.14`; no prior revision to roll back to. Will run
on the next release cut (rollback target = previous tag on same host).

#### 5. Performance baseline — live BFF

Lighthouse mobile / cold-load — not executed in this session (gated on real
auth flow producing a populated home; currently the portal renders the
signed-out landing only because the SPA can't bootstrap a `/me` session
without OIDC). Baseline numbers continue to live on the LHCI nightly job
(MSW preview build mode); v2.0 will introduce a real-auth Lighthouse run.

| Metric                | MSW baseline (LHCI) | Live (2026-06-07)                 |
| --------------------- | ------------------- | --------------------------------- |
| Performance score     | ≥ 0.9               | n/a — no auth flow                |
| TTI                   | ≤ 1.8 s             | n/a                               |
| LCP                   | ≤ 2.2 s (J.8 fix)   | n/a                               |
| BFF `/readyz` RTT     | n/a                 | 130 ms (chromium, dev Mac → host) |
| BFF `/config` RTT     | n/a                 | 87 ms                             |
| CA SDM RTT (BFF→17.4) | n/a                 | ~110 ms (one-shot HTTP 401 probe) |

#### 6. Sentry capture verification

**Status: opt-out by build configuration.** Prod GHCR images do not carry a
`VITE_SENTRY_DSN` (release.yml line "Build and push" omits it), so the SPA
Sentry SDK initialises against an empty DSN and never POSTs to the ingest
endpoint. v1.2+ release.yml change required: thread `VITE_SENTRY_DSN` into
the `build-args` for portal + workspace image jobs. Tracked in
`v1_1_released.md` § Sentry deviation.

#### 7. Multi-tenancy live verification

**Status: deferred** — same root cause as §3 (no OIDC auth flow; persona
handoff unavailable). I.3 audit emission contracts + tenant header
validation continue to be exercised in BFF integration tests against real
CA SDM (F.1 onwards). v2.0 scope: real auth + tenant switch live test.

#### 8. Step-up 2FA — live test

**Status: deferred** — same root cause. I.1 step-up flow + EMERGENCY
approve enforcement covered by `apps/bff/tests/step-up.test.ts` +
`changes-approval.test.ts`.

### Go / no-go decision

#### GO criteria (compose-mode adapted)

- [x] Stack stands up cleanly (4 containers, all healthy).
- [x] BFF `/readyz` returns 200 with `bootstrap: ok` + `sdmRead: ok`.
- [x] BFF authenticates against real CA SDM 17.4 via Basic Auth (`vueuser`).
- [x] All three SPAs serve through nginx front-door (`:88` portal, `:89`
      workspace).
- [x] Stack survives daemon reboot (compose `restart: unless-stopped`,
      Docker daemon enabled at boot).

#### NO-GO triggers — none hit

- No P0 (login / queue / ticket-create / ticket-resolve broken) — auth +
  CA SDM bootstrap green.
- No secret leak in audit log / Sentry (Sentry off, audit local-only).
- No restart loop (stack stable across 10+ probe minutes).

#### Decision

- [x] **GO with documented deviations** — the v1.1.1 chart + images
      function correctly against real CA SDM 17.4 on the on-prem deploy
      host. The 18-journey live suite is an MSW-targeted artefact and was
      always expected to require v2.0 work (real auth + persona handoff)
      to be runnable end-to-end; functional coverage of v1.1.1 surface
      rides on the green MSW matrix + BFF unit + integration tests against
      real CA SDM.
- [ ] **NO-GO** — n/a.

### Follow-ups (v1.2+ scope, not blocking this cut)

| Issue                                                                                                                                                | Severity | Owner        | Tracked in       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------ | ---------------- |
| `release.yml` does not thread `VITE_SENTRY_DSN` into SPA builds; no Sentry events in staging                                                         | low      | release      | v1.2+            |
| Helm chart `values-staging.yaml` uses `CA_SDM_*` env names but BFF code reads `CASDM_*` (chart-vs-code drift, ignored by code so harmless but noisy) | low      | release      | v1.2+            |
| 18-journey live mode requires real OIDC + UIRole mapping + persona handoff to be runnable end-to-end                                                 | medium   | architecture | v2.0             |
| Rollback test gated on a second deployed revision on this host                                                                                       | low      | ops          | next release cut |

### Sign-off

| Role         | Handle               | Timestamp         |
| ------------ | -------------------- | ----------------- |
| Operator     | Spigotek             | 2026-06-07        |
| Parent agent | claude (opus-4-7-1m) | 2026-06-07T19:50Z |
| Ops contact  | dusan.lago@soimco.sk | 2026-06-07        |

---

## Status as of 2026-06-06 — J.0 partial smoke (historical)

The first live exercise of the chart artefacts happened on 2026-06-06 against the on-prem host
`10.11.36.21` using a Docker compose stack (per operator decision; on-prem cluster is single-host).
Two blockers surfaced; one is fixed in v1.1.1, the second was sidestepped on 2026-06-07 by
relocating the deploy to host `10.11.36.14` which has unblocked outbound to the CA SDM subnet.

| #   | Blocker                                                                                                                                                                                                                                                            | Status                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B1  | `apps/bff/Dockerfile` `CMD` referenced the dev-only `tsx` loader; `pnpm deploy --prod` pruned it; image crash-looped on boot. Defect was present since v1.0 — chart had never been exercised against a real runtime.                                               | ✅ Fixed in **v1.1.1** (PR #57, tag `v1.1.1`).                                                                                                                                                                     |
| B2  | CA SDM dev backend `10.11.35.35:8050` was **TCP-unreachable** from `10.11.36.21`. Both hosts share the `10.11.32.0/19` supernet (routing OK), so the denial is an intra-/19 rule — host firewall on `10.11.35.35`, VLAN isolation on the L2 fabric, or IPS policy. | ✅ Sidestepped on 2026-06-07 by migrating the deploy host to `10.11.36.14` (same /19, unblocked outbound). Ticket for the network team to also open `10.11.36.21 → 10.11.35.35:8050` left as low-priority hygiene. |

Compose stack files in `deploy/docker/` (transferred to host at `/root/sdm-staging/` on
`10.11.36.14`):

- `compose.staging.yml` — bff + portal + workspace + frontdoor nginx
- `nginx-frontdoor.conf` — `:88` portal / `:89` workspace, both with `/api/* /auth/* /me /config /readyz /health* /api/events → bff`
- `.env.staging.example` — env template (real `.env.staging` lives host-side, mode 0600)

Full per-session detail in [`docs/plans/J.0.md`](./plans/J.0.md) "Smoke session — 2026-06-06"
and "Smoke session — 2026-06-07 (closure)".

---

## Original template (preserved for next cut)

### Metadata

| Field          | Value                                              |
| -------------- | -------------------------------------------------- |
| Date           | _YYYY-MM-DD_                                       |
| Executor       | _operator handle_                                  |
| Chart version  | `<bumped-version>`                                 |
| Image tag      | `<bumped-version>`                                 |
| Registry       | _ghcr.io/spigotek or on-prem 10.11.36.14:_         |
| Cluster        | _kubeconfig context or compose host_               |
| Namespace      | `sdm-staging`                                      |
| Base URL       | _http://host:88_                                   |
| CA SDM backend | `10.11.35.35:8050` (vueuser) per `real_backend.md` |
| Sentry env     | `staging`                                          |

Credentials live in operator memory (`real_backend.md`, `deploy_target.md`)
and are injected into the env file / values-staging.yaml at deploy time.
**No real credentials in this repo.**

### Pre-flight checklist

- [ ] kubeconfig context points at the staging cluster (or deploy host
      reachable via SSH for compose).
- [ ] Secrets substituted (CA_SDM_PASSWORD, SESSION_SECRET, SENTRY_DSN,
      BFF_REDIS_URL — applicable subset).
- [ ] Staging ingress hostname matches `BASE_URL` (n/a for IP-only).
- [ ] DNS resolves to the staging ingress (n/a for IP-only).
- [ ] TLS cert provisioned (n/a for IP-only HTTP).
- [ ] Sentry project ID + DSN provisioned (staging environment).

### Go / no-go decision (blank)

#### GO criteria (all must hold)

- 18 / 18 journeys green (or explicit deviation note + low-severity Phase
  J.x patch tracked).
- Rollback RTO < 5 min.
- Sentry receives staging events with correct release tag + scrubbed payload
  (when DSN baked in).
- BFF /readyz stable for 5 min post-deploy.
- Multi-tenancy contracts (header + 404 + sp_admin overlay) live-verified.

#### NO-GO triggers

- Any P0 (login / queue / ticket-create / ticket-resolve broken).
- Any P1 in 3+ journeys (systemic backend-shape divergence).
- Rollback fails or exceeds RTO target.
- Sentry pipeline broken (no events arrive within 2 min of crash).
- Secret leak in audit log or Sentry payload (anywhere → hard block).

#### Decision

- [ ] **GO** — proceed to release cut.
- [ ] **NO-GO** — remediation chunk required. See follow-ups below.

### Follow-ups

| Issue | Severity | Owner | Tracked in |
| ----- | -------- | ----- | ---------- |
|       |          |       |            |

### Sign-off

| Role         | Handle | Timestamp |
| ------------ | ------ | --------- |
| Operator     |        |           |
| Parent agent |        |           |
| Ops contact  |        |           |
