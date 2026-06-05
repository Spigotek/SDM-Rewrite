# `/clear`-ready prompt — J.0 unblock: provision runtime + deploy v1.1.0 + live smoke

> Použitie: po `/clear` v novom chate paste-ni text nižšie. Tento prompt je samostatne self-contained
> (neodkazuje na conversation history) — fresh agent musí vystačiť s memory + repo + týmto promptom.

---

Pokračujeme SDM-Rewrite. **v1.0.0 ✅ RELEASED** (2026-06-03) + **v1.1.0 ✅ RELEASED** (2026-06-05,
retagged on `813b99c` po J.9.1 release.yml lowercase hotfix). **Phase J ✅ COMPLETE** code-side
(8 chunks + 2 N/A + 1 deferred + 1 hotfix). Posledný open item: **J.0 — staging deploy + live BFF
smoke + rollback test** — odložený od 2026-06-04 lebo on-prem host `10.11.36.21` nemal žiadny
container runtime. Najbližšia úloha: **provision runtime + deploy v1.1.0 + live smoke +
RELEASE-DRY-RUN.md fill**, čo zatvorí J.0 a finalizuje Phase J ops-side.

## Released artifacts (pripravené na pull)

- **Helm OCI chart**: `oci://ghcr.io/spigotek/charts/sdm:1.1.0` (4.9 KB,
  sha256 `e45afba...`)
- **Container images** (všetky multi-arch `linux/amd64` + `linux/arm64`):
  - `ghcr.io/spigotek/sdm-bff:1.1.0` (also `:1.1`, `:latest`)
  - `ghcr.io/spigotek/sdm-portal:1.1.0`
  - `ghcr.io/spigotek/sdm-workspace:1.1.0` (NOVÉ multi-arch v1.1 per J.1; v1.0 bol amd64-only)
- **GitHub Release**: https://github.com/Spigotek/SDM-Rewrite/releases/tag/v1.1.0
  - `sdm-1.1.0.tgz` asset
- **CA SDM dev/test backend** (per memory `real_backend.md`): `http://10.11.35.35:8050` (vueuser,
  Basic Auth). Reachable from network on the dev machine; **must verify reachability from the
  deploy host (10.11.36.21) before BFF can authenticate** — separate network/routing concern.

## Deploy target

Per memory `deploy_target.md`:

- **Host**: `10.11.36.21` Ubuntu 24.04.4 LTS
- **SSH**: `sshpass -p '<password>' ssh soisd@10.11.36.21` (creds in memory, NEVER commit)
- **Sudo**: same password via `echo '<password>' | sudo -S <cmd>`
- **App port (public)**: 88 (port 80/443 už beží legacy SoimcoDesk nginx)
- **Existing services** (per host probe 2026-06-04): nginx (80/443), postgresql@17, redis,
  soimcodesk-api, soimcodesk-worker
- **NO container runtime** (no docker, podman, k3s, microk8s, nerdctl, crictl, ctr) — toto je
  prerequisite, ktoré J.0 musí vyriešiť ako prvé

## Sensitive-ops escalation policy

Tento chunk **vyžaduje destruktívne ops na shared host** (apt install, systemd enable, port
binding, secret material handling, helm install proti future cluster). Per global CLAUDE.md
"Ask before: server restarts, DB migrations on production". Autonomous agent **MUSÍ eskalovať
cez AskUserQuestion pred každou destruktívnou alebo network-exposing op**, najmä:

- `sudo apt install` na host
- `sudo systemctl enable/start` nového service
- nginx vhost zmena (potenciálne ovplyvní legacy SoimcoDesk)
- helm install / upgrade do real (sub)clustera
- vault refs substitution + secret material handling
- DNS / TLS provisioning

User-driven kroky (operator ručne, agent NEROBÍ): editácia DNS, TLS cert issue, registry creds
acquisition.

## Workflow pre J.0 unblock

### Fáza A — Runtime decision (operator-gated)

Eskaluj cez AskUserQuestion: aký runtime nainštalovať na host? Tri reálne cesty:

1. **k3s single-node** — najľahší k8s (50 MB binárka, embedded etcd, traefik ingress).
   Najbližšie k v1.1 helm chart-u (helm + kubectl natívne). Port collision risk: traefik
   defaultne berie :80/:443 — treba override na iné porty (e.g. :8800/:8443) lebo nginx tam
   už beží. Cca 30 min sysadmin setup + restart of nginx port maybe.
2. **docker + docker-compose** — najjednoduchšie, ale helm chart sa nedá použiť (helm =
   k8s-only). Treba prepísať deploy na compose stack — net-new chunk work (~ 1 deň). Helm
   chart ostane validated len ako artefakt, nie deployovaný.
3. **microk8s** — snap-based k8s. Snapd už beží na hoste. Podobne k3s ale s addon ecosystem.
   Port collision rovnaký.

Recommendation: **k3s** s ingress na :8800/:8443 (alebo :88/:443 ak nginx môže byť presunutý
na :8000). Helm chart funguje out-of-the-box, J.1.1 hotfix funguje, multi-arch images sa
správne pullnu.

### Fáza B — Prereq provisioning (operator + agent split)

Pre k3s cestu:

1. **Operator** (sudo na host):
   - `curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--disable traefik" sh -` (skip traefik
     ak chcem vlastný ingress namiesto kolízie s nginx)
   - `kubectl get nodes` overí
   - `helm version` (nainštalovať helm cez script alebo apt)
   - Export `~/.kube/config` pre `soisd` user (chmod 600)
2. **Agent** (cez SSH read-only verifikácia, alebo cez user-relayed kubeconfig):
   - `kubectl cluster-info`
   - `kubectl get storageclass` (k3s ships local-path-provisioner default)
   - Create namespace `sdm-staging`
3. **Operator + agent split** na secrets:
   - Operator generuje SESSION_SECRET (`openssl rand -hex 32`)
   - Operator získa Sentry DSN pre staging (alebo opt-out: `SENTRY_DSN: null`)
   - Operator decide na vault tooling (External-Secrets / sealed-secrets / inline values-staging.local.yaml)
   - Agent connects to CA SDM `10.11.35.35:8050` z hosta (cez `kubectl exec` z BFF podu raz
     deployed) overí auth proti `vueuser:Vue@user123!` (memory `real_backend.md`)
4. **DNS + TLS** (operator):
   - DNS A record `sdm-staging.<corp-domain>` → `10.11.36.21` (alebo `/etc/hosts` na klient
     test boxoch)
   - TLS cert (cert-manager + Let's Encrypt ak prístupné, alebo self-signed mkcert)
   - Provisioning ingress controller (nginx-ingress chart, alebo k3s traefik enable back-on)

### Fáza C — Deploy v1.1.0

1. Pull chart: `helm pull oci://ghcr.io/spigotek/charts/sdm --version 1.1.0`
2. Substitute secrets do `values-staging.local.yaml` (kopia z repo, mode 600, mimo git):
   - `CA_SDM_PASSWORD` (real_backend.md memory)
   - `CA_SDM_ACCESS_KEY` (initially blank — broker bootstraps)
   - `SESSION_SECRET` (random hex)
   - `SENTRY_DSN` (staging project DSN, OR `null`)
   - `BFF_REDIS_URL` (initially deferred — F.5 session in-memory acceptable per MVP failover
     doc)
3. Verify image tags v values-staging — `1.1.0` per Chart bump (J.9). Override ak treba:
   ```
   --set image.tag=1.1.0 --set bff.image.tag=1.1.0 \
   --set portal.image.tag=1.1.0 --set workspace.image.tag=1.1.0
   ```
4. **Eskaluj user-ovi pred helm install** — toto je destruktívna op na shared host.
5. `bash scripts/release-dry-run.sh` proti staging cluster s BASE_URL ENV.
   Skript:
   - `helm upgrade --install sdm ./sdm -n sdm-staging --create-namespace --wait`
   - Wait for pod ready (300 s timeout)
   - Warm-up 30 s
   - `curl ${BASE_URL}/readyz` retry 12× × 5 s
   - 18-journey Playwright proti live BFF (chromium, list reporter)
6. Capture timings, journey table, BFF /readyz first 2xx.

### Fáza D — Rollback test

1. **Eskaluj user-ovi** pred `helm rollback` (destruktívna, mení revision history).
2. `bash scripts/rollback-test.sh` — `helm rollback sdm 0` + readyz probe + critical-path
   5-journey subset.
3. Capture RTO (target < 5 min).

### Fáza E — Out-of-band checks

Manuálne (operator alebo agent cez SSH/curl/headless browser):

- **Sentry**: visit `${BASE_URL}/diag/throw` (pripravený endpoint? otestovať existenciu;
  inak `Sentry.captureException` z DevTools console) → verify event in staging environment +
  release tag `1.1.0` + scrubbed payload (G.3 baseline).
- **Multi-tenancy**: tenant switch → verify `X-Response-Tenant` header flush; cross-tenant
  deep link → 404 (not 403) per I.3 contract.
- **Step-up 2FA**: EMERGENCY change approve without `X-Step-Up-Token` → 403 + audit
  `data.chg.write` s `details.op=cab.approve.denied_step_up`.
- **SSE (J.3)**: open `${BASE_URL}/api/events` cez `curl -N` (cookie auth potrebné) → verify
  heartbeat lines every 30s + `connected` event on open.
- **KB image upload (J.5)**: `curl -F file=@test.png ${BASE_URL}/api/attachments/kb` cez
  authenticated cookie → expect 201 + returned URL → `curl ${BASE_URL}${url}` → expect 200
  - image bytes.
- **Calendar drag-resize (J.6)**: harder to test cez curl — overiť cez headless Playwright
  alebo manually v browseri.
- **PWA (J.7)**: `curl ${BASE_URL}/manifest.webmanifest` → 200 + valid JSON; visit
  `${BASE_URL}/` in Chrome → install prompt visible; offline navigation falls back to
  cached shell.
- **LCP (J.8)**: `npx lhci collect --url ${BASE_URL}/` mobile preset → LCP ≤ 4000 ms target
  (per I.0 calibrated threshold; J.8 fix should bring it well under).

### Fáza F — Fill RELEASE-DRY-RUN.md + acceptance-coverage Live BFF column

1. `docs/RELEASE-DRY-RUN.md` template fill:
   - Metadata (Date, Executor, Chart version 1.1.0, Image tag 1.1.0, Cluster context,
     Namespace `sdm-staging`, Base URL, CA SDM backend, Sentry env)
   - Pre-flight checklist (each item ✅/❌)
   - Sequence + timings (helm install, pod ready, warm-up, /readyz, 18-journey)
   - Rollback durations + RTO
   - Performance baseline (Lighthouse, BFF p50/p95)
   - Sentry capture verification
   - Multi-tenancy live verification
   - Step-up 2FA live test
   - Go / no-go decision (all GO criteria → check; any NO-GO trigger → escalate remediation
     chunk)
2. `docs/agents/qa-test-strategy/acceptance-coverage.md` — Live BFF column flip per row:
   - 18 journey rows + §4.2 security vectors → ✅ (or ❌ + Phase K.x patch note)
3. ROADMAP `Aktuálny stav` banner update — J.0 ⏸ → ✅ DONE + Phase J fully closed
   (ops-side).
4. Memory `v1_1_released.md` MOD — "Outstanding pre-validation" → "Live cluster deploy
   GO/NO-GO 2026-MM-DD per RELEASE-DRY-RUN.md".

### Fáza G — Commit + push

Direct main commit `docs(J.0): live smoke results + GO/NO-GO + Phase J ops closure`. No PR
(docs-only pattern per J.0/J.2/J.4 closures + memory `feedback_pr_flow.md` exception for
post-mortem fills).

## Done-when

- [ ] Container runtime provisioned on `10.11.36.21` (k3s / microk8s / docker).
- [ ] DNS + TLS + Sentry DSN provisioned (or explicit opt-out documented).
- [ ] `helm upgrade --install sdm oci://ghcr.io/spigotek/charts/sdm --version 1.1.0
    -n sdm-staging` succeeds.
- [ ] 18/18 journey acceptance suite green proti live BFF (or explicit deviation note +
      Phase K.x patch tracked).
- [ ] Rollback test succeeds with RTO < 5 min.
- [ ] Sentry receives staging events with release `1.1.0` + scrubbed payload.
- [ ] Multi-tenancy + step-up 2FA + SSE + KB upload + PWA + LCP all live-verified.
- [ ] `docs/RELEASE-DRY-RUN.md` filled (no placeholders).
- [ ] `acceptance-coverage.md` Live BFF column flipped per row.
- [ ] `docs/ROADMAP.md` J.0 ⏸ → ✅ DONE; Phase J banner reflects full ops closure.
- [ ] Memory `v1_1_released.md` "Outstanding pre-validation" section struck or updated.

## Hard rules pre tento chunk

- **Eskaluj pred každou destruktívnou op** na shared host (apt, systemctl, nginx, helm,
  rollback).
- **NIKDY heslo do repo / commit / PR body.** Cluster creds, CA SDM password, SESSION_SECRET,
  Sentry DSN — všetko cez env / vault / inline-local-yaml mimo git.
- **NIKDY nepushuj na git --force.** Tag immutability vyžaduje proper hotfix chunk ak treba.
- **Žiadny paralelný subagent dispatch** — ops linear sequence.
- **NEVYTVÁRAJ stacked PR-y** — fresh main pre každý hypothetical follow-up chunk
  (per memory `feedback_pr_flow.md`).
- **Bundle budgets + audit taxonomy frozen** — žiadne code changes v tomto chunku
  (purely ops + docs fill).
- **Failure modes**:
  - P0 (any /readyz fail → STOP + rollback + remediation chunk)
  - P1 (any journey fail v MSW-pass scenarios → block GO + Phase K.x patch)
  - P2 (perf regression > 50% vs LHCI baseline → flag + investigate, not block)

## Postup keď začneš (prvé akcie)

1. Prečítaj `docs/RELEASE-DRY-RUN.md` template + `scripts/release-dry-run.sh` +
   `scripts/rollback-test.sh` end-to-end (kontextová baseline).
2. Prečítaj `docs/RELEASE-NOTES-v1.1.md` (v1.1 deltas vs v1.0) + `docs/plans/J.0.md`
   (deferred-state docs).
3. `git status` (čistý main) + `git log --oneline -8` (verify posledný relevant commit je
   J.9.1 hotfix + ROADMAP banner updates).
4. `gh release view v1.1.0` — verify release exists + chart .tgz attached.
5. SSH probe `soisd@10.11.36.21` read-only — verify what's on the host now (runtime still
   missing? something installed since 2026-06-04?).
6. CA SDM reachability probe z localhost (verify `10.11.35.35:8050` still up before deploy).
7. **Eskaluj user-ovi runtime decision** cez AskUserQuestion (k3s vs microk8s vs docker vs
   defer-again).
8. Per user decision → continue podľa Fáza B-G vyššie.

Ak narazíš na nejasnosť mimo tento prompt scope, eskaluj cez AskUserQuestion pred dispatch-om
akejkoľvek destruktívnej op. Nehádaj. Drž sa principu "code is shipped, ops is operator-led".

## Z čoho čerpať kontext (memory + repo)

Memory (auto-loaded):

- `MEMORY.md` index
- `deploy_target.md` — on-prem host creds + port 88
- `real_backend.md` — CA SDM 17.4 dev creds (vueuser)
- `v1_0_released.md` — v1.0 release context
- `v1_1_released.md` — v1.1 release context (READ THIS — outstanding pre-validation list)
- `feedback_pr_flow.md` — PR-flow discipline (this chunk has docs-only exception)
- `user_communication.md` — Slovak chat, English code

Repo:

- `docs/RELEASE-DRY-RUN.md` — post-mortem template (operator fills)
- `docs/RELEASE-NOTES-v1.1.md` — what changed vs v1.0 (Lucia/Anna/Peter/Jana/SP-admin deltas)
- `docs/RELEASE-NOTES-v1.0.md` — v1.0 baseline
- `docs/plans/J.0.md` — current deferred state docs (unblock criteria)
- `docs/plans/J.{1..9}.md` — what shipped in v1.1 (per-chunk outcomes)
- `scripts/release-dry-run.sh` + `scripts/rollback-test.sh` — I.6 ops scripts
- `deploy/helm/sdm/values-staging.yaml` — vault-ref placeholders, image tag 1.1.0
- `deploy/helm/sdm/Chart.yaml` — version 1.1.0, appVersion 1.1.0
- `docs/agents/qa-test-strategy/acceptance-coverage.md` — Live BFF column to fill
- `docs/agents/devex-devops/real-backend-contracts.md` — CA SDM live API shapes
- `.github/workflows/release.yml` — frozen post J.9.1 hotfix (no changes in this chunk)

Goal: deploy success → fill docs → J.0 ✅ DONE → Phase J fully closed → end-of-session.
