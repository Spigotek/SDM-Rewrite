# Phase G — Cross-cutting concerns

> Cieľ: brand visual identity konzistentná naprieč portal + workspace, sk+en
> kompletné, performance budgets enforced v CI, Sentry beží, fonts self-hosted.
>
> Bez Phase G ide MVP do produkcie technicky funkčný, ale **chýba mu polish**:
> dnešné FE má `system-ui` font, hardcoded copy v komponentoch, žiadny Sentry,
> žiadne perf gates v CI, žiadne base UI komponenty v `@sdm/design-system`.

## Cross-chunk decisions

### D1 — Per-chunk PR-flow (per memory `pr-flow`)

Každý G.X chunk = jedna branch `chunk/G.X-<slug>` od fresh `main` + 1 PR

- squash --admin --delete-branch merge. **Žiadne stacked PR**.

### D2 — Sekvencia (G.1 → G.5 → G.2 → G.3 → G.4)

G.5 musí ísť **po G.1** lebo typography tokeny (`font.family.sans/mono`)
referencujú `Inter Variable` + `JetBrains Mono Variable` — fonty musia byť
self-hostené predtým ako tokeny začnú smerovať na `local()` v `@font-face`.
G.2 / G.3 / G.4 sú navzájom nezávislé, ale fixujem poradie pre prediktívny tok.
G.4 ide posledné, lebo LHCI thresholds + size-limit budgets sa kalibrujú na
bundle structure ktorá je stabilná až po G.1 (design system) + G.5 (fonts)

- G.2 (i18n catalogs) merge.

### D3 — Tech stack final (per `library-recommendation.md` r2)

Confirmed pre Phase G:

- **G.1**: Radix UI Primitives + Lucide React + CSS Custom Properties + CSS Modules. Žiadny Tailwind, žiadny Mantine/MUI.
- **G.2**: `i18next@23` + `react-i18next@14/15` + `i18next-icu` + `@formatjs/intl-messageformat`. Catalogs JSON v `packages/i18n/catalogs/`.
- **G.3**: `@sentry/react` (FE), GlitchTip ako self-hosted fallback (DSN cez env). BFF už má `pino` + F.4 audit taxonomy zelený.
- **G.4**: `@lhci/cli@0.13.x` pre Lighthouse, `size-limit` pre bundle, `rollup-plugin-visualizer` pre per-PR report.
- **G.5**: Inter Variable + JetBrains Mono Variable woff2, latin + latin-ext (SK diakritika), `font-display: swap`.

### D4 — Subagent dispatch pattern

Každý G.X.md plán je **self-contained** — subagent (general-purpose) ho dostane
ako primárny vstup, musí mať dosť kontextu na celý cyklus probe→implement→test→PR
bez extra hand-off. Parent agent verifikuje výsledný PR + merge, **nedôveruje
len subagent summary** ("Trust but verify" per system prompt). Memory `pr-flow`

- `real-backend.md` paths sa subagentom dedia automaticky cez user CLAUDE.md.

### D5 — Žiadne nové runtime deps mimo r2 stack

Phase G **neotvára** library re-evaluation. Ak subagent narazí na deficiency
v r2 picked library (napr. Radix nevie X), eskaluje to ako Open question
v G.X.md, **nepredstihne** rozhodnutie sám.

## Sekvencia chunkov

```
G.1 — Design tokens + base components (Button/Input/Card/Modal/Badge/...)
    ↓ blokuje
G.5 — Self-host Inter + JetBrains Mono woff2
    ↓ blokuje
G.2 — i18n provider + sk/en catalogs
    ↓ blokuje
G.3 — @sentry/react + correlation ID propagation
    ↓ blokuje
G.4 — LHCI + size-limit + manualChunks tuning
```

Každý chunk je `~F.6-sized` (1000-1500 LOC + docs + tests). Subagenty
bežia sekvenčne — parent agent merguje pred dispatchom ďalšieho subagenta.

## Phase G entry criteria

- ✅ Phase F merged (6/6 chunks, PR #18 zaviera).
- ✅ Tech stack r2 final per `library-recommendation.md` (Radix / i18next / Sentry / LHCI confirmed).
- ✅ Subagent dispatch pattern proven (Phase F mal len main-thread; G.1 je first dispatch experiment).
- ⏳ `packages/design-system/` + `packages/i18n/` sú stuby — len `PACKAGE_NAME` constant.

## Phase G exit criteria (Done-when celá Phase G)

- `@sdm/design-system` exportuje **~20 base komponentov** + tokens.css; portal + workspace ich konzumujú namiesto inline-style hardcoded values.
- `@sdm/i18n` exportuje `I18nProvider` + `useTranslation` + `Trans`. SK + EN catalogs (`packages/i18n/catalogs/{shared,portal,workspace}/{sk,en}.json`) majú ≥ 80 % key coverage z aktuálnych SPA shellov.
- Sentry beží proti staging Sentry instance (alebo GlitchTip self-hosted). FE → BFF → upstream correlation ID flow end-to-end overený.
- LHCI v CI gate-uje portal `/` + workspace `/queue` na thresholds z `performance.md §2`. size-limit gate-uje `apps/portal` 180 KB + `apps/workspace` 350 KB initial JS.
- Inter Variable + JetBrains Mono Variable self-hostené v `apps/{portal,workspace}/public/fonts/`, žiadny CDN call.
- ROADMAP Phase G → ✅ DONE; next-up = Phase H feature modules.

## Open questions naprieč Phase G

- **Storybook (per `library-recommendation.md §Adoption strategy`)** — povinné pre G.1 alebo deferred do post-G.1 chunku? Recommendation: **deferred** — Storybook + axe-core CI je separate piece of infra, môže ísť ako súčasť G.4 (CI/perf gates) alebo samostatný G.6 follow-up. Phase G done-when **nemenuje** Storybook.
- **GlitchTip vs Sentry SaaS** — per `audit-and-compliance.md` security policy môže byť customer-driven. G.3 implementuje `@sentry/react` (DSN env-driven), kompatibilný s oboma — concrete back-end deployment ide do post-G.3 ops chunku.
- **Visual regression tooling** — `library-recommendation.md §Validácia` spomína Chromatic alebo Playwright snapshots. Deferred — out of Phase G scope (ide do post-MVP QA hardening fázy).
- **Per-tenant branding hooks** (`theming.md §7`) — `--brand-mark` CSS variable per tenant. **MVP scope: nie** — G.1 zavedie iba global tokens. Per-tenant branding je v1+ post-MVP.
- **Density user toggle** (`theming.md §6`) — workspace user-toggleable density (compact/default/comfortable) cez UserMenu. G.1 zavedie tokens + `data-density` attr; UI toggle ide do workspace-shell chunku (post-MVP).

## Notes

- **Subagent self-discovery**: každý G.X.md plán explicitne menuje **Inputs** s plnými cestami k docs/code aby subagent vedel čo čítať bez exploration overhead.
- **Existing F.x infrastructure**: BFF má `pino` + F.4 audit taxonomy + `X-Correlation-ID` propagation (per F.1 `apps/bff/src/auth/correlation.ts`). G.3 to **nezduplikuje**, len doplní FE side.
- **No new monorepo packages**: G.1/G.2 plnia existujúce stuby (`packages/design-system/`, `packages/i18n/`). G.3-G.5 menia `apps/{portal,workspace}/` + root-level CI configy.
