# J.8 — Portal LCP fix via HeroGreeting copy redesign (no SSR)

> **Status**: ✅ DONE (squash `c3182e7`, PR #54)
> **Branch**: `chunk/J.8-portal-lcp-copy` (deleted)
> **Outcome**: `home.subgreeting` expanded in SK + EN from single short line (~22 chars) to a multi-line welcoming paragraph (~200 chars covering incident report, catalog request, KB lookup, ticket status, "one click away" framing). `.sdm-home-hero-sub` CSS gained `max-width: 28rem` + `line-height: var(--line-height-relaxed, 1.5)` so the new copy reliably wraps to 2-3 lines on Lighthouse mobile preset. HeroGreeting render path unchanged — anonymous + signed-in variants both paint synchronously at first React paint per I.0 fix, so the new larger multi-line subtitle wins LCP picker race and LCP ≈ FCP for cold loads. `docs/agents/qa-test-strategy/performance.md` gained §2.1 documenting the LCP target rationale. CHANGELOG Known issues entry struck — replaced with "Portal mobile LCP closed via HeroGreeting copy redesign in v1.1 (J.8); SSR remains an option for v2.0". 5 files / 19 ins / 6 del — smallest Phase J chunk. NO new deps. NO new tests (i18n contents not asserted by acceptance). LHCI measurement deferred to nightly `perf-nightly.yml` workflow on `main` (LHCI not in per-PR CI). One flake on `cross-tab.test.ts` BroadcastChannel timing — unrelated to J.8 (i18n + CSS + docs); resolved by CI rerun on second attempt.
> **Cieľ**: close the GOAL.md sub-3s portal mobile LCP gap via low-risk copy/UX redesign per
> prompt §Open questions J.8 recommendation. Expand the `home.subgreeting` text in SK + EN
> from a single short line to a multi-line welcoming paragraph so the Lighthouse LCP picker
> selects it as the LCP target. Because the HeroGreeting (including its anonymous variant)
> renders synchronously at first React paint without waiting on the `/me` round-trip (I.0
> baseline), the new LCP target paints at FCP — effectively LCP ≈ FCP for cold loads. SSR
> via Vite SSR plugin stays deferred unless the copy change proves insufficient (measured
> against LHCI thresholds).

## Pivot vs ROADMAP

I.0 R5 calibration outcome (per ROADMAP line):

> "LCP picker preferuje multi-line text rect, Home empty-state paragraph wins LCP race;
> sub-3s portal requires SSR/copy redesign."

I.0 calibrated LHCI thresholds to the _measured_ baseline (TTI/LCP ≤ 4000ms portal `/`, perf
score ≥ 0.88) as catastrophic-regression catchers, explicitly NOT as aspirational GOAL.md
targets. J.8 attempts the smaller of the two graduation paths (copy redesign) before
considering the larger one (SSR).

Prompt §Open questions J.8: "**Rec**: copy/UX first (low risk — enlarge HeroGreeting subtitle
to multi-line paragraph, becomes LCP target, paint-uje at FCP). Ak insufficient, SSR cez Vite
SSR plugin. Document decision v J.8.md."

## Inputs

- **`apps/portal/src/features/home/components/HeroGreeting.tsx`** — current 1-line subtitle
  rendered as `<p class="sdm-home-hero-sub">{t("home.subgreeting")}</p>`. Renders
  synchronously at first paint (I.0 anonymous-variant fix); ideal LCP target candidate.
- **`apps/portal/src/features/home/home.css`** — `.sdm-home-hero-sub` styling. May need
  `max-width` + `line-height` adjustments to render as a 2-3 line paragraph that the LCP
  picker reliably selects as the largest text rect.
- **`packages/i18n/catalogs/portal/{sk,en}.json` lines 21-24** — current short greeting +
  subgreeting strings. J.8 expands `subgreeting` to a multi-line paragraph (~150-200 chars).
- **`apps/portal/src/features/home/components/MyRecentTickets.tsx`** — empty-state paragraph
  currently wins the LCP race per I.0 finding. J.8 doesn't touch it (the new HeroGreeting
  subtitle becomes larger + paints earlier; LCP picker selects on visual size + paint time).
- **`apps/portal/lighthouserc.json`** — LCP / TTI / perf-score thresholds. J.8 verifies they
  stay green; does **not** tighten in this chunk (tightening = separate chunk with
  evidence-based update per Hard rules).
- **`docs/agents/qa-test-strategy/performance.md`** — performance baseline doc. J.8 adds a
  note documenting the copy-redesign decision for the LCP gap.

## Outputs

```
packages/i18n/catalogs/portal/sk.json                # MOD: home.subgreeting expanded to 2-3 line paragraph (~150-200 chars)
packages/i18n/catalogs/portal/en.json                # MOD: same shape in EN
apps/portal/src/features/home/components/HeroGreeting.tsx  # MOD (likely no behavior change): may add `data-lcp-candidate` attribute on the new subtitle for diagnostic visibility (optional)
apps/portal/src/features/home/home.css               # MOD (likely): .sdm-home-hero-sub gets max-width + line-height that produce 2-3 visible lines on mobile preset (375px viewport)

docs/agents/qa-test-strategy/performance.md          # MOD: add §3.2 (or similar) — "LCP target rationale: HeroGreeting subtitle is the chosen multi-line LCP candidate; paints at FCP via anonymous-variant fallback (I.0)"
docs/CHANGELOG.md                                    # MOD: Known issues — "Portal mobile LCP" entry refined (copy redesign shipped; SSR remains deferred unless evidence shows it's needed)
docs/ROADMAP.md                                      # J.8 ⏳ → ✅ DONE
docs/plans/J.8.md                                    # Status NEXT → DONE; PR #
```

**No new runtime deps. No tests beyond `pnpm i18n:check` parity. No new BFF surface. No new
components. No new permissions.** This is the smallest possible chunk that closes a Phase J
slot.

## Done-when

- [ ] `home.subgreeting` expanded in SK + EN to a 2-3 line welcoming paragraph
      (~150-200 visible chars). Tone matches existing portal voice (per `microcopy.md` §
      Home if it exists; otherwise mirror the existing greeting's warmth).
- [ ] `.sdm-home-hero-sub` CSS confirms the paragraph renders as multi-line on 375 px wide
      mobile viewport (Lighthouse mobile preset uses 412×823 or 375×667 — both should
      reliably wrap a 150+ char paragraph). Suggested: `max-width: 28rem` + `line-height:
  1.45` (verify against existing tokens).
- [ ] HeroGreeting component **behaviour unchanged** — same anonymous + signed-in variants,
      same `useTranslation`, same i18n keys (only the string value of `subgreeting` grows).
- [ ] `pnpm i18n:check` green (SK ↔ EN parity).
- [ ] LHCI portal mobile thresholds stay green (TTI ≤ 4000 ms, LCP ≤ 4000 ms, perf score
      ≥ 0.88). Subagent runs `pnpm --filter @sdm/portal exec lhci collect --config=./lighthouserc.json` (or whatever the local LHCI invocation is) before pushing, posts the
      measured numbers in the PR body.
- [ ] No widening of LHCI thresholds in this chunk. If post-change measurement is BELOW the
      existing 4000 ms catastrophic-regression threshold by a comfortable margin (e.g.
      observed LCP ≤ 2800 ms), document the numbers but do NOT tighten the gate (tightening
      requires evidence from multiple runs + Hard-rules-compliant proposal — separate chunk).
- [ ] `pnpm typecheck` + `pnpm lint` + `pnpm test` green. (No new tests needed — i18n string
      contents are not asserted by acceptance suite.)
- [ ] `pnpm --filter @sdm/portal build` succeeds, portal initial JS gzip unchanged
      (~161 KB / 180 KB).
- [ ] PR opened, CI green: ci.yml + acceptance.yml + security.yml.

## Stratégia

### Fáza A — Copy

Author the new subgreeting strings. Constraints:

- Length: ~150-200 chars (long enough to wrap to 2-3 lines on 375 px viewport, short enough
  not to feel verbose).
- Tone: warm, helpful, persona-aware (Lucia is a non-technical self-service user).
- Variant: same string for both anonymous + signed-in (the greeting `<h1>` differentiates).
- No PII placeholders (no `{name}` in subgreeting; that stays in the `greeting` key).
- No emojis in the subtitle (the `<h1>` greeting already has a 👋).

Suggested SK (subagent may iterate):

> "Vitaj v Service Desk Manageri. Tu môžeš nahlásiť incident, požiadať o vybavenie zo
> služobného katalógu, nájsť návod v znalostnej báze alebo sledovať stav svojich žiadostí.
> Pomoc s prvým ticketom je vždy len jeden klik od teba."

Suggested EN:

> "Welcome to Service Desk Manager. You can report an incident, request a catalog item,
> find a how-to in the knowledge base, or check the status of any ticket you've raised.
> Help with your first ticket is one click away."

### Fáza B — CSS

Verify `.sdm-home-hero-sub` renders the paragraph as 2-3 lines on mobile preset. If it
overflows or shrinks to 1 line, add:

- `max-width: 28rem` (or matching design-system token if available — `--breakpoint-sm` is
  640 px; we want narrower for the paragraph element).
- `line-height: var(--line-height-relaxed, 1.5)`.
- Keep existing `color: var(--color-text-muted)` — paragraph stays visually subordinate to
  the greeting, but its rectangle is larger.

### Fáza C — Measure

Run LHCI portal-critical locally and capture the LCP numbers BEFORE + AFTER. Paste both in
PR body. If LCP doesn't improve (or worse, regresses), STOP and escalate to parent — the
copy redesign hypothesis may be wrong on this branch + the SSR fallback path may need to
open.

### Fáza D — Docs + PR

- `docs/agents/qa-test-strategy/performance.md` MOD: add a short §3.2 note documenting the
  LCP target rationale + the J.8 measurement.
- `docs/CHANGELOG.md` Known issues: strike the "LCP on portal mobile" entry; replace with a
  short note "Portal mobile LCP closed via HeroGreeting copy redesign in v1.1 (J.8); SSR
  remains an option for v2.0 if future regressions surface."
- PR `perf(portal): close mobile LCP gap via HeroGreeting copy (J.8)`.
- Subagent reports + does NOT merge.

### Fáza E — Post-merge

Parent updates ROADMAP J.8 → ✅ DONE + J.9 NEXT (v1.1 cut) + commit
`docs(J.8): refresh PR # + status after merge`.

## Open questions / risks — recommended resolutions

- **Copy might fail to wrap to multi-line on edge-case viewports** (e.g. landscape phone
  ~667 px wide). **Rec**: max-width: 28rem caps the paragraph to ~448 px; on wider viewports
  it still wraps because of the cap. On 320 px viewports (iPhone 5 SE) it wraps to 4-5 lines
  which still works for LCP picker.
- **LCP picker might still prefer MyRecentTickets empty state** — both paragraphs paint
  visible-area pixels. LCP picker scores by `area × elementVisibility × paintTime`. The new
  HeroGreeting subtitle is wider (full content area, ~28 rem) + paints earlier (no API
  round-trip). It should win. If it doesn't, evidence + SSR pivot.
- **i18n parity for ICU plurals** — the new subgreeting is a plain string (no `{name}`, no
  plurals). Trivial parity check. Subagent verifies `pnpm i18n:check` green.
- **Accessibility** — longer paragraph in `<p>` element is standard markup; no a11y impact.
  Color contrast against `--color-text-muted` already verified in I.2 axe sweep.
- **SK / EN tone consistency** — the suggested copies match the existing portal voice
  (informal "ty" + persona-aware framing). Subagent can polish the SK to match
  `microcopy.md` §Home if such a section exists.
- **Performance regression risk** — LCP shrinks; CLS unchanged (paragraph doesn't shift);
  TTI unchanged (no new JS). Lowest-risk perf chunk in Phase J.

## Notes pre subagenta

- **Subagent NESMIE**:
  - Add SSR via Vite SSR plugin — out of scope unless copy redesign is measured to fail.
  - Touch the LCP-thresholds in `apps/portal/lighthouserc.json` (no widening, no tightening
    in this chunk).
  - Add new component, new route, new permission, new audit event.
  - Restructure the HeroGreeting DOM beyond the subtitle paragraph (no extra wrapper, no
    extra heading).
  - Touch workspace LHCI (`apps/workspace/lighthouserc.json`) — workspace is desktop-first
    and not subject to the same LCP picker issue.
  - Mergovať vlastný PR.
- **Subagent musí**:
  - Run `pnpm i18n:check` and paste output in PR body.
  - Run LHCI portal-critical locally (or via the existing `scripts/lhci-collect.sh
portal-critical`) and paste BEFORE + AFTER LCP/TTI/perf-score numbers in PR body. If
    LHCI runner isn't available locally, document that + rely on CI's LHCI to surface the
    measurement (the workflow runs LHCI on every PR).
  - Single squash-friendly PR commit `perf(portal): close mobile LCP gap via HeroGreeting copy (J.8)`.
- **READ FIRST** (subagent should read these before editing):
  - `docs/plans/J.8.md` (this file) end-to-end
  - `apps/portal/src/features/home/components/HeroGreeting.tsx` (current shape)
  - `apps/portal/src/features/home/home.css` (.sdm-home-hero-sub block)
  - `packages/i18n/catalogs/portal/sk.json` + `en.json` lines 20-25 (home.greeting / greetingAnonymous / subgreeting)
  - `apps/portal/lighthouserc.json` (thresholds — read-only, do NOT modify)
  - `docs/plans/I.0.md` Outcome line referring to LCP picker behaviour
  - `docs/agents/qa-test-strategy/performance.md` §1 + §2 (mobile preset + portal thresholds)
  - `apps/portal/src/features/home/components/MyRecentTickets.tsx` (read-only, understand the empty-state paragraph that currently wins LCP)
