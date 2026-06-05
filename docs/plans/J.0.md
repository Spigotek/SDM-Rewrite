# J.0 — v1.1 staging deploy + live BFF smoke + rollback test

> **Status**: 🟡 PARTIAL — runtime provisioned, stack stands up cleanly for portal + workspace,
> BFF v1.1.1 boots correctly post-hotfix, but an intra-/19 firewall/ACL/VLAN-isolation rule
> prevents `10.11.36.21` from reaching CA SDM `10.11.35.35:8050` over TCP, so the BFF cannot
> complete its broker bootstrap. Live smoke + rollback + GO/NO-GO **gated on B2 network fix**.
> **Branch**: docs-only on `main`; one upstream PR `fix/bff-dockerfile-cmd` (#57) cut as the J.0.1
> v1.1.1 hotfix for the BFF image defect this chunk surfaced.
> **Outcome**: significant progress vs the 2026-06-04 deferred state. Container runtime is live
> (Docker 29.1.3 + compose v2.40.3 + containerd 2.2.1 on Ubuntu 24.04.4 LTS). Compose-based
> deploy shape designed + transferred (`deploy/docker/`). v1.1.0 BFF Dockerfile bug found +
> shipped as **v1.1.1 hotfix** (PR #57 → tag `v1.1.1`). Portal + workspace `1.1.1` images
> healthy on host. BFF `1.1.1` boots cleanly to `bff: started` log line in ~1 s. `/readyz`
> remains 503 because CA SDM 17.4 dev backend `10.11.35.35:8050` is **TCP-unreachable** from
> `10.11.36.21` — both hosts share the `10.11.32.0/19` supernet, so this is not an inter-subnet
> routing problem but an intra-/19 ACL (likely a host firewall on `10.11.35.35`, a VLAN
> isolation rule on the L2 fabric, or an IPS policy). Routing OK; nc/curl timeout from host
> shell and BFF container alike. This is the "separate network/routing concern" the original
> J.0 prompt flagged; resolution is operator-side via the network team.

## Cieľ

Validate the v1.0 release against a real cluster + real CA SDM 17.4 backend:

- helm install of `oci://ghcr.io/spigotek/charts/sdm:1.0.0` against on-prem staging cluster.
- Live 18-journey acceptance smoke (chromium) via `playwright.config.live.ts`.
- Rollback test (RTO < 5 min) per `scripts/rollback-test.sh`.
- Fill `docs/RELEASE-DRY-RUN.md` with live numbers + GO/NO-GO verdict.
- Update `docs/agents/qa-test-strategy/acceptance-coverage.md` "Live BFF" column per row.

## Pivot vs ROADMAP

`J.md` lists J.0 as P0 HARD BLOCKER prerequisite for J.1+. **This chunk does not block J.1-J.8**
(feature work) when the blocker is purely infrastructure provisioning. J.1-J.8 ship MSW + unit +
multi-browser coverage and remain reversible; J.9 (v1.1 cut) **does** require J.0 GO before tag —
release of v1.1 without ever exercising v1.0 deploy would compound un-validated layers.

The original I.6 scaffolding (PR #47) assumed kubeconfig + helm + cluster ready at v1.0 release
time. That assumption was not invalidated by Phase I closure — it was simply never exercised. Phase J
opens with the gap visible.

## Inputs (when unblocked)

- **`docs/RELEASE-DRY-RUN.md`** — post-mortem template (I.6). Fill Metadata, Pre-flight,
  Sequence + timings, Rollback, Performance baseline, Sentry, Multi-tenancy, Step-up 2FA, Go/No-Go,
  Sign-off.
- **`scripts/release-dry-run.sh`** — orchestrator (helm install + pod wait + readyz + 18-journey).
- **`scripts/rollback-test.sh`** — rollback + top-5 critical-path smoke (RTO target < 5 min).
- **`deploy/helm/sdm/values-staging.yaml`** — vault-ref placeholders; operator substitutes real
  values (CA_SDM_PASSWORD, SESSION_SECRET, SENTRY_DSN, BFF_REDIS_URL) at deploy time. **Bump
  `tag: "1.0.0-rc.1"` → `tag: "1.0.0"`** before install (template still references rc.1 from I.6).
- **`docs/agents/qa-test-strategy/acceptance-coverage.md`** — "Live BFF" column to fill per row.
- **`docs/agents/devex-devops/real-backend-contracts.md`** — CA SDM 17.4 contract expectations.
- **Memory `deploy_target.md`** — on-prem host 10.11.36.21 (soisd / port 88).
- **Memory `real_backend.md`** — CA SDM creds (vueuser).

## Outputs (when unblocked)

```
docs/RELEASE-DRY-RUN.md                             # FILLED (Metadata, timings, journey table, RTO, Sentry, GO/NO-GO)
docs/agents/qa-test-strategy/acceptance-coverage.md # "Live BFF" column per row
docs/ROADMAP.md                                     # J.0 ⏸ → ✅ DONE (or 🔴 NO-GO + remediation pointer)
docs/plans/J.0.md                                   # Status DEFERRED → DONE
```

**Direct commit on `main`** — no PR. Docs-only changes from operator-confirmed live results; PR
review adds no value for post-mortem fill, and gating J.1 dispatch on review round-trip would block
follow-up chunks unnecessarily. Commit message: `docs(J.0): live smoke results + GO/NO-GO`.

## Done-when (unblock criteria)

J.0 stays deferred until **all** of:

- [ ] Container runtime + orchestrator on deploy target (one of: k3s, microk8s, docker + compose
      plugin, or pre-existing k8s cluster with kubeconfig accessible to operator).
- [ ] DNS resolution for staging hostname (e.g. `sdm-staging.<host>` resolves to ingress IP).
- [ ] TLS cert provisioned (cert-manager + Let's Encrypt, self-signed, or pre-issued cert in
      `sdm-staging-tls` secret).
- [ ] Sentry project provisioned for `staging` environment, DSN available.
- [ ] Vault / sealed-secrets / inline-values strategy chosen for CA SDM creds + SESSION_SECRET +
      SENTRY_DSN + BFF_REDIS_URL (operator decision — not gated on tool choice).
- [ ] Operator can run `kubectl get nodes` / `helm ls` against the target cluster.

Once unblocked, J.0 completes when:

- [ ] `scripts/release-dry-run.sh` exits 0 against staging.
- [ ] 18/18 journeys pass (or explicit deviation + Phase I.x patch tracked).
- [ ] `scripts/rollback-test.sh` exits 0 + RTO < 5 min.
- [ ] Sentry receives staging events with `release: 1.0.0` tag + scrubbed payload.
- [ ] `docs/RELEASE-DRY-RUN.md` filled + GO box checked.
- [ ] `acceptance-coverage.md` "Live BFF" column updated per row.
- [ ] `docs/ROADMAP.md` J.0 → ✅ DONE.

## Stratégia (when unblocked)

### Fáza A — Pre-flight checklist

1. Operator confirms kubeconfig context, helm + kubectl versions, ingress class, TLS path.
2. Substitute `values-staging.local.yaml` (mode 600, never commit) with real secrets.
3. Verify GHCR pull works from cluster (image pull secret or anonymous pull for public packages).

### Fáza B — Deploy + smoke

1. `BASE_URL=https://<host> VALUES=/tmp/values-staging.local.yaml bash scripts/release-dry-run.sh`
2. Watch helm install timings, pod ready, /readyz first 2xx.
3. 18-journey live run; collect per-journey result table.

### Fáza C — Rollback test

1. `BASE_URL=https://<host> bash scripts/rollback-test.sh`
2. Measure rollback start → /readyz green → critical-5 green; target < 5 min.

### Fáza D — Out-of-band checks

1. Sentry crash + verify event arrives with release + scrub.
2. Multi-tenancy: tenant switch flushes BFF cache (X-Response-Tenant header validation).
3. Cross-tenant deep link → 404 (not 403) per I.3 contract.
4. Step-up 2FA: EMERGENCY change approve without `X-Step-Up-Token` → 403.
5. Lighthouse mobile against `${BASE_URL}/` — record numbers per RELEASE-DRY-RUN.md §5.

### Fáza E — Fill docs + commit

1. Parent agent (claude) fills `docs/RELEASE-DRY-RUN.md` from operator-supplied results.
2. Update `acceptance-coverage.md` Live BFF column per row.
3. Toggle `docs/ROADMAP.md` J.0 ⏸ → ✅ DONE.
4. `git commit -m "docs(J.0): live smoke results + GO/NO-GO"` on `main`.

### Fáza F — Branch decision

- **GO** → proceed to J.9 (v1.1 cut) with confidence; intermediate J.1-J.8 stayed reversible until
  this point.
- **NO-GO** → escalate via AskUserQuestion. Likely remediation = Phase I.x patch chunk (e.g. tenant
  WC sweep gap, BFF /readyz instability, audit emit divergence) before J.9.

## Open questions / risks — recommended resolutions

- **k3s vs docker-compose vs existing cluster** — depends on operator constraint. **Recommendation**:
  if SDM is the only workload on `10.11.36.21`, install k3s (single-node, lightweight, helm-native).
  If SoimcoDesk legacy must coexist on same host with current 80/443 nginx, consider docker-compose
  (re-package v1.0 deploy to plain compose stack and treat helm as v2.0 multi-node target). Decision
  out of J.0 scope — operator/sysadmin call.
- **values-staging.yaml `tag: "1.0.0-rc.1"`** — I.6 template stale. Bump to `"1.0.0"` before install
  (or pass `--set image.tag=1.0.0` + per-service overrides). Update template in repo if v1.1 reuses
  same path.
- **Workspace amd64-only** (per I.7 release.yml comment) — if target cluster is arm64, J.0 blocks
  on J.1 (workspace arm64 image) first. **Recommendation**: J.1 first regardless — small chunk,
  removes the dependency, gives the v1.1 cut full multi-arch parity.
- **Sentry staging project** — if not provisioned, set `SENTRY_DSN: null` in values and skip §6
  verification with explicit deviation note. Production cut requires real DSN.
- **18-journey live divergence** — journey-15 (kb-analytics) uses MSW fixture per I.4; real CA SDM
  has no KB analytics surface. Live result for #15 = N/A (deferred to J.4 real ingest). Document as
  deviation, do not mark NO-GO solely for #15 fail.

## Notes pre subagenta

**No subagent dispatch for J.0** — chunk is operator-driven (cluster provisioning + helm install +
secrets substitution). Parent agent (claude) only fills docs from operator-supplied results. If a
subagent is ever spawned for this chunk, it would be limited to read-only post-mortem document
authoring — never destructive cluster ops.

## Host probe summary (2026-06-04, parent agent)

Read-only SSH probe of `soisd@10.11.36.21` produced this inventory:

- Ubuntu 24.04.4 LTS, services: nginx (80/443), postgresql@17, redis, soimcodesk-api, soimcodesk-worker.
- **No container runtime installed** (docker, podman, k3s, microk8s, nerdctl, crictl, ctr — all
  missing). No snap packages.
- Port 88 (per `deploy_target.md`) not in listen list — SDM not yet deployed.
- `/opt`, `/srv` empty. `/home/soisd/` holds legacy SoimcoDesk `be_app.tar.gz` + `fe_dist.tar.gz`
  (tarball-style deploy, not container-based).

Autonomous claude declined to install k3s/docker via sudo — shared host running production legacy
SoimcoDesk + Postgres + Redis, blast radius too high for an autonomous session per global CLAUDE.md
"Ask before: server restarts / prod migrations" rule.

## Smoke session — 2026-06-06 (parent agent, operator-approved)

Operator selected **Docker compose** as the runtime path (single deploy unit, no k8s overhead;
ports 80/443 stay with the legacy SoimcoDesk nginx so the SDM stack lives on `:88` / `:89` via a
front-door nginx container). Plan was author-then-confirm, then execute the whole sequence under
single GO authorization.

### Fáza A — Compose stack design (committed in this chunk)

`deploy/docker/`:

- `compose.staging.yml` — 4 services: `bff` (Hono on `:5174` internal), `portal` (nginx-alpine
  serving the portal SPA on `:8080` internal), `workspace` (same shape for the workspace SPA),
  `frontdoor` (nginx:1.27-alpine reverse-proxy, the only service publishing host ports `88` and
  `89`). Healthchecks on all three backends; `depends_on: service_healthy` on the front-door so
  the public ports never accept traffic before the backends pass a probe. `bff-attachments` named
  volume mounts at `/var/lib/sdm/attachments-kb` (the J.5 storage path).
- `nginx-frontdoor.conf` — path-based routing on each public port: `/api/*`, `/auth/*`, `/me`,
  `/me/*`, `/config`, `/health*`, `/readyz` → BFF; `/api/events` carved out with `proxy_buffering
off` + `proxy_read_timeout 24h` to honour the J.3 SSE channel; everything else → portal (on
  :88) or workspace (on :89). `X-Forwarded-*` headers set, `client_max_body_size 16M` to clear
  the J.5 5 MB cap.
- `.env.staging.example` — env template only. Real `.env.staging` lives host-side at
  `/home/soisd/sdm-staging/.env.staging` mode 0600, never committed. `.gitignore` extended to
  block `deploy/docker/.env.staging` defensively.

The actual env contract used by BFF code (`apps/bff/src/config/load.ts`) is `CASDM_*` not the
`CA_SDM_*` names the helm chart `values-staging.yaml` uses — that long-standing chart-vs-code
divergence is **not fixed here** (out of J.0 scope), but the compose env block uses the
canonical names so the BFF actually reads them.

### Fáza B — Runtime provisioning (operator-approved, executed)

`sudo apt-get install -y docker.io docker-compose-v2` on `10.11.36.21` → Docker 29.1.3 +
containerd 2.2.1 + compose 2.40.3. `systemctl enable --now docker` → daemon active.
`usermod -aG docker soisd` → compose runs as `soisd` without sudo on the next login. Hello-world
container OK.

No nginx config on the host was touched; the legacy SoimcoDesk vhosts on `:80/:443` are
untouched. The front-door container binds only to `:88` and `:89`, both confirmed free at probe
time.

### Fáza C — Smoke (against v1.1.0, then v1.1.1)

First attempt against `1.1.0` failed instantly with `ERR_MODULE_NOT_FOUND: Cannot find package
'tsx'` in the BFF container. Root cause: `apps/bff/Dockerfile` shipped a chunk-1-era stub
`CMD ["node", "--import", "tsx/esm", "src/index.ts"]` against the dev-only `tsx` loader. The
image build actually produces `dist/index.js` via tsup and `pnpm deploy --prod` strips `tsx`, so
every BFF image since v1.0 crashed on boot — but the chart had never been exercised against a
real runtime (J.0 deferred all the way to today), so the defect was invisible to CI.

A one-line `command:` override in compose got the BFF process up locally, after which `/readyz`
exposed a second failure: BFF `fetch failed` against `http://10.11.35.35:8050/rest_access`.
Diagnosis from host shell:

- `nc -zv -w 5 10.11.35.35 8050` → timeout
- `nc -zv -w 3 10.11.35.{1,35,100}:22` → all timeout
- `ip route get 10.11.35.35` → routed via `ens18`, same /19 (10.11.32.0/19)
- From this dev Mac → `curl http://10.11.35.35:8050/caisd-rest/` returns HTTP 404 within 100 ms

→ **Intra-/19 ACL blocks the path `10.11.36.21 → 10.11.35.35:8050` entirely.** Both hosts share
the `10.11.32.0/19` supernet, so this is not an inter-subnet routing issue; the candidates are
a per-host firewall on `10.11.35.35`, a VLAN-isolation rule on the L2 fabric, or an IPS
policy. Not host-resolvable; requires the network team to open `10.11.36.21 → 10.11.35.35:8050`
(TCP) at whichever layer is enforcing the denial.

### Fáza D — Hotfix dispatch (PR #57 → v1.1.1, 2026-06-06)

User chose "fix the BFF Dockerfile + push a v1.1.1 hotfix now" over "document and defer".
Branch `fix/bff-dockerfile-cmd`, single-line CMD fix (`node dist/index.js`) + release-notes +
changelog entry, 10/10 CI checks green, squash `--admin --delete-branch` merge, tag `v1.1.1`,
release.yml run `27042436416` succeeded all 7 jobs (BFF + portal + workspace amd64/arm64 +
manifest + helm + GitHub release).

Re-pulled `:1.1.1` images on host, dropped the compose `command:` override, restarted the
stack. Result:

- `sdm-portal:1.1.1` — Healthy.
- `sdm-workspace:1.1.1` — Healthy.
- `sdm-bff:1.1.1` — boots cleanly in ~1 s (`bff: started` on `:5174`); `/readyz` returns 503
  on every probe because the CA SDM bootstrap still times out (B2 network gap). Manually
  stopped to suppress retry-log spam; container restart is a 2-second op once B2 is fixed.
- `sdm-frontdoor` — never created (`depends_on: bff service_healthy` gate). Will start
  automatically once BFF is healthy.

Hotfix release notes: [`RELEASE-NOTES-v1.1.1.md`](../RELEASE-NOTES-v1.1.1.md).

### Remaining work (gated on B2 network ACL fix)

1. Operator escalates to the network team: open `10.11.36.21 → 10.11.35.35:8050` (TCP) at
   whichever layer enforces the current denial — both hosts already share the same `10.11.32.0/19`
   supernet, so this is an intra-/19 ACL, not an inter-subnet routing issue.
2. Validate from host shell: `curl http://10.11.35.35:8050/caisd-rest/` returns a 200/404 within
   a second (anything that's not a TCP timeout).
3. `cd /home/soisd/sdm-staging && docker compose -f compose.staging.yml --env-file .env.staging
up -d` → expect BFF to bootstrap, frontdoor to start, `:88` to serve the portal.
4. Run the 18-journey live suite from the dev Mac:
   `BASE_URL=http://10.11.36.21:88 bash scripts/release-dry-run.sh` (the script targets
   `helm install`; for the compose path we run only the post-deploy `curl /readyz` + Playwright
   block).
5. Rollback test — `docker compose down` then up with `SDM_TAG=1.1.0` (the broken image, to
   verify rollback orchestration; expect known failure since v1.1.0 has the BFF CMD bug). Or
   skip until a second healthy revision exists.
6. Out-of-band checks (Sentry / SSE / multi-tenancy / step-up 2FA / KB upload / PWA / LCP) per
   §4 of `RELEASE-DRY-RUN.md`.
7. Fill `docs/RELEASE-DRY-RUN.md` GO/NO-GO matrix; flip `acceptance-coverage.md` Live BFF column
   per row; toggle this plan + ROADMAP to ✅ DONE.

### Sentry deviation

Prod GHCR images do not carry a Sentry DSN — `release.yml` does not pass `VITE_SENTRY_DSN` at
build time, so the SPA bundles initialise Sentry against an empty DSN and never POST to the
ingest endpoint. This is acceptable for the J.0 staging smoke (Sentry capture verification is
explicitly listed as deviation-tolerant in this plan's §Open questions). Production-grade
release will need a release.yml change to thread the staging DSN into the SPA builds, but that
is **out of J.0 scope** (separate v1.2+ ticket).
