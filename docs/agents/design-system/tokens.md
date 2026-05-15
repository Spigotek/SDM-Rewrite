# Design Tokens — SDM-Rewrite

> Autoritatívny zdroj všetkých vizuálnych konštánt pre `apps/portal`
> a `apps/workspace`. **Žiadne magic numbers v komponentoch** — všetko
> cez tokeny. Naming konvencia: `kategória.role.variant`
> (Style Dictionary kompatibilná).
>
> Strojovo čitateľná verzia: [`tokens.json`](./tokens.json).
> Light/dark variácie: [`theming.md`](./theming.md).

## Branding decision (delegované GOAL §11)

| Téma | Voľba | Odôvodnenie |
|---|---|---|
| **Font (primárny)** | **Inter** (variable) | Open-licensed (OFL), high x-height, optimalizovaný na UI scale 13–16 px, podpora SK/EN diakritiky vrátane "ľĺčďť" hákov. Široké pokrytie (Linear, Vercel, Mozilla). Alternatíva: IBM Plex Sans. |
| **Font (monospace)** | **JetBrains Mono** | Code blocks v KB článkoch + composer, pre-formatted CI atribúty (FQDN, IP). Open-licensed. |
| **Akcent (brand)** | **Indigo 600** (`#4F46E5`) | Neutrálne moderný, nie korporát "harsh blue 2010". Dostatočný kontrast aj na neutrálnom pozadí, čistý v light aj dark. |
| **Base paleta** | **Slate (neutral)** | Cool-grey neutrál, vyzerá moderne v 2026 estetike. Vyhýba sa "Bootstrap blue" assoc. |
| **Densita** | Dvojrežimová | `comfortable` (portal, 16 px base) + `compact` (workspace queue rows 28–32 px). |
| **Estetika** | Linear / Vercel / Notion line | Čisté, vzdušné, dobre typografované. Bez gradientov, bez skeuomorfizmu, bez heavy shadows. |
| **Logo placeholder** | Lettermark "SDM" v Inter Display Bold | V tejto fáze žiadne raster assety; render cez CSS, replaceable per tenant cez `--brand-mark` CSS premennú. |

## 1. Typography scale

Type scale je založená na **modulárnej škále 1.125 (major second)** s base 16 px.
Variabilný font Inter umožňuje fine-tuning váhy bez bundle penalty.

| Token | Veľkosť (px) | Line-height | Weight | Letter-spacing | Použitie |
|---|---|---|---|---|---|
| `font.size.xs` | 11 | 16 (1.45) | 500 | +0.02em | Badges, micro-labels, table column captions |
| `font.size.sm` | 13 | 18 (1.38) | 400 | 0 | Workspace queue rows, dense table content, meta info |
| `font.size.base` | 14 | 20 (1.43) | 400 | 0 | Workspace body text, form inputs (workspace) |
| `font.size.md` | 15 | 22 (1.46) | 400 | 0 | Portal body text, form inputs (portal) |
| `font.size.lg` | 17 | 24 (1.41) | 500 | -0.005em | Card titles, section sub-headings |
| `font.size.xl` | 20 | 28 (1.40) | 600 | -0.01em | Page H2, modal titles |
| `font.size.2xl` | 24 | 32 (1.33) | 600 | -0.015em | Page H1 (workspace) |
| `font.size.3xl` | 30 | 38 (1.27) | 600 | -0.02em | Hero greeting (portal "Ahoj, Lucia 👋") |
| `font.size.4xl` | 36 | 44 (1.22) | 700 | -0.025em | Marketing/empty-state hero (rezerva) |

### Font families

| Token | Hodnota | Fallback |
|---|---|---|
| `font.family.sans` | `"Inter Variable", "Inter"` | `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` |
| `font.family.mono` | `"JetBrains Mono Variable", "JetBrains Mono"` | `ui-monospace, "SF Mono", Menlo, Consolas, monospace` |
| `font.family.display` | `"Inter Variable", "Inter"` | Rovnaký ako sans (variabilný Inter zvládne aj display) |

### Font weights (Inter variable axis)

| Token | Hodnota | Použitie |
|---|---|---|
| `font.weight.regular` | 400 | Body text |
| `font.weight.medium` | 500 | Labels, badges, navigation |
| `font.weight.semibold` | 600 | Headings, button labels |
| `font.weight.bold` | 700 | Logo, hero, critical badges |

## 2. Color tokens — neutral palette

Slate-based 12-step neutral. Hodnoty sú **light theme defaults**;
dark theme má rovnaké tokeny s inverznými hodnotami (viď
[`theming.md`](./theming.md)).

| Token | Light hex | Dark hex | Použitie |
|---|---|---|---|
| `color.neutral.0` | `#FFFFFF` | `#09090B` | Pozadie listov (modal, card) |
| `color.neutral.50` | `#F8FAFC` | `#0F0F11` | App background (portal default) |
| `color.neutral.100` | `#F1F5F9` | `#18181B` | Subtle background (sidebar, queue background) |
| `color.neutral.200` | `#E2E8F0` | `#27272A` | Borders (default), divider lines |
| `color.neutral.300` | `#CBD5E1` | `#3F3F46` | Borders (emphasized), disabled outlines |
| `color.neutral.400` | `#94A3B8` | `#52525B` | Placeholder text, disabled labels |
| `color.neutral.500` | `#64748B` | `#71717A` | Meta text, captions |
| `color.neutral.600` | `#475569` | `#A1A1AA` | Secondary text |
| `color.neutral.700` | `#334155` | `#D4D4D8` | Body text (alt) |
| `color.neutral.800` | `#1E293B` | `#E4E4E7` | Primary body text |
| `color.neutral.900` | `#0F172A` | `#F4F4F5` | Headings |
| `color.neutral.1000` | `#020617` | `#FAFAFA` | Strongest contrast (very rare) |

### Sémantické color roles (light)

Sémantické tokeny **abstrahujú primitívne color tokeny** — komponenty
nikdy nereferencujú `color.neutral.500`, vždy `color.text.secondary`.

| Token | Light hodnota | Dark hodnota | Použitie |
|---|---|---|---|
| `color.background.app` | `color.neutral.50` | `color.neutral.50 (dark)` | Hlavné pozadie obrazovky |
| `color.background.surface` | `color.neutral.0` | `color.neutral.100 (dark)` | Karty, modaly, panely |
| `color.background.subtle` | `color.neutral.100` | `color.neutral.200 (dark)` | Sidebar, queue background, code block bg |
| `color.background.hover` | `color.neutral.100` | `color.neutral.300 (dark)` | Hover state pre rows, list items |
| `color.background.selected` | `#EEF2FF` | `#1E1B4B` | Selected row v queue, active sidebar item |
| `color.background.overlay` | `rgba(15,23,42,0.55)` | `rgba(0,0,0,0.65)` | Modal backdrop |
| `color.text.primary` | `color.neutral.900` | `color.neutral.900 (dark)` | Headings, dôležitý text |
| `color.text.body` | `color.neutral.800` | `color.neutral.800 (dark)` | Body |
| `color.text.secondary` | `color.neutral.600` | `color.neutral.600 (dark)` | Meta info, helper text |
| `color.text.tertiary` | `color.neutral.500` | `color.neutral.500 (dark)` | Placeholders, captions |
| `color.text.disabled` | `color.neutral.400` | `color.neutral.400 (dark)` | Disabled labels |
| `color.text.inverse` | `color.neutral.0` | `color.neutral.1000 (dark)` | Text na coloured backgrounds (primary button) |
| `color.text.link` | `color.brand.600` | `color.brand.400 (dark)` | Hyperlinks, internal references |
| `color.border.default` | `color.neutral.200` | `color.neutral.300 (dark)` | Inputs, cards, divider |
| `color.border.emphasis` | `color.neutral.300` | `color.neutral.400 (dark)` | Hovered inputs, emphasized borders |
| `color.border.focus` | `color.brand.500` | `color.brand.400 (dark)` | Focus ring (s ring-offset) |

## 3. Brand & accent colors

**Indigo 600** ako primárny brand. Doplnková palette pre 10-step škálu.

| Token | Light hex | Dark hex |
|---|---|---|
| `color.brand.50` | `#EEF2FF` | `#1E1B4B` |
| `color.brand.100` | `#E0E7FF` | `#312E81` |
| `color.brand.200` | `#C7D2FE` | `#3730A3` |
| `color.brand.300` | `#A5B4FC` | `#4338CA` |
| `color.brand.400` | `#818CF8` | `#4F46E5` |
| `color.brand.500` | `#6366F1` | `#6366F1` |
| `color.brand.600` | `#4F46E5` | `#818CF8` |
| `color.brand.700` | `#4338CA` | `#A5B4FC` |
| `color.brand.800` | `#3730A3` | `#C7D2FE` |
| `color.brand.900` | `#312E81` | `#E0E7FF` |

Brand sémantika:

| Token | Light | Dark | Použitie |
|---|---|---|---|
| `color.brand.bg` | `color.brand.600` | `color.brand.500` | Primary button background |
| `color.brand.bg-hover` | `color.brand.700` | `color.brand.400` | Primary button hover |
| `color.brand.bg-subtle` | `color.brand.50` | `color.brand.900` | Selected row, brand banner |
| `color.brand.fg` | `color.brand.600` | `color.brand.400` | Brand text (link, icon) |
| `color.brand.border` | `color.brand.500` | `color.brand.500` | Focus ring, brand outline |

## 4. Semantic / status colors

Sémantické farby pre status, priority, risk, ticket lifecycle.
**Nikdy nepoužívať len farbu** — vždy v kombinácii s ikonou / labelom
(WCAG 1.4.1 — Use of Color).

### Success (resolved, approved, healthy)

| Token | Light | Dark | Použitie |
|---|---|---|---|
| `color.success.fg` | `#16A34A` | `#4ADE80` | Resolved badge text, success icon |
| `color.success.bg` | `#F0FDF4` | `#052E16` | Success toast bg, resolved badge bg |
| `color.success.border` | `#86EFAC` | `#16A34A` | Success border |
| `color.success.solid` | `#15803D` | `#22C55E` | Solid success button (rare) |

### Warning (pending approval, SLA risk, hold)

| Token | Light | Dark | Použitie |
|---|---|---|---|
| `color.warning.fg` | `#D97706` | `#FBBF24` | Warning badge text |
| `color.warning.bg` | `#FFFBEB` | `#451A03` | Warning toast bg |
| `color.warning.border` | `#FCD34D` | `#D97706` | Warning border |
| `color.warning.solid` | `#B45309` | `#F59E0B` | Solid warning button |

### Danger (escalated, breach, error)

| Token | Light | Dark | Použitie |
|---|---|---|---|
| `color.danger.fg` | `#DC2626` | `#F87171` | Danger badge text, error message |
| `color.danger.bg` | `#FEF2F2` | `#450A0A` | Danger toast bg |
| `color.danger.border` | `#FCA5A5` | `#DC2626` | Danger border |
| `color.danger.solid` | `#B91C1C` | `#EF4444` | Destructive button bg |

### Info (notifications, neutral hint, system message)

| Token | Light | Dark | Použitie |
|---|---|---|---|
| `color.info.fg` | `#2563EB` | `#60A5FA` | Info badge text |
| `color.info.bg` | `#EFF6FF` | `#172554` | Info toast bg |
| `color.info.border` | `#93C5FD` | `#2563EB` | Info border |
| `color.info.solid` | `#1D4ED8` | `#3B82F6` | Solid info button |

### Priority / Risk semantic mapping

Workspace queue, change calendar a CMDB CI status zdieľajú túto škálu.

| Severity | Token | Light | Dark | Vizuálny symbol (a11y) |
|---|---|---|---|---|
| `critical` / `emergency` | `color.severity.critical` | `#B91C1C` | `#EF4444` | 🟥 + label "Critical" |
| `high` | `color.severity.high` | `#EA580C` | `#FB923C` | 🟧 + label "High" |
| `medium` | `color.severity.medium` | `#D97706` | `#FBBF24` | 🟨 + label "Medium" |
| `low` | `color.severity.low` | `#65A30D` | `#A3E635` | 🟩 + label "Low" |
| `none` / `info` | `color.severity.none` | `color.neutral.400` | `color.neutral.500` | ⚪ + label "Info" |

### Status badge mapping (ticket lifecycle)

| Status (CA SDM mapping by 03) | Background | Text | Border |
|---|---|---|---|
| `New` | `color.info.bg` | `color.info.fg` | `color.info.border` |
| `Open` / `In Progress` | `color.warning.bg` | `color.warning.fg` | `color.warning.border` |
| `Hold` / `Pending` | `#F5F3FF` (light) / `#3B0764` (dark) | `#7C3AED` / `#C4B5FD` | `#C4B5FD` / `#7C3AED` |
| `Resolved` | `color.success.bg` | `color.success.fg` | `color.success.border` |
| `Closed` | `color.neutral.100` | `color.neutral.600` | `color.neutral.200` |
| `Reopened` | `color.danger.bg` | `color.danger.fg` | `color.danger.border` |

### Tenant environment badge

Per GOAL §11 + tenant-switcher wireframe — vizuálne odlíšiť production/staging/dev.

| Environment | Token | Light | Dark |
|---|---|---|---|
| `production` | `color.env.production` | `#DC2626` | `#F87171` |
| `staging` | `color.env.staging` | `#D97706` | `#FBBF24` |
| `development` | `color.env.development` | `#2563EB` | `#60A5FA` |
| `sandbox` | `color.env.sandbox` | `#7C3AED` | `#A78BFA` |

## 5. Spacing scale

8-pt grid s **half-step (4 px)** pre dense workspace. Linear-style škála.

| Token | Hodnota (px) | Hodnota (rem) | Použitie |
|---|---|---|---|
| `spacing.0` | 0 | 0 | Reset |
| `spacing.px` | 1 | 0.0625 | Hairline borders |
| `spacing.0_5` | 2 | 0.125 | Icon-to-text micro gap |
| `spacing.1` | 4 | 0.25 | Tight inline gap, badge padding-y |
| `spacing.1_5` | 6 | 0.375 | Compact button padding-y |
| `spacing.2` | 8 | 0.5 | Default inline gap (icon + label) |
| `spacing.3` | 12 | 0.75 | Form field padding-y |
| `spacing.4` | 16 | 1 | **Base unit**, card padding (compact) |
| `spacing.5` | 20 | 1.25 | Section row gap (workspace) |
| `spacing.6` | 24 | 1.5 | Card padding (comfortable) |
| `spacing.8` | 32 | 2 | Section gap (portal) |
| `spacing.10` | 40 | 2.5 | Page section gap |
| `spacing.12` | 48 | 3 | Hero / empty-state padding |
| `spacing.16` | 64 | 4 | Page top margin |
| `spacing.20` | 80 | 5 | Page hero margin |
| `spacing.24` | 96 | 6 | Splash padding |

### Density preset mapping

| Density | Row min-height | Cell padding-x | Cell padding-y | Form field padding | Použitie |
|---|---|---|---|---|---|
| `compact` | 28 px | `spacing.3` | `spacing.1_5` | `spacing.2` x `spacing.3` | Workspace queue, CMDB attribute tables |
| `default` | 36 px | `spacing.4` | `spacing.2` | `spacing.2_5` x `spacing.4` | Workspace tabs, lists |
| `comfortable` | 44 px | `spacing.4` | `spacing.3` | `spacing.3` x `spacing.4` | Portal forms, mobile targets (≥ 44 px = WCAG 2.5.5 AAA) |

## 6. Radius scale

| Token | Hodnota (px) | Použitie |
|---|---|---|
| `radius.none` | 0 | Reset |
| `radius.xs` | 2 | Badge corner |
| `radius.sm` | 4 | Inputs, buttons (default), table cells (none, inherit from container) |
| `radius.md` | 6 | Card, dropdown, popover |
| `radius.lg` | 8 | Modal, large surfaces |
| `radius.xl` | 12 | Hero card, featured action card |
| `radius.full` | 9999 | Avatar, pill badge, circular button |

## 7. Shadow / elevation

**Subtle**, nie heavy. Linear/Vercel-style.

| Token | Hodnota | Použitie |
|---|---|---|
| `shadow.none` | `none` | Default flat surfaces |
| `shadow.xs` | `0 1px 2px 0 rgba(0,0,0,0.05)` | Cards (resting) |
| `shadow.sm` | `0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.04)` | Cards (hover), dropdown |
| `shadow.md` | `0 4px 8px -2px rgba(0,0,0,0.08), 0 2px 4px -2px rgba(0,0,0,0.04)` | Popover, command palette |
| `shadow.lg` | `0 12px 24px -6px rgba(0,0,0,0.10), 0 4px 8px -4px rgba(0,0,0,0.05)` | Modal, sheet |
| `shadow.xl` | `0 20px 40px -12px rgba(0,0,0,0.15), 0 8px 16px -8px rgba(0,0,0,0.08)` | Spotlight (Cmd+K) |
| `shadow.focus.brand` | `0 0 0 2px var(--color-background-app), 0 0 0 4px var(--color-brand-500)` | Focus ring (2-tier) |
| `shadow.focus.danger` | `0 0 0 2px var(--color-background-app), 0 0 0 4px var(--color-danger-solid)` | Destructive focus |

Dark theme: shadow opacity sa zníži (`0.05 → 0.30+`), pretože tmavé pozadie
už shadow zožerie; viď [`theming.md`](./theming.md).

## 8. Motion / transitions

**Subtle**, fast, prerušiteľné. Žiadne page-level animácie. Rešpektuje
`prefers-reduced-motion` (viď [`a11y.md`](./a11y.md)).

| Token | Hodnota | Použitie |
|---|---|---|
| `motion.duration.instant` | 0 ms | Disabled při `prefers-reduced-motion` |
| `motion.duration.fast` | 120 ms | Hover, focus, button press feedback |
| `motion.duration.base` | 180 ms | Dropdown open, tooltip, accordion |
| `motion.duration.slow` | 240 ms | Modal enter/exit, drawer slide |
| `motion.duration.deliberate` | 320 ms | Empty state hero, onboarding |
| `motion.easing.standard` | `cubic-bezier(0.2, 0, 0, 1)` | Default — vstup |
| `motion.easing.emphasized` | `cubic-bezier(0.3, 0, 0, 1)` | Modal, drawer (exit) |
| `motion.easing.linear` | `linear` | Progress bar, skeleton shimmer |
| `motion.easing.decelerate` | `cubic-bezier(0, 0, 0.2, 1)` | Vstup zo strany |
| `motion.easing.accelerate` | `cubic-bezier(0.4, 0, 1, 1)` | Výstup von |

## 9. Z-index scale

Diskrétna škála pre stacking contexts. Žiadne ad-hoc `z-index: 9999`.

| Token | Hodnota | Použitie |
|---|---|---|
| `z.base` | 0 | Default |
| `z.dropdown` | 1000 | Dropdown menus, autocomplete |
| `z.sticky` | 1100 | Sticky headers, action bars |
| `z.banner` | 1200 | Top banner (system message) |
| `z.overlay` | 1300 | Modal backdrop |
| `z.modal` | 1400 | Modal content |
| `z.popover` | 1500 | Popovers, hover cards |
| `z.tooltip` | 1600 | Tooltips |
| `z.toast` | 1700 | Toast / snackbar |
| `z.spotlight` | 1800 | Command palette (Cmd+K) |
| `z.max` | 2147483647 | Emergency escape (debug overlay) |

## 10. Breakpoints

Mobile-first, používané najmä v `apps/portal` (Lucia: 30 % mobile).

| Token | Min-width | Použitie |
|---|---|---|
| `breakpoint.sm` | 640 px | Phone landscape / tablet portrait |
| `breakpoint.md` | 768 px | Tablet |
| `breakpoint.lg` | 1024 px | Desktop minimum (workspace requires this) |
| `breakpoint.xl` | 1280 px | Standard desktop |
| `breakpoint.2xl` | 1536 px | Wide desktop |

**Workspace minimum** je `breakpoint.lg` (1024 px). Pod tým ukáže banner
"Workspace vyžaduje desktop. Skús portal pre rýchlu úlohu z mobilu."

**Portal** je full responsive, single-column pri < 640 px.

## 11. Layout tokens

| Token | Hodnota | Použitie |
|---|---|---|
| `layout.container.sm` | 640 px | Portal forms (centered, single col) |
| `layout.container.md` | 768 px | Portal article (KB) |
| `layout.container.lg` | 1024 px | Portal dashboard, KB search |
| `layout.container.xl` | 1280 px | Portal max (rarely used) |
| `layout.container.full` | 100 % | Workspace |
| `layout.header.height` | 56 px | Top app bar |
| `layout.sidebar.width.collapsed` | 56 px | Workspace queue sidebar |
| `layout.sidebar.width.expanded` | 220 px | Workspace queue sidebar |
| `layout.right-panel.width` | 320 px | Workspace ticket detail context panel |

## 12. Border tokens

| Token | Hodnota |
|---|---|
| `border.width.0` | 0 |
| `border.width.hairline` | 1 px |
| `border.width.thin` | 1 px |
| `border.width.medium` | 2 px (focus ring, selected emphasis) |
| `border.width.thick` | 4 px (left-border timeline accent) |
| `border.style.solid` | solid |
| `border.style.dashed` | dashed (dotted CI graph "weak relation") |

## Otvorené závislosti

- `[06-tech-stack-selector]` Po finálnej voľbe stacku potrebujeme overiť,
  že variabilný font Inter sa dá selfhostovať bez CDN call (on-prem deploy,
  GOAL §5 "Performance"). Predpoklad: áno (Inter má vlastný self-host build).
- `[06-tech-stack-selector]` CSS strategy — či pôjdeme do CSS Custom Properties
  + plain CSS modules, alebo cez Vanilla Extract / Stitches s typed tokens.
  Tokeny sú framework-agnostic, ale tooling sa líši.
- `[08-devex-devops]` Self-host Inter Variable + JetBrains Mono z
  `packages/design-system/fonts/`. Subset SK + EN + symboly. Latency budget?
- `[09-qa-test-strategy]` Visual regression baseline — ktoré tokeny sú
  "load-bearing" (zmena lámu screenshot diff). Návrh: všetky `color.*`
  a `spacing.4`, `spacing.6`, `radius.md`.
