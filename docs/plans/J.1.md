# J.1 — Workspace image multi-arch via native arm64 runner

> **Status**: 🔜 NEXT
> **Branch**: `chunk/J.1-workspace-arm64-native` > **Cieľ**: graduate workspace image z amd64-only (I.7 workaround per commit `6ff143a`) na true
> multi-arch (`linux/amd64` + `linux/arm64`) cez native `ubuntu-22.04-arm` GitHub-hosted runner +
> matching `ubuntu-latest` amd64 runner + manifest merge step. Closes the lone amd64-only image
> shipped in v1.0; aligns workspace with bff/portal multi-arch parity from v1.1.0 onwards.

## Pivot vs ROADMAP

`J.md §C5` lists workspace arm64 deferred z v1.0 — QEMU SIGILL na cross-compile v1.0.0 first try.
Fix per I.7 release.yml comment (lines 157-161): `runs-on: ubuntu-22.04-arm` native runner
namiesto QEMU emulation. GitHub-hosted `ubuntu-22.04-arm` runners sú GA per 2026-Q1 + **free for
public repos** (per GitHub free arm64 runners policy; `Spigotek/SDM-Rewrite` je public verified
2026-06-04 cez `gh repo view`).

Z J.0 sa tento chunk **neblokuje** — žiadna cluster dependency. CI-only change.

**Doc bug discovered while preparing this plan** (2026-06-04): `docs/RELEASE-NOTES-v1.0.md` §
Container images (lines 180-189) + `docs/CHANGELOG.md` § Deployment (lines 218-227) **incorrectly
claim** v1.0 workspace image is multi-arch. Per `release.yml:161` and commit `6ff143a`, v1.0
workspace is amd64-only. J.1 fixes both docs as part of scope.

## Inputs

- **`.github/workflows/release.yml`** — current workspace-image job lines 119-168 (amd64-only,
  comment block lines 157-160 explains the workaround + flags this exact follow-up).
- **`apps/workspace/Dockerfile`** — multi-stage node:22-alpine build → nginx:alpine runtime; build
  step is the SIGILL trigger (Cytoscape + FullCalendar + TipTap heavy deps).
- **`docs/RELEASE-NOTES-v1.0.md` §Container images (lines 180-189)** — stale multi-arch claim.
- **`docs/CHANGELOG.md` §Deployment (lines 218-227) + §Known issues (line 229+)** — same stale
  claim; Known issues should also gain workspace arm64 deferred → v1.1 entry.
- **GitHub Docs**: [Multi-platform images — distribute across runners](https://docs.docker.com/build/ci/github-actions/multi-platform/#distribute-build-across-multiple-runners)
  — canonical pattern (per-arch build + digest artifact + manifest merge).

## Outputs

```
.github/workflows/release.yml                       # MOD: workspace job split → amd64 + arm64 + manifest-merge
docs/RELEASE-NOTES-v1.0.md                          # FIX: clarify v1.0 workspace amd64-only; v1.1 promises multi-arch
docs/CHANGELOG.md                                   # FIX: same clarification + Known issues entry "Workspace arm64 → v1.1"
docs/agents/devex-devops/release-process.md         # MOD (if exists): document the multi-arch pattern; else no-op
docs/plans/J.1.md                                   # Status NEXT → DONE; PR #
docs/ROADMAP.md                                     # J.1 ⏳ → ✅ DONE; Aktuálny stav updated
```

**No Chart.yaml / values changes** — Helm doesn't care about image architecture; the kubelet picks
the matching variant from the multi-arch manifest at pull time.

## Done-when

- [ ] `.github/workflows/release.yml` workspace job splits into 3: - `workspace-image-amd64` on `ubuntu-latest` — builds + pushes by digest (no tag); - `workspace-image-arm64` on `ubuntu-22.04-arm` — builds + pushes by digest; - `workspace-manifest` (needs: amd64, arm64) — creates final multi-arch manifest via
      `docker buildx imagetools create` using the canonical tag matrix (semver, major-minor,
      latest, sha).
- [ ] `actionlint` clean (run via `pnpm exec actionlint` or `actionlint` binary).
- [ ] YAML syntax + job dependency graph correct (`gh workflow view release.yml --yaml` round-trip
      or local `yq` parse).
- [ ] `docs/RELEASE-NOTES-v1.0.md` § Container images updated: - Move BFF + portal to "Multi-arch (linux/amd64 + linux/arm64):" group. - Add separate "Single-arch (linux/amd64 only — see J.1 follow-up in CHANGELOG):" group
      for workspace.
- [ ] `docs/CHANGELOG.md` § Deployment updated same way; § Known issues gets a new bullet:
      `Workspace image is linux/amd64 only in v1.0 (QEMU SIGILL on cross-compile). Multi-arch
    lands in v1.1 via native arm64 runner — tracked in J.1.`
- [ ] PR opened, CI green on PR (actionlint workflow if exists, plus the existing ci.yml).
- [ ] No new runtime deps; no new GitHub Action versions outside `docker/*@v3-v6` already in use.
- [ ] **No verification of arm64 build at PR time** — release.yml only triggers on `v*.*.*` tag
      push. First real verification = J.9 v1.1.0 tag push. Documented risk + mitigation below.

## Stratégia

### Fáza A — Workflow refactor

1. Backup current `workspace-image` job logic (lines 119-168) into thinking — no separate file
   commit; the diff itself is the record.
2. Author 3 new jobs replacing the single `workspace-image`:

   ```yaml
   workspace-image-amd64:
     name: Build Workspace image (linux/amd64)
     runs-on: ubuntu-latest
     timeout-minutes: 25
     outputs:
       digest: ${{ steps.push.outputs.digest }}
     steps:
       - uses: actions/checkout@v4
       - uses: docker/setup-buildx-action@v3
       - name: Log in to GHCR
         uses: docker/login-action@v3
         with:
           registry: ${{ env.REGISTRY }}
           username: ${{ github.actor }}
           password: ${{ secrets.GITHUB_TOKEN }}
       - id: push
         uses: docker/build-push-action@v6
         with:
           context: .
           file: apps/workspace/Dockerfile
           platforms: linux/amd64
           push: true
           outputs: type=image,name=${{ env.IMAGE_WORKSPACE }},push-by-digest=true,name-canonical=true,push=true
           build-args: |
             GIT_SHA=${{ github.sha }}
             VERSION=${{ github.ref_name }}
           cache-from: type=gha,scope=workspace-release-amd64
           cache-to: type=gha,mode=max,scope=workspace-release-amd64

   workspace-image-arm64:
     name: Build Workspace image (linux/arm64)
     runs-on: ubuntu-22.04-arm # NATIVE arm64 runner
     timeout-minutes: 25
     outputs:
       digest: ${{ steps.push.outputs.digest }}
     steps:
       - uses: actions/checkout@v4
       - uses: docker/setup-buildx-action@v3
       - name: Log in to GHCR
         uses: docker/login-action@v3
         with:
           registry: ${{ env.REGISTRY }}
           username: ${{ github.actor }}
           password: ${{ secrets.GITHUB_TOKEN }}
       - id: push
         uses: docker/build-push-action@v6
         with:
           context: .
           file: apps/workspace/Dockerfile
           platforms: linux/arm64
           push: true
           outputs: type=image,name=${{ env.IMAGE_WORKSPACE }},push-by-digest=true,name-canonical=true,push=true
           build-args: |
             GIT_SHA=${{ github.sha }}
             VERSION=${{ github.ref_name }}
           cache-from: type=gha,scope=workspace-release-arm64
           cache-to: type=gha,mode=max,scope=workspace-release-arm64

   workspace-manifest:
     name: Merge Workspace multi-arch manifest
     runs-on: ubuntu-latest
     timeout-minutes: 10
     needs: [workspace-image-amd64, workspace-image-arm64]
     outputs:
       version: ${{ steps.meta.outputs.version }}
       digest: ${{ steps.manifest.outputs.digest }}
     steps:
       - name: Log in to GHCR
         uses: docker/login-action@v3
         with:
           registry: ${{ env.REGISTRY }}
           username: ${{ github.actor }}
           password: ${{ secrets.GITHUB_TOKEN }}
       - name: Compute image tags
         id: meta
         uses: docker/metadata-action@v5
         with:
           images: ${{ env.IMAGE_WORKSPACE }}
           tags: |
             type=semver,pattern={{version}}
             type=semver,pattern={{major}}.{{minor}}
             type=raw,value=latest
             type=sha,format=short
       - id: manifest
         name: Create multi-arch manifest
         run: |
           # docker/metadata-action emits ${IMAGE}:${TAG} entries; iterate and combine the two
           # per-arch digests under each tag.
           AMD64_REF="${{ env.IMAGE_WORKSPACE }}@${{ needs.workspace-image-amd64.outputs.digest }}"
           ARM64_REF="${{ env.IMAGE_WORKSPACE }}@${{ needs.workspace-image-arm64.outputs.digest }}"
           while IFS= read -r TAG_REF; do
             [ -z "$TAG_REF" ] && continue
             echo "Creating manifest for $TAG_REF"
             docker buildx imagetools create -t "$TAG_REF" "$AMD64_REF" "$ARM64_REF"
           done <<< '${{ steps.meta.outputs.tags }}'
           # capture the manifest digest of the first tag for downstream output
           FIRST_TAG="$(echo '${{ steps.meta.outputs.tags }}' | head -n1)"
           DIGEST="$(docker buildx imagetools inspect "$FIRST_TAG" --format '{{.Manifest.Digest}}')"
           echo "digest=$DIGEST" >> "$GITHUB_OUTPUT"
   ```

3. Update `helm-chart` job `needs:` from `[bff-image, portal-image, workspace-image]` to
   `[bff-image, portal-image, workspace-manifest]` (workspace-manifest is the new terminal job for
   the workspace branch).
4. Remove the entire amd64-only comment block (release.yml:157-160) — no longer needed; the new
   job names are self-documenting.

### Fáza B — Lint + dry verify

1. `actionlint .github/workflows/release.yml` — must be clean.
2. Optional: `act -W .github/workflows/release.yml --list` to verify job graph (skip if `act` not
   installed; not required).
3. Visual check that `helm-chart` job's needs array points at `workspace-manifest`, not the
   removed `workspace-image`.

### Fáza C — Docs reconciliation

1. `docs/RELEASE-NOTES-v1.0.md` lines 180-189:

   ```
   ### Container images

   Multi-arch (`linux/amd64` + `linux/arm64`):

   - `ghcr.io/spigotek/sdm-bff:1.0.0` (also `1.0`, `latest`)
   - `ghcr.io/spigotek/sdm-portal:1.0.0` (also `1.0`, `latest`)

   Single-arch (`linux/amd64` only — multi-arch lands in v1.1 via native arm64 runner, see CHANGELOG Known issues):

   - `ghcr.io/spigotek/sdm-workspace:1.0.0` (also `1.0`, `latest`)
   ```

2. `docs/CHANGELOG.md` lines 218-227 same shape; § Known issues add bullet:
   ```
   - **Workspace image is `linux/amd64` only in v1.0.** Cross-compile failed with
     QEMU SIGILL during release; ships single-arch via the workaround in `release.yml`.
     Multi-arch lands in v1.1 via native `ubuntu-22.04-arm` GitHub-hosted runner (J.1).
     Impact: arm64 clusters cannot run v1.0 workspace; arm64 BFF + portal are unaffected.
   ```
3. `docs/agents/devex-devops/release-process.md` (if it exists) — add a one-liner pointing at
   the canonical multi-platform pattern reference for future image additions.

### Fáza D — PR + merge

1. `git checkout -b chunk/J.1-workspace-arm64-native`
2. Commit (single squash-friendly commit): `chore(release): workspace multi-arch via native arm64 runner (J.1)`
3. `gh pr create` with body explaining: motivation (v1.0 amd64-only workaround), pattern (canonical
   multi-platform), why no PR-time verification (release.yml gates on tag push), risk + mitigation.
4. Wait for CI (ci.yml + acceptance.yml + security.yml — none of these touch release.yml; expected
   pass).
5. Parent agent merges via `gh pr merge <num> --admin --squash --delete-branch`.

### Fáza E — Post-merge

1. Parent: `git checkout main && git pull --ff-only`.
2. Update `docs/ROADMAP.md` J.1 ⏳ → ✅ DONE + Aktuálny stav (J.2 NEXT).
3. Update `docs/plans/J.1.md` Status NEXT → DONE + PR #.
4. Commit + push: `docs(J.1): refresh PR # + status after merge`.
5. Continue → J.2.

## Open questions / risks — recommended resolutions

- **No PR-time verification of arm64 build** — release.yml only triggers on `v*.*.*` tag push.
  **Recommendation**: accept the risk. The canonical Docker multi-platform pattern is well-known;
  actionlint + YAML graph parsing catches syntax errors; the cost of adding a tagged dry-run trigger
  outweighs the value (would require either a separate workflow file or a `workflow_dispatch` input
  with skip-publish logic, both of which add CI complexity). Real verification = J.9 v1.1.0 tag.
  If the arm64 build itself fails at J.9, hot-patch in J.1.x as `release.yml` is the _only_ file
  affected — small blast radius.
- **arm64 runner cost** — public repos get free `ubuntu-22.04-arm` minutes per GitHub policy. No
  cost concern for `Spigotek/SDM-Rewrite` (PUBLIC verified). If repo flips to private in future,
  cost becomes ~5× standard runners; flag at that point.
- **Cache scope split** — using `scope=workspace-release-amd64` vs `-arm64` keeps caches separate
  (different binaries cached). Total cache size ~2× single-arch but fast hits within each arch.
  Acceptable.
- **`metadata-action` tag matrix** — the canonical pattern uses `metadata-action` in the manifest
  job only. Per-arch jobs push by digest (no tag), which means GHCR sees N anonymous digests + the
  manifest creates named tags pointing at them. This is the documented pattern; works correctly
  with both branch + tag-triggered runs.
- **`type=image,push-by-digest=true,name-canonical=true,push=true`** — `push=true` is required
  inside the outputs string AND removed from the top-level `push:` field (already done in the
  pattern above). If subagent leaves both, push-push conflict may surface as a warning. Single
  push directive in `outputs:`.
- **Workspace single-arch tags `:1.0.0`, `:1.0`, `:latest` exist** — those don't auto-upgrade.
  Once J.9 tags v1.1.0, the new multi-arch `:1.1.0` + `:1.1` + `:latest` get pushed; the **`:latest`
  tag flips to multi-arch at v1.1.** v1.0 single-arch tags `:1.0.0` + `:1.0` stay frozen
  (immutable, as released). Acceptable + expected.
- **Workspace dockerfile changes?** — NONE. The Dockerfile is arch-agnostic (alpine base, node
  build, nginx runtime — all multi-arch upstream images). Crash was QEMU emulation overhead at the
  pnpm-build step. Native arm64 runner eliminates emulation, no Dockerfile change needed.

## Notes pre subagenta

- **Subagent NESMIE**:
  - Touch any non-workspace job in `release.yml` (bff-image + portal-image already work fine on
    cross-compile because their builds are lighter).
  - Modify `Chart.yaml`, `values-staging.yaml`, helm templates, scripts — chart is image-agnostic.
  - Add a `workflow_dispatch` test trigger — out of scope (see Open questions).
  - Cut a test tag (e.g. `v0.0.1-test`) — `release.yml` matches `v*.*.*` and would push real
    images at version 0.0.1. **HARD NO**. Real verification = J.9.
  - Bump any `docker/*` action major version — pin already at v3/v5/v6; stay there.
  - Mergeовať vlastný PR — parent merguje.
- **Subagent musí**:
  - Use the canonical Docker multi-platform pattern verbatim. If a step differs from the pattern
    above, justify in PR body.
  - Run `actionlint` locally + paste output (clean) into PR body.
  - Update both `RELEASE-NOTES-v1.0.md` + `CHANGELOG.md` for the doc reconciliation. Skipping
    either = incomplete chunk.
  - Keep the `helm-chart` job's `needs:` array correct after the rename.
  - Single PR commit `chore(release): workspace multi-arch via native arm64 runner (J.1)`.
- **READ FIRST list** (subagent should read these before editing):
  - `.github/workflows/release.yml` (full file)
  - `apps/workspace/Dockerfile`
  - `docs/RELEASE-NOTES-v1.0.md` lines 175-200
  - `docs/CHANGELOG.md` lines 215-240
  - This plan (J.1.md) end-to-end
