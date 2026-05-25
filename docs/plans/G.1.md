# G.1 — Design tokens + base components

> **Status**: ✅ DONE (PR TBD pending review)
> **Branch**: `chunk/G.1-design-tokens` (od fresh `main` po F.6 merge)
> **PR**: TBD
> **Cieľ**: naplniť `packages/design-system/` stub kompletnou token sadou
> (tokens.css + CSS Custom Properties + light/dark/hc theming) + 12 base
> komponentov (Button, IconButton, Link, Icon, Badge, StatusBadge, PriorityBadge,
> Card, TextField, TextArea, Select, Checkbox) konzumovaných v `apps/portal`
>
> - `apps/workspace` shellach.

## Pivot vs ROADMAP

ROADMAP `G.1` bullet: _"Design system tokens + base komponenty — Inputs: docs/agents/design-system/{tokens,components,theming}.md. Output: packages/design-system/src/{tokens,primitives}/\*."_

`packages/design-system/src/index.ts` momentálne exportuje len `PACKAGE_NAME`
constant. SPA shelly hardcodujú farby/spacings inline. G.1 to napraví — žiadne
magic numbers v komponentoch, všetko cez CSS Custom Properties.

## Inputs

- **`docs/agents/design-system/tokens.md`** — autoritatívny zoznam tokenov (typography, colors, spacing, radius, shadow, motion, z-index, breakpoints, layout, border).
- **`docs/agents/design-system/tokens.json`** — strojovo čitateľná verzia (Style Dictionary kompatibilná).
- **`docs/agents/design-system/theming.md`** — light/dark/hc témy, FOUC prevention, density layer.
- **`docs/agents/design-system/components.md`** — komponentový inventory (50+ komponentov; G.1 implementuje len **P0 base set** — viď §Outputs).
- **`docs/agents/design-system/library-recommendation.md`** — Radix UI primitives + Lucide React + CSS Custom Properties + CSS Modules potvrdené v r2.
- **`docs/agents/design-system/a11y.md`** — WCAG AA pravidlá (a11y-tested komponenty).
- **`packages/design-system/src/index.ts`** — current stub.
- **`apps/portal/src/shell/`** + **`apps/workspace/src/shell/`** — existujúce shell komponenty ktoré po G.1 budú konzumovať `@sdm/design-system`.

## Outputs

```
packages/design-system/
├── package.json                          # +deps: @radix-ui/react-*, lucide-react, clsx
├── src/
│   ├── index.ts                          # re-export all primitives + tokens types
│   ├── tokens/
│   │   ├── tokens.css                    # :root + [data-theme="dark"|"hc"] CSS Custom Properties
│   │   ├── reset.css                     # Modern CSS reset (Andy Bell-style)
│   │   ├── fonts.css                     # @font-face declarations (referencia na assety z G.5 — placeholder)
│   │   └── theme.ts                      # Theme detection + persist (FOUC-safe inline script as string export)
│   ├── primitives/
│   │   ├── Button/{Button.tsx,Button.module.css,Button.test.tsx,index.ts}
│   │   ├── IconButton/...
│   │   ├── Link/...
│   │   ├── Icon/...                      # Wraps lucide-react with size variants
│   │   ├── Badge/...
│   │   ├── StatusBadge/...               # Specialised Badge per ticket lifecycle (uses status code)
│   │   ├── PriorityBadge/...             # Specialised Badge per severity (uses color.severity.*)
│   │   ├── Card/...
│   │   ├── TextField/...
│   │   ├── TextArea/...
│   │   ├── Select/...                    # Radix Select primitive + skin
│   │   └── Checkbox/...                  # Radix Checkbox primitive + skin
│   └── utils/
│       ├── cn.ts                         # clsx wrapper
│       └── data-component.ts             # data-component attr helper for e2e selectors
└── vitest.config.ts                      # if not present

apps/portal/src/shell/app-shell.tsx       # consume @sdm/design-system tokens + Button + Card
apps/workspace/src/shell/app-shell.tsx    # same
apps/portal/src/main.tsx                  # import "@sdm/design-system/tokens.css" + apply theme
apps/workspace/src/main.tsx               # same
apps/portal/index.html                    # inline FOUC theme script in <head>
apps/workspace/index.html                 # same

docs/ROADMAP.md                           # G.1 → ✅ DONE
docs/plans/G.1.md                         # tento súbor → Status DONE
```

## Done-when

- [x] `@sdm/design-system` exportuje **tokens.css** s CSS Custom Properties pre všetky tokeny z `tokens.md` §1-§12 (typography, colors light+dark+hc, spacing, radius, shadow, motion, z-index, breakpoints, layout, border).
- [x] Theme switching funguje cez `[data-theme="light|dark|hc"]` na `<html>` — manuálne persisted v localStorage + FOUC-safe inline script v `index.html` `<head>` (per `theming.md §5.2`).
- [x] `prefers-color-scheme: dark` + `prefers-contrast: more` auto-detect pri prvom load; manual override má prednosť.
- [x] **12 base komponentov** implementovaných: Button, IconButton, Link, Icon, Badge, StatusBadge, PriorityBadge, Card, TextField, TextArea, Select, Checkbox. Každý:
  - používa tokens (žiadne hardcoded hex/px),
  - má `data-component` attr (per `components.md` intro),
  - má min. 3 vitest testy (default + variant + interaction) — celkom **39 testov pass**,
  - splňuje a11y pravidlá zo svojej sekcie v `components.md` (focus ring, aria-label, keyboard).
- [x] `apps/portal/src/shell/{top-bar,login-page}.tsx` + `apps/workspace/src/shell/{top-bar,login-page}.tsx` konzumujú `Button` + `Card` z `@sdm/design-system`. Shell layout CSS prepísané na design-system tokeny (`var(--color-*)`, `var(--spacing-*)` atď.) — žiadne hardcoded `#hex`.
- [x] `pnpm -r typecheck/lint/test/build` green.
- [ ] **Bundle delta exceeds soft target.** Portal initial JS 188.15 → 279.29 KB (Δ **+91.14 KB**, +31.51 KB gzip). CSS 4.95 → 31.65 KB (Δ +26.70 KB, +4.62 KB gzip). Workspace symmetric. Hlavní contributors: Radix Select (~50 KB), Radix Checkbox (~10 KB), lucide-react (selektívny import, ale tree-shaking ešte nezarezal v rámci jednoho chunk-u). **G.4 vyrieši cez `manualChunks` (Radix popper / floating-ui na samostatný chunk) + size-limit budget enforcement** (180 KB portal cieľ z Phase G done-when). Soft warning, neblokujúce per chunk brief.
- [x] Žiadne nové runtime deps mimo `library-recommendation.md` r2 stack (`@radix-ui/react-select` 2.2.6, `@radix-ui/react-checkbox` 1.3.3, `lucide-react` 0.471.0). `clsx` nahradené inline `cn` helperom (40 LOC) — eliminuje runtime dep úplne.
- [x] ROADMAP toggle: G.1 → ✅ DONE.

## Stratégia

### Fáza A — Tokens + theming (foundation)

1. Vygeneruj `packages/design-system/src/tokens/tokens.css` z `tokens.json` (alebo manuálne podľa `tokens.md` — kratšie ako Style Dictionary setup pre MVP scale).
2. Light defaults v `:root`; dark v `[data-theme="dark"]`; hc v `[data-theme="hc"]`.
3. Density attr `[data-density="compact|default|comfortable"]` per `theming.md §6` — len pridáva spacing overrides, neduplikuje farby.
4. FOUC-safe inline `<script>` v `index.html` `<head>` per `theming.md §5.2`.
5. Export TypeScript types pre tokeny (`type TokenSpacing = "0" | "px" | "0_5" | ...`) pre použitie v komponentoch.

### Fáza B — Base components

Implementačná hierarchia (atómy → molekuly):

1. **Foundation**: `Icon` (Lucide wrapper), `cn` utility.
2. **Atómy**: `Button`, `IconButton`, `Link`, `Badge`.
3. **Specializácie**: `StatusBadge`, `PriorityBadge` (kompozícia nad Badge).
4. **Forms**: `TextField`, `TextArea`, `Select` (Radix Select primitive + skin), `Checkbox` (Radix Checkbox).
5. **Containers**: `Card`.

Každý komponent:

- Single-file `.tsx` + colocated `.module.css` (per ADR-06 styling rozhodnutie).
- Strict TypeScript props interface (žiadne `any`).
- Vitest test (default + variant + interaction).
- `data-component` attr equal to kebab-case meno (per `components.md` intro).
- Žiadne magic hex/px — všetko cez `var(--token-name)` v CSS Modules.

### Fáza C — Integration + tests + PR

1. Update `apps/portal/src/shell/app-shell.tsx` + `apps/workspace/src/shell/app-shell.tsx` aby aspoň importovali `Button` + `Card` z `@sdm/design-system`. Test že tokens.css je apllied cez `main.tsx` import.
2. `pnpm -r typecheck/lint/test/build` green.
3. Bundle size check: pred-G.1 baseline vs po-G.1 delta (cez `pnpm --filter @sdm/portal build` size output). Initial JS delta should be < 10 KB.
4. ROADMAP refresh + G.1.md → DONE.
5. PR per memory `pr-flow`: `gh pr create` s konkrétnym title + body template; squash --admin --delete-branch po CI green.

## Open questions / risks — recommended resolutions

- **Storybook**: NEZAVEDIEME v G.1 (per `G.md §Open questions naprieč Phase G`). Vitest unit tests + manual integration cez SPA shell stačia pre MVP. Storybook ide do post-G.1 chunku (alebo G.4).
- **Radix primitives version**: použi `latest` (per `library-recommendation.md` "Radix UI Primitives | latest"). Pin do `package.json` po inštalácii (žiadne `^` ranges pre Radix — má časté breaking releases).
- **Lucide icons tree-shaking**: import per-icon (`import { ChevronDown } from "lucide-react"`), nie bundle full set. Verify cez bundle analyzer.
- **CSS Modules naming**: per-component `.module.css` colocated; class names camelCase v JSX (`styles.primaryButton`), kebab-case v CSS (`.primary-button`).
- **Dark theme test coverage**: Vitest neumí matchMedia natívne; mock `window.matchMedia` v `setupTests.ts` (existuje vo `apps/portal/vitest.config.ts`?). Ak nie, pridať.
- **`prefers-reduced-motion`**: tokens.css zníži motion durations na 0 ms pri `@media (prefers-reduced-motion: reduce)` — per `tokens.md §8`.
- **Font references**: `font.family.sans` references `"Inter Variable"` ktorý sa self-hostuje až v G.5. **Pre G.1**: `tokens.css` použije `font-family: "Inter Variable", "Inter", system-ui, ...` — fallback na system-ui kým G.5 self-host pridá `@font-face`. Žiadny CDN call.

## Notes pre subagenta

- Subagent dispatchovaný cez Agent tool s `subagent_type: "general-purpose"`. Self-contained brief obsahuje aj tieto pravidlá:
  - **PR-flow per memory**: branch z fresh `main`, jedna commit (alebo malé logical commits), `gh pr create`, neexpe sám merge — parent agent merguje.
  - **Žiadne stacked PR**.
  - **Test gates**: typecheck/lint/test/build musia byť zelené pred PR create.
  - **Žiadne nové runtime deps** mimo Radix + Lucide + clsx (per D5).
  - **Commit message style**: mirror commit history z `git log --oneline -10` (F.x chunky).
  - **Memory pointer**: per-project memory v `/Users/spigot/.claude/projects/-Users-spigot-Desktop-CC-Projekty-SDM-Rewrite/memory/` — auto-loadovaná pre PR-flow + creds.
- Subagent **NESMIE**:
  - Spúšťať `pnpm dev` ani live BFF/CASDM smoky (G.1 je pure FE, žiadny B-E touch).
  - Otvárať Storybook (out of scope).
  - Pridávať Tailwind / styled-components / iný styling stack (per D5).
  - Mergovať vlastný PR (parent agent zavŕši).
