# J.9 — v1.1 cut (Phase J closure release)

> **Status**: 🔜 NEXT
> **Branch**: `chunk/J.9-v1.1-cut` > **Cieľ**: cut v1.1.0 release artifacts — Chart.yaml bump 1.0.0 → 1.1.0, `docs/RELEASE-NOTES-v1.1.md`
> per-persona + per-J-chunk changes, `docs/CHANGELOG.md` `[1.1.0]` section, `values-staging.yaml` tag bump.
> After merge, **parent agent** creates + pushes annotated `v1.1.0` tag — `release.yml` CI fires
> (already proven on v1.0.0 + I.7-shipped + extended by J.1 multi-arch workspace) and publishes:
> `ghcr.io/spigotek/sdm-{bff,portal,workspace}:1.1.0` (workspace **now multi-arch** per J.1) +
> `oci://ghcr.io/spigotek/charts/sdm:1.1.0` + GitHub Release v1.1.0 with `RELEASE-NOTES-v1.1.md`
> body. v1.0 staging validation (J.0) remains deferred — v1.1 ships with the same "unverified
> against staging" caveat as v1.0, documented in Known issues. v1.0 artifacts stay untouched
> on GHCR (immutable tags).

## Pivot vs ROADMAP

J.md / ROADMAP J.9 entry: "v1.1 cut (semver tag + image push + OCI helm + release notes;
requires J.0 GO before tag)."

User decision 2026-06-04: cut v1.1 anyway despite J.0 deferred. Rationale: code release is
orthogonal to deploy validation. v1.0 stays deployable; v1.1 artifacts sit on GHCR ready for
when cluster comes online. Honest Known-issues entry documents the unverified state.

## Inputs

- **`deploy/helm/sdm/Chart.yaml`** — current `version: 1.0.0` + `appVersion: "1.0.0"`. J.9
  bumps both to `1.1.0`. (release.yml has a `sed` step that overwrites to match the tag, so
  the in-repo values are advisory; but keeping them in sync with the upcoming tag is
  conventional + makes `helm install ./deploy/helm/sdm` from main use 1.1.0 by default.)
- **`deploy/helm/sdm/values-staging.yaml`** — current `tag: "1.0.0-rc.1"` (stale per J.0
  Pre-flight finding). J.9 bumps to `"1.1.0"` + flips comment to reference Chart appVersion
  1.1.0. Image registry stays `ghcr.io` per I.7 baseline.
- **`docs/RELEASE-NOTES-v1.0.md`** — structural reference. v1.1 mirrors the section layout
  (Personas, Security, Performance, Compatibility, Deployment, Architecture, Known issues,
  Roadmap, Credits). J.9 ships `docs/RELEASE-NOTES-v1.1.md` NEW alongside (NOT modifying
  v1.0).
- **`docs/CHANGELOG.md`** — currently `[1.0.0]` only. J.9 prepends a `[1.1.0]` section
  summarising J.1-J.8 outcomes (and the J.0/J.2/J.4 closures/deferrals where relevant).
- **`docs/plans/J.{0..8}.md`** — per-chunk outcomes are the source-of-truth for the release
  notes change-list.
- **`.github/workflows/release.yml`** — release pipeline (I.7 + J.1 extended). NO changes
  in J.9 — the workflow auto-picks up the new tag.
- **Memory `pr-flow-discipline`** — PR-per-chunk + squash --admin --delete-branch (parent
  merges).
- **Memory `v1_0_released`** — context for v1.1 sibling release. Will get a follow-up
  `v1_1_released` memory after the tag publishes (parent writes post-tag).

## Outputs

```
deploy/helm/sdm/Chart.yaml                          # MOD: version 1.0.0 → 1.1.0, appVersion "1.0.0" → "1.1.0"
deploy/helm/sdm/values-staging.yaml                 # MOD: tag "1.0.0-rc.1" → "1.1.0" (3 places: image/bff/portal/workspace) + comment refresh

docs/RELEASE-NOTES-v1.1.md                          # NEW: per-persona + per-J-chunk summary
docs/CHANGELOG.md                                   # MOD: prepend [1.1.0] section header + per-J-chunk additions

docs/ROADMAP.md                                     # J.9 ⏳ → ✅ DONE; Aktuálny stav reflects v1.1.0 RELEASED post-tag-push
docs/plans/J.9.md                                   # Status NEXT → DONE; PR #

# AFTER parent merges PR + creates tag (NOT in PR):
# git tag -a v1.1.0 -m "..."
# git push origin v1.1.0
# → release.yml fires → ghcr.io/spigotek/sdm-{bff,portal,workspace}:1.1.0 + oci://.../charts/sdm:1.1.0 + GitHub Release v1.1.0
```

**No code changes outside chart / values / docs.** No new deps. No new tests. No new
workflow files.

## Done-when

- [ ] `Chart.yaml` `version: 1.1.0` + `appVersion: "1.1.0"`.
- [ ] `values-staging.yaml` image tag references `1.1.0` everywhere (bff/portal/workspace
      blocks). Comment block line 9 refreshes to `Reference Chart.yaml appVersion: 1.1.0.`
- [ ] `docs/RELEASE-NOTES-v1.1.md` NEW — mirrors `RELEASE-NOTES-v1.0.md` section layout,
      content scoped to v1.1 deltas: - **Personas served** — same six + SP Admin; what changed per persona vs v1.0 (e.g.
      Lucia gets installable PWA + read-only offline; Anna gets push tenant-suspension
      notifications via SSE; Peter gets calendar drag-resize + reschedule audit; Jana
      gets KB binary image upload). - **Security baseline** — no taxonomy expansion; new admin endpoints (`POST /api/admin/tenants/:id/{suspend,unsuspend}` from J.3, `POST /api/attachments/kb` from J.5, `PATCH /api/changes/:id/schedule` from J.6) all gated by existing permissions; SVG XSS allowlist; JPG EXIF strip. - **Performance** — portal mobile LCP closed via copy redesign (J.8); workspace
      multi-arch via native arm64 runner (J.1); SSE event-bus heartbeat 30 s; bundle
      budgets unchanged (portal initial JS ~161 KB / 180 KB; workspace ~176 KB / 350 KB). - **Compatibility** — backward-compat: v1.1 installable on the same Kube cluster as
      v1.0 with no breaking changes; CA SDM contract unchanged (still 17.4); Helm chart
      v1.1.0 zpätne-kompat installable. - **Deployment** — multi-arch (linux/amd64 + linux/arm64) for BFF, portal, AND
      workspace (J.1 closes the v1.0 amd64-only workaround). Helm OCI chart 1.1.0.
      Staging values reference unchanged structure. - **Container images**: 3 multi-arch images at `:1.1.0` / `:1.1` / `:latest`. - **Architecture highlights**: SSE platform module (J.3), event-bus (J.3), runtime
      tenant-status override map (J.3), file-system attachments storage with magic-sniff + EXIF strip (J.5), per-event drag-edit FullCalendar wiring (J.6), Workbox SW
      with conditional MSW coexistence (J.7). - **Known issues** — bullet-pointed, accurate: - **Staging validation pending** — J.0 deferred; v1.0 + v1.1 ship without live
      BFF smoke against on-prem cluster (no container runtime provisioned on
      `10.11.36.21` per memory `deploy_target.md`). Unblock criteria documented in
      [`J.0.md`](./plans/J.0.md). - Cross-tenant query (J.2 closed N/A): dev/test CA SDM 17.4 single-tenant; I.5 BFF
      surface already production path on this instance. - KB analytics (J.4 closed N/A): MSW fixture remains canonical; real ingest =
      v2.0. - PWA offline submit (J.7 deferred half): mutation queue stays v1.2+; v1.1 ships
      read-only offline only. - Incident attachments (H.3 deferral): still v1.2+ scope; KB attachments shipped
      per J.5. - Workspace single-arch on v1.0 only — v1.1 fixes by shipping multi-arch. - **Roadmap — v1.2 / v2.0** — preview of upcoming chunks (IndexedDB offline queue,
      Vite SSR, KB analytics ingest, multi-instance event-bus Redis adapter, incident
      attachments, etc.). - **Credits** — short.
- [ ] `docs/CHANGELOG.md` — prepend `[1.1.0] - 2026-MM-DD` section above `[1.0.0]`. Format
      follows Keep a Changelog 1.1.0. Sections: - **Added** — J.1 workspace multi-arch, J.3 SSE tenant push + admin endpoints, J.5
      KB image upload + GET serve, J.6 calendar drag-resize + PATCH /api/changes/:id/schedule,
      J.7 portal PWA, J.8 portal LCP copy redesign. - **Changed** — workspace image now multi-arch (was amd64-only in v1.0); HeroGreeting
      subgreeting expanded; `editable: true` on FullCalendar when permission present. - **Documentation** — J.0 closed-deferred, J.2 closed-N/A, J.4 closed-N/A docs. - **Known issues** — point at the relevant section in RELEASE-NOTES. - **Deployment** — multi-arch images at `:1.1.0`; helm chart 1.1.0 OCI. - **Migration notes** — none; v1.0 → v1.1 is in-place chart upgrade with no API
      breaking changes.
- [ ] `docs/ROADMAP.md`: - "Last merged" → Chunk J.9 (v1.1 cut, PR #N squash `…`) - "In flight" → none (Phase J closed) - "Phase J" → ✅ COMPLETE (J.0 ⏸ deferred + 8 closed chunks) - "Project" reflects v1.1 RELEASED after tag publishes - Append v1.1 RELEASED line under Aktuálny stav (parent fills post-tag-push)
- [ ] PR opened with title `chore(release): v1.1 cut — chart 1.1.0 + RELEASE-NOTES + CHANGELOG (J.9)`.
- [ ] CI green: ci.yml + acceptance.yml + security.yml + `helm lint` + `helm template`.
- [ ] **Subagent does NOT push the tag.** Tag creation + push is parent's responsibility.
- [ ] **NO secrets** in any committed file. RELEASE-NOTES + CHANGELOG never reference real
      credentials — operator memory `real_backend.md` / `deploy_target.md` stays out of repo.

## Stratégia

### Fáza A — Chart + values bump

1. `deploy/helm/sdm/Chart.yaml`:
   - `version: 1.0.0` → `version: 1.1.0`
   - `appVersion: "1.0.0"` → `appVersion: "1.1.0"`
2. `deploy/helm/sdm/values-staging.yaml`:
   - 3 `tag:` lines (top-level image + bff + portal + workspace) all bumped to `"1.1.0"`.
   - Comment block line 9 refreshes to `Reference Chart.yaml appVersion: 1.1.0.`

### Fáza B — RELEASE-NOTES-v1.1.md authoring

Author the file from scratch following the v1.0 section layout. **Per-J-chunk source of
truth: read `docs/plans/J.{0..8}.md` Status + Outcome blocks** — those are already authored
post-merge for each chunk and contain the canonical change list. Subagent stitches them into
the release notes per section.

Voice + tone: match v1.0 (technical, factual, references PR numbers + commit hashes).
Length: similar to v1.0 (~270 lines), focused on what changed.

### Fáza C — CHANGELOG [1.1.0] section

Prepend the `[1.1.0]` block above the existing `[1.0.0]` block. Format mirrors Keep a
Changelog 1.1.0. Date placeholder `2026-MM-DD` — parent fills the actual release date when
publishing the tag.

### Fáza D — ROADMAP toggle (partial; parent finishes post-tag-push)

In the PR, subagent toggles `J.9 ⏳ → ✅ DONE` + adds line to "Phase J" entry. Parent's
post-merge commit (separate from this PR) adds the v1.1 RELEASED Aktuálny stav banner once
the tag is pushed + release.yml succeeds.

### Fáza E — PR + parent tag-cut

1. Subagent opens PR `chore(release): v1.1 cut — chart 1.1.0 + RELEASE-NOTES + CHANGELOG (J.9)`.
2. Subagent reports + does NOT merge + does NOT tag.
3. Parent verifies CI + merges PR via `gh pr merge --admin --squash --delete-branch`.
4. Parent refreshes local main.
5. **Parent creates annotated tag**:

   ```bash
   git tag -a v1.1.0 -m "v1.1.0 — Phase J closure release

   8 merged chunks (J.1-J.8) + 2 closed-N/A (J.2, J.4) + 1 deferred (J.0).
   See docs/RELEASE-NOTES-v1.1.md for per-persona details + known issues
   (notably: J.0 staging validation pending until cluster provisioned)."
   git push origin v1.1.0
   ```

6. release.yml CI fires (workflow_dispatch path: `on: push: tags: [v*.*.*]`):
   - bff-image (multi-arch amd64+arm64)
   - portal-image (multi-arch)
   - workspace-image-amd64 + workspace-image-arm64 + workspace-manifest (per J.1)
   - helm-chart package + push to `oci://ghcr.io/spigotek/charts`
   - github-release auto-creates with `RELEASE-NOTES-v1.1.md` body
7. Parent verifies release artifacts:
   - `gh release view v1.1.0` — shows the new release with .tgz asset.
   - `helm pull oci://ghcr.io/spigotek/charts/sdm --version 1.1.0` — verify chart pulls.
   - GHCR images visible at `ghcr.io/spigotek/sdm-{bff,portal,workspace}:1.1.0` (manual UI
     check or `crane manifest` from a host with docker).
8. Parent writes follow-up memory `v1_1_released.md` (parallel to existing `v1_0_released.md`).
9. Parent commits final `docs: v1.1.0 RELEASED — Phase J closure` on main updating ROADMAP
   Aktuálny stav banner + Posledná revízia line. Phase J flag flips to ✅ COMPLETE.

### Fáza F — Post-release

Phase J ends. Project ROADMAP marked Phase J ✅ COMPLETE. Any future v1.x patches → patch-line
chunks named per Phase letter convention; v2.0 scope → separate sequencing document.

## Open questions / risks — recommended resolutions

- **Release notes date** — `2026-MM-DD` placeholder fine in PR; parent fills actual date
  on the post-tag-push commit (or release.yml does — `github-release` action auto-stamps
  from tag push timestamp).
- **CHANGELOG link footer** — current `[1.0.0]: https://github.com/Spigotek/SDM-Rewrite/releases/tag/v1.0.0` stays; add `[1.1.0]: https://github.com/Spigotek/SDM-Rewrite/releases/tag/v1.1.0` (resolves once tag pushed).
- **Honest "staging not validated" framing** — Known issues entry MUST surface this. Do not
  bury the J.0 deferral. Operators reading v1.1 RELEASE-NOTES need to know that the deploy
  path is the same as v1.0's (untested against the on-prem cluster) before pulling the chart.
- **Tag annotation message** — annotated tag (`-a`) carries the description; release.yml
  auto-picks `RELEASE-NOTES-v1.1.md` per its file resolution logic (per-major-minor → per-full).
- **Tag immutability** — once pushed, v1.1.0 is immutable on GHCR + GitHub Releases. Mistakes
  require v1.1.1 patch. Subagent + parent both double-check Chart.yaml + RELEASE-NOTES
  before the parent pushes the tag.
- **Workspace multi-arch verification at v1.1.0** — J.1's release.yml change is verified for
  the FIRST time at v1.1.0 tag push (no PR-time arm64 build per J.1 Open Questions). If the
  workspace-image-arm64 job fails, parent must hot-patch (j.1.x) + re-tag (e.g. v1.1.1).
  Mitigation: parent reviews release.yml workspace section diff once more before pushing tag.
- **lhci-collect.sh / nightly perf-nightly.yml** — runs against main; first post-merge run
  will measure J.8 LCP fix. If regression surfaces, J.8.b (SSR) pivot — separate chunk in
  patch line (v1.1.1) or v1.2.
- **`Phase J — ✅ COMPLETE` framing** — even though J.0 stays ⏸ deferred, Phase J closes
  because J.0 is an ops-gated artifact (operator runs deploy + sends results, claude fills
  docs). The CODE side of Phase J is fully shipped at v1.1.0 tag.

## Notes pre subagenta

- **Subagent NESMIE**:
  - Push any tag (`git tag` is parent-only).
  - Modify `.github/workflows/release.yml` (workflow already extended by J.1).
  - Modify v1.0 release artifacts (RELEASE-NOTES-v1.0.md stays as historical record).
  - Add new audit event names, new permissions, new runtime deps.
  - Add new code modules (no new endpoints, no new components, no new tests).
  - Pre-merge the tag-push step.
  - Reference any real credentials in committed files.
  - Mergovať vlastný PR.
- **Subagent musí**:
  - Stitch per-J-chunk Outcome blocks from `docs/plans/J.{0..8}.md` into
    `RELEASE-NOTES-v1.1.md` faithfully (no fabrication; if a chunk had a deviation
    documented in its plan, reflect it in the release notes).
  - Make CHANGELOG `[1.1.0]` section concise (5-10 bullets per Added / Changed; not a
    novel — RELEASE-NOTES carries the long form).
  - Verify `helm lint deploy/helm/sdm` after the Chart.yaml bump.
  - Verify `helm template deploy/helm/sdm -f deploy/helm/sdm/values-staging.yaml --dry-run`
    succeeds with the new tag references.
  - Single squash-friendly commit `chore(release): v1.1 cut — chart 1.1.0 + RELEASE-NOTES + CHANGELOG (J.9)`.
- **READ FIRST** (subagent should read these before editing):
  - `docs/plans/J.9.md` (this file) end-to-end
  - `docs/RELEASE-NOTES-v1.0.md` (full file — structural template)
  - `docs/CHANGELOG.md` (current `[1.0.0]` section structure)
  - `deploy/helm/sdm/Chart.yaml` + `values-staging.yaml`
  - `docs/plans/J.0.md`, `J.1.md`, `J.2.md`, `J.3.md`, `J.4.md`, `J.5.md`, `J.6.md`,
    `J.7.md`, `J.8.md` — each Status block ("Outcome:" paragraph) is authoritative for the
    release notes per-J-chunk summary.
  - `.github/workflows/release.yml` (READ ONLY — confirm the workflow exists and will fire
    on the upcoming tag push; do NOT modify).
  - `docs/plans/I.7.md` — pattern reference for the v1.0 cut chunk (the immediate sibling).
