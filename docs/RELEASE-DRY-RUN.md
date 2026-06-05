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

## Status as of 2026-06-06 — J.0 partial smoke

The first live exercise of the chart artefacts happened on 2026-06-06 against the on-prem host
`10.11.36.21` using a Docker compose stack (per operator decision; on-prem cluster is single-host).
Two blockers surfaced; one is fixed in v1.1.1, the second is operator-side.

| #   | Blocker                                                                                                                                                                                                                                   | Status                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| B1  | `apps/bff/Dockerfile` `CMD` referenced the dev-only `tsx` loader; `pnpm deploy --prod` pruned it; image crash-looped on boot. Defect was present since v1.0 — chart had never been exercised against a real runtime.                      | ✅ Fixed in **v1.1.1** (PR #57, tag `v1.1.1`).                                                       |
| B2  | CA SDM dev backend `10.11.35.35:8050` is **TCP-unreachable** from `10.11.36.21` — L3/L4 firewall blocks `10.11.36.0/24` → `10.11.35.0/24` traffic. Routing OK (same /19), but `nc/curl` time out from host shell and BFF container alike. | 🔴 Operator-side. Open ticket with the network team to allow `10.11.36.21 → 10.11.35.35:8050` (TCP). |

Compose stack files in `deploy/docker/` (transferred to host at `/home/soisd/sdm-staging/`):

- `compose.staging.yml` — bff + portal + workspace + frontdoor nginx
- `nginx-frontdoor.conf` — `:88` portal / `:89` workspace, both with `/api/* /auth/* /me /config /readyz /health* /api/events → bff`
- `.env.staging.example` — env template (real `.env.staging` lives host-side, mode 0600)

Smoke evidence (2026-06-06 against v1.1.1):

- `sdm-portal:1.1.1` — Healthy in ~5 s on host port `88`.
- `sdm-workspace:1.1.1` — Healthy in ~5 s on host port `89`.
- `sdm-bff:1.1.1` — process boots in ~1 s (`{"msg":"bff: started","port":5174}`), `/readyz` returns 503
  because CA SDM broker bootstrap fails on B2.
- `sdm-frontdoor` — pending (`depends_on: bff service_healthy`).

Full per-session detail in [`docs/plans/J.0.md`](./plans/J.0.md) "Smoke session — 2026-06-06".

Resume points once B2 is fixed:

- `cd /home/soisd/sdm-staging && docker compose -f compose.staging.yml --env-file .env.staging up -d`
  — BFF healthcheck passes, frontdoor starts, `:88` serves the portal.
- Run live 18-journey via `BASE_URL=http://10.11.36.21:88` + manual `:89` pass for workspace journeys.
- Fill §Metadata + §Sequence onwards in this template.

## Metadata

| Field          | Value                                              |
| -------------- | -------------------------------------------------- |
| Date           | _YYYY-MM-DD_                                       |
| Executor       | _operator handle_                                  |
| Chart version  | `1.0.0-rc.1`                                       |
| Image tag      | `1.0.0-rc.1`                                       |
| Registry       | _ghcr.io/spigotek or on-prem 10.11.36.21:88_       |
| Cluster        | _kubeconfig context_                               |
| Namespace      | `sdm-staging`                                      |
| Base URL       | _https://sdm-staging.example.com_                  |
| CA SDM backend | `10.11.35.35:8050` (vueuser) per `real_backend.md` |
| Sentry env     | `staging`                                          |

Credentials live in operator memory (`real_backend.md`, `deploy_target.md`)
and are injected into `values-staging.yaml` at deploy time via vault refs.
**No real credentials in this repo.**

## Pre-flight checklist

- [ ] kubeconfig context points at the staging cluster.
- [ ] `deploy/helm/sdm/values-staging.yaml` vault refs replaced with real
      values (CA_SDM_PASSWORD, SESSION_SECRET, SENTRY_DSN, BFF_REDIS_URL).
- [ ] Staging ingress hostname matches `BASE_URL`.
- [ ] DNS resolves to the staging ingress.
- [ ] TLS cert (`sdm-staging-tls` secret) provisioned.
- [ ] Sentry project ID + DSN provisioned (staging environment).

## Sequence + timings

### 1. Helm install — target < 3 min

```bash
BASE_URL=https://sdm-staging.example.com \
  bash scripts/release-dry-run.sh
```

| Step                     | Duration | Status |
| ------------------------ | -------- | ------ |
| `helm upgrade --install` | _Xm Ys_  | _OK_   |
| Pod ready wait           | _Xm Ys_  | _OK_   |
| Warm-up (30 s fixed)     | 30 s     | —      |
| `/readyz` first 2xx      | _Xs_     | _OK_   |

### 2. BFF auth handshake — CA SDM 17.4 verification

- [ ] BFF logs show successful `vueuser` access-key acquisition against
      `10.11.35.35:8050`.
- [ ] `/readyz` returns 200 within 60 s of pod Ready.
- [ ] First `/api/me` round-trip returns a real tenant list (not the
      fallback mock).

### 3. Live 18-journey acceptance suite

Recorded by `acceptance-live.yml` (or local Playwright run via the
dry-run script). Paste the per-journey result table or check off the
matrix below.

| #   | Journey ID                             | Result  | Notes (latency / flake / blocker) |
| --- | -------------------------------------- | ------- | --------------------------------- |
| 1   | portal-incident-broken-laptop          | _pass/_ |                                   |
| 2   | portal-request-software                | _pass/_ |                                   |
| 3   | portal-kb-self-help                    | _pass/_ |                                   |
| 4   | workspace-incident-triage              | _pass/_ |                                   |
| 5   | workspace-incident-resolve-with-cmdb   | _pass/_ |                                   |
| 6   | workspace-incident-escalate-to-l2      | _pass/_ |                                   |
| 7   | workspace-problem-rca                  | _pass/_ |                                   |
| 8   | workspace-cmdb-impact-analysis         | _pass/_ |                                   |
| 9   | workspace-incident-deep-dive           | _pass/_ |                                   |
| 10  | workspace-change-cab-prep              | _pass/_ |                                   |
| 11  | workspace-change-emergency-approve     | _pass/_ |                                   |
| 12  | workspace-change-cross-tenant-conflict | _pass/_ |                                   |
| 13  | workspace-kb-author-new                | _pass/_ |                                   |
| 14  | workspace-kb-from-incident             | _pass/_ |                                   |
| 15  | workspace-kb-analytics-review          | _pass/_ |                                   |
| 16  | workspace-cmdb-ci-detail               | _pass/_ |                                   |
| 17  | workspace-cmdb-relationship-impact     | _pass/_ |                                   |
| 18  | workspace-cmdb-cross-tenant-shared     | _pass/_ |                                   |

**Totals**: _ pass / _ fail (target: 18/18).

### 4. Rollback test — target RTO < 5 min

```bash
BASE_URL=https://sdm-staging.example.com \
  bash scripts/rollback-test.sh
```

| Step                                   | Duration | Status |
| -------------------------------------- | -------- | ------ |
| `helm rollback 0`                      | _Xm Ys_  | _OK_   |
| `/readyz` recovered                    | _Xs_     | _OK_   |
| Critical-path subset (5 journeys)      | _Xm Ys_  | _OK_   |
| **Total RTO** (rollback start → green) | _Xm Ys_  | _OK_   |

### 5. Performance baseline — live BFF

Run Lighthouse mobile against `${BASE_URL}/`:

| Metric            | Mock baseline (LHCI) | Live target | Live result |
| ----------------- | -------------------- | ----------- | ----------- |
| Performance score | ≥ 0.9                | ≥ 0.9       |             |
| TTI               | ≤ 1.8 s              | ≤ 2.5 s     |             |
| LCP               | ≤ 2.2 s              | ≤ 3.0 s     |             |
| Initial JS budget | 180 KB               | 180 KB      |             |
| BFF p50 `/api/me` | —                    | ≤ 250 ms    |             |
| BFF p95 `/api/me` | —                    | ≤ 800 ms    |             |

### 6. Sentry capture verification

- [ ] Deliberate test crash (visit `/diag/throw` or trigger
      `Sentry.captureException` from DevTools) results in a Sentry event
      in the `staging` environment.
- [ ] Event has `release: 1.0.0-rc.1` tag.
- [ ] Event has tenant + actor tags scrubbed per I.3 `sanitizeSentryEvent`.

### 7. Multi-tenancy live verification

- [ ] Tenant switch flushes BFF cache (verify `X-Response-Tenant` header
      matches the switched-to tenant on the next API call).
- [ ] Cross-tenant deep link returns 404 (not 403) per I.3 contract.
- [ ] sp_admin "All my tenants" overlay surfaces real cross-tenant data.

### 8. Step-up 2FA — live test

- [ ] OIDC step-up flow round-trips against the staging IdP, OR
- [ ] Mock OIDC mode acceptable per I.1 §Open if staging IdP unavailable.
- [ ] EMERGENCY change approval requires `X-Step-Up-Token` (BFF rejects
      missing token with 403 + `details.op: cab.approve.denied_step_up`).

## Go / no-go decision

### GO criteria (all must hold)

- 18 / 18 journeys green (or explicit deviation note + low-severity
  Phase I.x patch tracked).
- Rollback RTO < 5 min.
- Sentry receives staging events with correct release tag + scrubbed
  payload.
- BFF /readyz stable for 5 min post-deploy (no restart loop).
- Multi-tenancy contracts (header + 404 + sp_admin overlay) live-verified.

### NO-GO triggers

- Any P0 (login / queue / ticket-create / ticket-resolve broken).
- Any P1 in 3+ journeys (systemic backend-shape divergence).
- Rollback fails or exceeds RTO target.
- Sentry pipeline broken (no events arrive within 2 min of crash).
- Secret leak in audit log or Sentry payload (anywhere → hard block).

### Decision

- [ ] **GO** — proceed to I.7 v1.0 cut.
- [ ] **NO-GO** — remediation chunk required before I.7. See follow-ups
      below.

## Follow-ups

| Issue | Severity | Owner | Tracked in |
| ----- | -------- | ----- | ---------- |
|       |          |       |            |

## Sign-off

| Role         | Handle | Timestamp |
| ------------ | ------ | --------- |
| Operator     |        |           |
| Parent agent |        |           |
| Ops contact  |        |           |
