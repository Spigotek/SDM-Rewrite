# I.7 — v1.0 cut (semver tag + image push + OCI helm publish + release notes)

> **Status**: 🔁 in-review (parent flips → ✅ DONE post-merge + tag push)
> **Branch**: `chunk/I.7-v1.0-cut` > **PR**: TBD
> **Cieľ**: cut v1.0.0 — semver git tag, container images push do registry,
> helm chart publish ako OCI artifact, CHANGELOG.md + RELEASE-NOTES-v1.0.md.
> **Final Phase I chunk** — celá Phase I + projekt = **v1.0 RELEASED**.

## Pivot vs ROADMAP

Per ROADMAP §Phase I: "I.5 v1.0 cut — semver tag, image push, helm OCI publish,
release notes." Renumbered to I.7.

I.6 dry-run validated full stack — I.7 cuts the actual release.

## Inputs

- **`.github/workflows/release.yml`** — existing release workflow (C bootstrap pattern). May need rev pre OCI publish.
- **`deploy/helm/sdm/Chart.yaml`** — chart version. Post-I.6 = `1.0.0-rc.1`. I.7 cuts → `1.0.0`.
- **`docs/RELEASE-DRY-RUN.md`** — I.6 output, gate checkpoint.
- **All Phase summaries** (`docs/agents/.../*.md` + ROADMAP entries) → aggregated do RELEASE-NOTES.
- **Memory `deploy_target.md`** — registry endpoint.

## Outputs

```
deploy/helm/sdm/Chart.yaml                  # MOD: version 1.0.0-rc.1 → 1.0.0
.github/workflows/release.yml               # MOD: helm package + push to OCI registry; image tag matrix
docs/CHANGELOG.md                           # NEW: aggregated per-phase changelog (E/F/G/H/I)
docs/RELEASE-NOTES-v1.0.md                  # NEW: user-facing release notes (features, breaking changes, migration, known issues)
docs/ROADMAP.md                             # I.7 → ✅ DONE; Phase I → ✅ DONE; PROJECT v1.0 RELEASED
docs/plans/I.7.md                           # Status DONE
```

## Done-when

- [ ] **Chart version bump**: `Chart.yaml` `version: 1.0.0`. App version `1.0.0`.
- [ ] **Container images pushed**: portal + workspace + BFF images tagged `1.0.0` + `1.0` + `latest`, pushed to registry per `deploy_target.md`.
- [ ] **Helm OCI publish**: `helm package deploy/helm/sdm` + `helm push sdm-1.0.0.tgz oci://<registry>/charts`. Chart available via `helm pull oci://<registry>/charts/sdm --version 1.0.0`.
- [ ] **Git tag**: `v1.0.0` annotated tag on merge commit. Tag message points k RELEASE-NOTES.
- [ ] **GitHub Release**: created s tag `v1.0.0`, attached RELEASE-NOTES.md body, artifacts (chart tgz, image manifest).
- [ ] **CHANGELOG.md**: aggregated changelog per phase (E, F, G, H, I) + chunk list.
- [ ] **RELEASE-NOTES-v1.0.md**: user-facing — features (incident/request/change/problem/CMDB/KB/multi-tenancy), known issues (deferred items from Phase H follow-ups still open), migration notes (if any from earlier rc), credits.
- [ ] ROADMAP toggle: I.7 → ✅ DONE; Phase I → ✅ DONE; status banner = **v1.0 RELEASED**.
- [ ] Post-release smoke: triggered manual `acceptance-live.yml` against newly-deployed v1.0.0 cluster (uses I.6 staging or fresh install) — 18/18 pass.

## Stratégia

### Fáza A — Chart + workflow

1. Bump `deploy/helm/sdm/Chart.yaml` version `1.0.0-rc.1` → `1.0.0`. AppVersion `1.0.0`.
2. `release.yml` workflow update:
   - Trigger: on push tag `v*.*.*`.
   - Jobs:
     - `images`: build + push portal/workspace/BFF images s tag matrix [`${{ github.ref_name }}`, `${{ semver-major-minor }}`, `latest`].
     - `helm`: `helm package` + `helm push oci://<registry>/charts`.
     - `release`: create GitHub Release from tag, attach chart tgz.
3. Verify workflow proti rc tag first (e.g., `v1.0.0-rc.2`).

### Fáza B — Release docs

1. `docs/CHANGELOG.md` v Keep-a-Changelog format:

   ```markdown
   ## [1.0.0] - 2026-MM-DD

   ### Phase H — Feature modules (MVP)

   - H.0 React Router 6 + TanStack Query data router infrastructure
   - H.1 Tenant switcher activation s server-side cache invalidation
   - ... (17 chunks)

   ### Phase I — Acceptance + production hardening + release

   - I.0 LHCI MSW-in-LHCI graduation
   - I.1 Step-up 2FA + emergency approve
   - ... (8 chunks)

   ### Known issues

   - Mobile PWA offline mode (planned v1.1)
   - Advanced calendar drag-resize (planned v1.1)
   - KB analytics widgets (planned v1.1)

   ### Migration notes

   - No prior versions — initial public release.
   ```

2. `docs/RELEASE-NOTES-v1.0.md` user-facing:
   - Hero summary: "Service Desk Management v1.0 — MVP release"
   - Persona-keyed feature list (Lucia: report incident, request software, browse KB; Anna: triage queue, resolve tickets; Peter: manage changes, CAB approval; Robert: CMDB inventory, relationship graph; Marek: problem RCA; Jana: KB authoring)
   - Multi-tenancy ready (M.0 + H.1)
   - Security baseline (I.2 audit clean)
   - Performance: portal 162 KB / mobile TTI < 1.8s; workspace 176 KB / desktop TTI < 2.5s
   - Compatibility: Chrome/Edge 120+, Firefox 120+, Safari 17+
   - Deployment: Helm chart `oci://<registry>/charts/sdm:1.0.0`
   - Known issues + roadmap v1.1+

### Fáza C — Tag + publish + post-release smoke

1. Merge PR; immediately post-merge create signed tag `v1.0.0` annotated s release notes pointer.
2. Push tag → triggers `release.yml`.
3. Verify GitHub Release artefakty + registry images + helm OCI.
4. Run `acceptance-live.yml` manual proti newly-deployed cluster.
5. Update ROADMAP `Aktuálny stav` → `v1.0 RELEASED (2026-MM-DD)`.

## Open questions / risks — recommended resolutions

- **Registry credentials**: GitHub Secrets `REGISTRY_USERNAME` + `REGISTRY_PASSWORD` for image push. Already configured per existing `release.yml`.
- **Helm OCI registry endpoint**: per `deploy_target.md` on-prem registry. Verify supports OCI helm (some registries don't). Fallback: GitHub Container Registry (ghcr.io) OCI helm publish.
- **Tag signing**: optional GPG signing — out of MVP scope unless legal requires.
- **Rollback path**: if v1.0.0 has critical bug post-release, helm rollback via I.6 rollback-test script.
- **Versioning of follow-ups**: deferred items from Phase H/I deferred → `v1.0.x` patch releases via sequential `chunk/v1.0.x-<fix>` branches OR `v1.1.0` for additive features (mobile PWA, drag-resize). **NIE** retroactive patches do v1.0.0.

## Notes pre subagenta

- I.7 je release-specific — žiadne app code changes. Doc + workflow + chart bump iba.
- Subagent prepares everything. **Parent triggers actual tag creation** — `git tag v1.0.0 -a -m "..." && git push origin v1.0.0` — to je sensitive op.
- Subagent **NESMIE**:
  - Vytvoriť git tag (parent's responsibility).
  - Push images / chart (CI does via workflow).
  - Mergovať vlastný PR.
