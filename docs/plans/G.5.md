# G.5 — Self-host fonts (Inter + JetBrains Mono)

> **Status**: ✅ DONE
> **Branch**: `chunk/G.5-self-host-fonts` (merged + deleted)
> **PR**: #20 (squash-merged 2026-05-25)
> **Cieľ**: self-hostovať Inter Variable + JetBrains Mono Variable v
> `apps/{portal,workspace}/public/fonts/` (woff2 latin + latin-ext subsets),
> aktualizovať `@font-face` deklarácie v `@sdm/design-system/tokens/fonts.css`
> aby ukazovali na `local()` súbory namiesto fallbacku na system-ui. Žiadny
> CDN call (on-prem deploy req per `library-recommendation.md`).

## Pivot vs ROADMAP

ROADMAP `G.5` bullet: _"Self-host fonts — Inter + JetBrains Mono woff2 v apps/{portal,workspace}/public/fonts/. Inputs: design-system/theming.md."_

G.1 zaviedlo tokens s `font.family.sans = "Inter Variable", ...` ale **fallback
ostal na `system-ui`** lebo fonts ešte neboli self-hostené. G.5 to dokončuje
— zatiaľ pridá `@font-face` deklarácie + assety, takže Inter Variable sa naozaj
load-uje.

## Inputs

- **`docs/agents/design-system/theming.md` §5 + Otvorené závislosti** — confirmovaný subset (`latin + latin-ext` pre SK diakritika).
- **`docs/agents/design-system/tokens.md` §1 + §Otvorené závislosti** — `font.family.sans = "Inter Variable", "Inter"`, `font.family.mono = "JetBrains Mono Variable", "JetBrains Mono"`.
- **`docs/agents/design-system/library-recommendation.md` §Self-hosted assets** — confirms self-host requirement (on-prem deploy).
- **`docs/agents/qa-test-strategy/performance.md` §9** — _"Critical fonts: woff2, font-display: swap, preload top 1 weight"_.
- **`packages/design-system/src/tokens/fonts.css`** — G.1 placeholder (môže byť prázdny alebo komentár "see G.5"). G.5 ho naplní.
- **`apps/portal/index.html`** + **`apps/workspace/index.html`** — pridať `<link rel="preload">` pre top weight font file.

## Outputs

```
apps/portal/public/fonts/
├── inter-variable-latin.woff2            # Inter Variable, weight 100-900, latin subset
├── inter-variable-latin-ext.woff2        # Inter Variable, latin-ext (SK diakritika)
├── jetbrains-mono-variable-latin.woff2
└── jetbrains-mono-variable-latin-ext.woff2

apps/workspace/public/fonts/              # IDENTICKÝ obsah ako portal (apps sú self-contained)
├── inter-variable-latin.woff2
├── inter-variable-latin-ext.woff2
├── jetbrains-mono-variable-latin.woff2
└── jetbrains-mono-variable-latin-ext.woff2

packages/design-system/src/tokens/fonts.css   # @font-face declarations
  # @font-face { font-family: "Inter Variable"; src: url("/fonts/inter-variable-latin.woff2") format("woff2-variations"); font-weight: 100 900; font-style: normal; font-display: swap; unicode-range: U+0000-00FF, ...; }
  # @font-face { font-family: "Inter Variable"; src: url("/fonts/inter-variable-latin-ext.woff2") ...; unicode-range: U+0100-024F, ...; }
  # ... mono ...

apps/portal/index.html                    # +<link rel="preload" as="font" type="font/woff2" href="/fonts/inter-variable-latin.woff2" crossorigin>
apps/workspace/index.html                 # same

docs/ROADMAP.md                           # G.5 → ✅ DONE
docs/plans/G.5.md                         # tento súbor → Status DONE
```

## Done-when

- [x] Inter Variable + JetBrains Mono Variable woff2 súbory (latin + latin-ext subsets) v `apps/portal/public/fonts/` + `apps/workspace/public/fonts/`. Sizes: inter-latin 48 KB, inter-latin-ext 85 KB, jbm-latin 40 KB, jbm-latin-ext 15 KB.
- [x] `packages/design-system/src/tokens/fonts.css` má `@font-face` deklarácie s `font-display: swap`, `font-weight: 100 900` (Inter) / `100 800` (JBM) variable axis, canonical Google Fonts / fontsource `unicode-range` per subset.
- [x] `<link rel="preload" as="font" type="font/woff2" crossorigin>` v `<head>` oboch SPA pre `inter-variable-latin.woff2` (najčastejší path; mono + latin-ext sú on-demand cez unicode-range).
- [x] Žiadny CDN call — `grep -rn googleapis|jsdelivr|unpkg|fonts.google` v `apps/{portal,workspace}/{src,dist,index.html}` + `packages/design-system/src` je prázdny. Build artefakty obsahujú len relatívne `/fonts/*.woff2` URL.
- [x] Font súbory **committed** (binary woff2, ~15-85 KB každý). `.gitattributes` v repo root: `*.woff2 binary` aby git diff nešumel.
- [x] License files committed vedľa fontov: `apps/{portal,workspace}/public/fonts/OFL-Inter.txt` + `OFL-JetBrainsMono.txt` (oboje SIL Open Font License 1.1, kopírované z `@fontsource-variable/*` `LICENSE`).
- [x] `pnpm -r typecheck/lint/test/build` green (zelený proti `chunk/G.5-self-host-fonts` HEAD).
- [x] Bundle delta: portal `index.css` +0.8 KB (`+0.32 KB gzip`), žiadny JS impact. Public assets +~188 KB per app (4× woff2 + 2× license).
- [x] Manual test: `pnpm --filter @sdm/portal preview` + `curl /fonts/inter-variable-latin.woff2 → 200`. Build dist neobsahuje žiadny CDN reference.
- [x] ROADMAP toggle: G.5 → ✅ DONE.

## Stratégia

### Fáza A — Acquire fonts

1. Download Inter Variable from `https://github.com/rsms/inter/releases` (najnovšia stable, typically v4.x) — komplet zdrojový balík obsahuje `Inter-VariableFont_*.ttf`.
2. Download JetBrains Mono Variable from `https://github.com/JetBrains/JetBrainsMono/releases` (typically v2.x).
3. **Subset to latin + latin-ext** via `pyftsubset` (fonttools) or online tool (Wakamai Fondue). Príkaz:
   ```bash
   pyftsubset Inter-VariableFont.ttf \
     --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" \
     --output-file=inter-variable-latin.woff2 --flavor=woff2 --layout-features='*'
   ```
   Pre `latin-ext` použi unicode-range `U+0100-024F,U+0259,U+1E00-1EFF,U+2020,U+20A0-20AB,U+20AD-20CF,U+2113,U+2C60-2C7F,U+A720-A7FF`.
4. Verify file size: typically 30-50 KB per subset. Ak je > 80 KB, subset bol nedostatočne agresívny.

**Alternatíva** (jednoduchšia): použiť pre-built woff2 subsets z `@fontsource-variable/inter` + `@fontsource-variable/jetbrains-mono` npm balíkov, **ale extrahovať len súbory** do `public/fonts/` (NIE pridať balíky ako runtime dep) — per D5 obmedzenie. Cieľ je mať statické woff2 v `public/` aby Vite to slúžil priamo bez bundle overhead.

### Fáza B — @font-face + preload

1. Napíš `packages/design-system/src/tokens/fonts.css`:
   ```css
   @font-face {
     font-family: "Inter Variable";
     src: url("/fonts/inter-variable-latin.woff2") format("woff2-variations");
     font-weight: 100 900;
     font-style: normal;
     font-display: swap;
     unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC,
       U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
   }
   @font-face {
     font-family: "Inter Variable";
     src: url("/fonts/inter-variable-latin-ext.woff2") format("woff2-variations");
     font-weight: 100 900;
     font-style: normal;
     font-display: swap;
     unicode-range: U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113,
       U+2C60-2C7F, U+A720-A7FF;
   }
   /* same pattern for JetBrains Mono Variable */
   ```
2. Import `fonts.css` z `tokens.css` cez `@import url("./fonts.css");` (Vite to inline-uje, žiadny extra request).
3. Pridaj preload do `apps/portal/index.html` + `apps/workspace/index.html`:
   ```html
   <link
     rel="preload"
     as="font"
     type="font/woff2"
     href="/fonts/inter-variable-latin.woff2"
     crossorigin
   />
   ```
   **Iba latin** (najčastejší path) — latin-ext je on-demand cez unicode-range.

### Fáza C — Verification + PR

1. `pnpm --filter @sdm/portal build && pnpm --filter @sdm/portal preview` → otvor v Chrome → DevTools Network filter Font → verify woff2 from localhost.
2. Computed style check: `getComputedStyle(document.body).fontFamily` should resolve na `"Inter Variable"` (nie `system-ui`).
3. Network panel verify: pri scroll-down na SK text s `ľ ĺ č ď ť ž ó é á í`, prehliadač pridá request na `inter-variable-latin-ext.woff2` (unicode-range trigger).
4. `pnpm -r typecheck/lint/test/build` green.
5. ROADMAP refresh + G.5.md → DONE + PR.

## Open questions / risks — recommended resolutions

- **Variable vs static font**: variable (jeden súbor pre celý weight range 100-900). Static (4-5 súborov per weight) by zvýšil font byte budget o 3-5×. Variable confirmed per `tokens.md §1 Branding decision`.
- **Subset choice**: `latin + latin-ext` (sufficient pre SK + EN + CS + PL + most EU langs). NOT `latin-vietnamese` ani `cyrillic` (out of scope per i18n decision SK/EN only).
- **woff2 only, NO woff fallback**: woff2 má 96%+ browser support (caniuse). Workspace target je Chrome/Firefox/Safari latest 2 (per ADR-06). Žiadny IE11.
- **Storing fonts v repo**: 4 súbory × ~40 KB = ~160 KB per app × 2 apps = ~320 KB total binary. Acceptable. Alternatíva: shared `packages/design-system/fonts/` + symlink/copy na build-time, **ale** to komplikuje Vite serving — direct `public/fonts/` per app je jednoduchšie a Vite-natívne.
- **License compliance**: Inter má SIL OFL 1.1, JetBrains Mono má SIL OFL 1.1. Obe vyžadujú redistribúciu license file. Súbory: `OFL-Inter.txt` + `OFL-JetBrainsMono.txt` v `public/fonts/`.
- **Preload count**: per `performance.md §9`, max 4 font files preload-né. G.5 preload-uje **iba 2** (inter-latin + mono-latin). latin-ext sa load-uje on-demand (unicode-range gate).
- **CORS for `crossorigin` attribute on preload**: required pre fonts even when served same-origin (per HTTP spec). Bez `crossorigin` browser ignoruje preload pri followup request.
- **Inter Display variant**: per `tokens.md` `font.family.display = "Inter Variable", "Inter"` — používame **rovnaký variable font** ako sans (variable axis zvládne display sizes). Žiadny separate Inter Display súbor.

## Implementation notes (post-merge)

- **Source of fonts**: `@fontsource-variable/inter@5.2.8` + `@fontsource-variable/jetbrains-mono@5.2.8` extracted via `npm pack` → tarball → copy `files/{inter,jetbrains-mono}-latin{,-ext}-wght-normal.woff2` into both apps' `public/fonts/`, rename per G.5.md convention. **NIE pridané ako runtime deps** (per D5). pyftsubset path nepoužitý — fontsource ships pre-subset-ed woff2 priamo.
- **Variable axis**: Inter `100 900`, JetBrains Mono `100 800` (per upstream fontsource — JBM masters končia pri 800). Tokens v `tokens.css` referencujú `var(--font-family-{sans,mono})` ktoré ostávajú nezmenené z G.1 (fallback chain end-to-end intact).
- **Preload count**: 1 per SPA (`inter-variable-latin.woff2`) — JBM sa load-uje on-demand pri prvom mono glyph render-i (code blocks, ticket IDs), `font-display: swap` pokrýva FOUT. latin-ext gate-uje `unicode-range` — no SK content = no fetch.
- **Cyrillic / Greek / Vietnamese subsets**: deliberately not shipped (out of scope per i18n decision SK/EN/CS/PL). Ak v budúcnosti pribudne ďalší locale, znova extract z fontsource.

## Notes pre subagenta

- Subagent dispatchovaný cez Agent tool s `subagent_type: "general-purpose"`. Self-contained brief obsahuje aj:
  - **Acquisition path**: download from official GitHub releases (Inter, JetBrains Mono) ALEBO extract z `@fontsource-variable/*` npm balíčkov (preferred — `npm view @fontsource-variable/inter files` + `npm pack` extract).
  - **Subset tooling**: `pyftsubset` (fonttools, `pip install fonttools brotli`) — alebo skip subset-ovanie a použiť pre-built latin subset z fontsource (typical 30-45 KB per subset).
  - **NO CDN imports** v žiadnom konfiguračnom súbore (žiadny `googleapis.com/css?family=Inter` ani similar).
  - **License files**: nutné committed; Inter OFL + JetBrains Mono OFL.
- Subagent **NESMIE**:
  - Pridať `@fontsource-variable/*` ako runtime deps (cieľ je statické woff2 v `public/`, nie npm import).
  - Použiť CDN (Google Fonts, jsDelivr, unpkg) na produkčné loading.
  - Vynechať `font-display: swap` (FOUT acceptable, FOIT nie — per perf).
  - Mergovať vlastný PR (parent agent zavŕši).
