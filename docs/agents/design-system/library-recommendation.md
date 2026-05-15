# Library Recommendation — Custom vs. nadstavba

> **Otázka.** Postavíme design system **úplne na zelenom** (custom React/Vue/Angular
> komponenty), **adoptujeme full library** (MUI / Mantine / Chakra) alebo
> ideme **strednou cestou** (headless primitives + custom skin)?
>
> Tech Stack Selector (06) beží paralelne — finálny framework nie je istý.
> Tento dokument poskytuje **odporúčanie podmienené frameworkom**, s default
> scenárom pre **React** (najpravdepodobnejší výber per GOAL §6 + UX analýza).

## TL;DR — odporúčanie

**Stredná cesta — headless primitives + custom skin nad našimi tokenmi.**

- Pre **React** stack: **Radix UI Primitives** + **TanStack Table** + **TipTap**
  + **Lucide React** + **Inter Variable** + **JetBrains Mono** + **dnd-kit**
  + **React Aria** (sekundárne pre špecifické a11y kompozity).
- Pre **Vue** stack: **Headless UI Vue** + **TanStack Table** + **TipTap** +
  **Lucide Vue Next**.
- Pre **Angular** stack: **Angular CDK** + **Angular Material** (selektívne)
  + **TanStack Table** + **TipTap**.

Žiadnu z týchto knižníc neadoptujeme ako "skin done" — vždy ich oblečieme do
našich tokenov. Cieľ: **vlastný look-and-feel** (per GOAL §11 branding mandát),
ale **nemusíme znovu objaviť WAI-ARIA**.

## Decision matrix

Hodnotené 4 ortogonálne kritériá. Hodnotenie 1–5 (5 = najlepšie).

| Kritérium | Custom from scratch | Full library (MUI / Mantine) | Headless + custom skin | Tailwind UI / shadcn |
|---|---|---|---|---|
| **Branding flexibility** | 5 | 2 | 5 | 4 |
| **A11y out-of-box** | 1 | 4 | 5 | 4 |
| **Time-to-market** | 1 | 5 | 3 | 4 |
| **Bundle size** | 5 | 2 | 4 | 5 |
| **Long-term maintenance** | 1 | 3 | 4 | 4 |
| **Tooling & DX** | 2 | 5 | 4 | 4 |
| **i18n SK + EN** | 5 (own) | 3 (override) | 5 (own) | 5 |
| **Total** | 20 | 24 | 30 | 30 |

Headless + custom skin a Tailwind UI sú tied. Decision faktor:

- **Tailwind UI / shadcn** vyžaduje **Tailwind CSS** ako runtime dependency.
  Conflict s requirementom "CSS Custom Properties" theming model
  ([`theming.md`](./theming.md)). Možné, ale Tailwind theming je dual-track
  (config-time variables + runtime CSS vars) — added complexity.
- **Headless + custom skin** je **CSS-strategy-agnostic** — funguje s plain CSS
  modules, Vanilla Extract, Stitches, Emotion. Tech Stack Selector (06) má
  voľnú ruku.

→ **Final pick: Headless primitives + custom skin.**

## Why nie full library (MUI / Mantine)

MUI / Mantine sú technicky pripravené, ale:

| Problém | Detail |
|---|---|
| **Branding lock-in** | Override systému (sx prop / theme.unstable_sx) je sila, ale visible distinctiveness MUI / Mantine je hard to shake off. Linear ne-MUI vzhľad chceme dosiahnuť. |
| **Bundle size** | MUI base bundle ~ 80–120 kB gzipped (after tree-shake). Lucia z mobile chce sub-50 kB initial. |
| **Component naming locked** | `<TextField>` z MUI má signatúru, ktorú nemôžeme zmeniť bez wrapping. Wrapping = double maintenance. |
| **Slot system** | MUI v5 slots sú dobrá, ale 7 wireframov má custom kompozity (composer, action bar, queue split view) — buď tak MUI tak naše abstrakcie, alebo len my. |
| **Inktermitentne maintained** | Mantine v6 → v7 migrácia (2024) bola painful (breaking changes). Stabilita > novosť pre SDM. |

**Use case kde by sme MUI / Mantine mohli zvážiť**:

- Časový tlak v MVP enormous + tým nemá UI lead — full library akceleruje delivery.
  GOAL hovorí MVP bez tlaku, takže neplatí.
- Nepotrebujeme custom branding — tu opak (GOAL §11).

## Headless primitives — konkrétny stack (React default scenario)

### Foundation

| Knižnica | Verzia (target) | Účel | Kde sa použije |
|---|---|---|---|
| **React** | 18.x stable | UI framework | obe apps (predpokl.) |
| **Radix UI Primitives** | 2.x | Headless ARIA-correct primitives | Modal, Dropdown, Tabs, Tooltip, Popover, Accordion, Toggle, Switch, Checkbox, RadioGroup, ContextMenu, AlertDialog, ToggleGroup, NavigationMenu |
| **React Aria** | 3.x | Doplnkové (kde Radix chýba) | DateRangePicker, NumberField, ColorPicker (v1+) |
| **TanStack Table** | v8 | Tabuľková logika (sort, filter, column config) | `DataTable` queue, KB list, CMDB browse |
| **TipTap** | 2.x | WYSIWYG editor | `KbEditor`, ticket composer (s rich content extensions: link, image, code block, mention) |
| **dnd-kit** | 6.x | Drag-and-drop primitives | `FileUpload` drag-drop, calendar drag-resize (v1+) |
| **Lucide React** | latest | Icon system | `Icon`, all icon usages |
| **date-fns** | 3.x | Date utilities, i18n format | Time-relative, calendar |
| **react-hotkeys-hook** | latest | Keyboard shortcuts | Queue shortcuts, command palette, ticket detail shortcuts |
| **focus-trap-react** | latest | Modal focus trap | `Modal`, `Drawer` (Radix má vlastný — preferred) |

### Stack-agnostic libs (akýkoľvek framework)

- **Inter Variable + JetBrains Mono** — self-hosted via `packages/design-system/fonts/`
  (no CDN call — on-prem deploy reasons, viď [`tokens.md`](./tokens.md) Otvorené závislosti).
- **CSS Custom Properties** — theming layer, framework-agnostic.

### Per-feature library decisions

#### Graph visualization (`RelationshipGraph`)

CMDB CI detail relationships — pan, zoom, node selection, auto-cluster.
Candidate evaluation:

| Library | Pros | Cons | Verdict |
|---|---|---|---|
| **React Flow** | Best DX, dobré dokumentácie, perf OK na ~200 nodes | MIT pre v11, license-change risk; medium bundle | Default pre MVP |
| **Cytoscape.js** | Battle-tested (CMDB tools default), big graphs OK | Large bundle, jQuery-ish API, custom React wrapping | Pre v1+ ak Cytoscape feature parity |
| **vis.js (vis-network)** | Mature, low effort | Older API, bigger bundle, harder a11y customization | Pass |
| **D3 force-graph (custom)** | Full control | Long lead time, harder a11y | Pass |

→ **MVP: React Flow.** v1+ re-evaluate ak potrebujeme > 200 nodes.

#### WYSIWYG editor (`KbEditor`)

KB editor wireframe `[06-tech-stack-selector]` flag.

| Library | Pros | Cons | Verdict |
|---|---|---|---|
| **TipTap (ProseMirror)** | Modern API, React bindings, rich extensions, markdown bidirectional | Medium bundle, learning curve | **Default pick** |
| **Lexical (Meta)** | Facebook-backed, novel arch | Newer, ecosystem smaller, RT collab not first-class | Pass for now |
| **Slate** | Heavily customizable | More dev effort to match TipTap features | Pass |
| **Quill** | Old, simple | Less actively maintained, harder to extend | Pass |

→ **TipTap** s extensions: `@tiptap/extension-link`, `@tiptap/extension-image`,
`@tiptap/extension-code-block-lowlight`, `@tiptap/extension-mention` (pre `#`
record autocomplete), `@tiptap/extension-task-list`.

#### Calendar (`Calendar` for changes)

| Library | Pros | Cons | Verdict |
|---|---|---|---|
| **FullCalendar** | Battle-tested, all view modes, drag-resize | Big bundle, MIT pre core, premium plugin licensing | Default if drag-resize required at v1 |
| **react-big-calendar** | Lightweight, simple | Less polished, smaller community | Pre MVP read-only |
| **Custom CSS Grid** | Full control, small bundle | Implementation cost, no drag-resize out of box | Only ak MVP scope minimal |

→ **MVP: react-big-calendar** (read view + click event). **v1: FullCalendar**
ak drag-resize required.

#### Forms (`Form`, `DynamicForm`)

| Library | Pros | Cons | Verdict |
|---|---|---|---|
| **React Hook Form** | Lean, performant, uncontrolled-first | Schema-based validation needs adapter | **Default pick** |
| **Formik** | Mature, declarative | Slower, more re-renders, less active | Pass |
| **TanStack Form** | Same family as Table, type-safe | Newer, smaller ecosystem | Re-evaluate v2 |

Schema validation: **Zod** (paired with React Hook Form resolver).
Dynamic form (Service Catalog) → schema-driven render off Zod schema.

#### State management

Per GOAL §10 + Tech Stack — wait for 06 decision. Predpokladané: **Zustand**
pre app-wide minimal state (active tenant, theme, density, notifications),
**React Query / TanStack Query** pre server cache. Žiadny Redux.

#### Routing

Per 04 architecture. React: **React Router 6** alebo **TanStack Router**.

#### i18n

| Library | Pros | Cons | Verdict |
|---|---|---|---|
| **i18next + react-i18next** | Battle-tested, ICU support, plural rules, broad ecosystem | Bundle medium | **Default pick** |
| **react-intl (FormatJS)** | ICU native, official Unicode CLDR | Larger learning curve | Acceptable alternative |
| **Lingui** | Smaller bundle, JSX-friendly | Smaller ecosystem | Re-evaluate later |

→ **i18next** s `i18next-icu` plugin pre SK 3-plural form support.

## Per-framework fallback (ak 06 zvolí non-React)

### Vue 3 scenario

| Komponent | React lib | Vue lib |
|---|---|---|
| Headless primitives | Radix | Headless UI Vue / Reka UI (Radix-Vue) |
| Tables | TanStack Table | TanStack Table (framework-agnostic — Vue 3 bindings) |
| Editor | TipTap | TipTap Vue 3 bindings |
| Forms | React Hook Form | VeeValidate alebo @vee-validate/zod |
| State | Zustand + TanStack Query | Pinia + TanStack Query Vue |
| Icons | Lucide React | Lucide Vue Next |

Tokens + theming layer ostáva identický.

### Angular scenario

| Komponent | React lib | Angular lib |
|---|---|---|
| Headless primitives | Radix | Angular CDK (Overlay, Portal, A11y, FocusTrap) |
| Components | Custom skin | Angular Material (selectively — Table, Dialog, FormField) **s heavy theme override** |
| Tables | TanStack Table | TanStack Table (Angular adapter) |
| Editor | TipTap | TipTap (Angular wrapping via web components, less mature) |
| Forms | React Hook Form | Reactive Forms (native) |
| State | Zustand | Signals (Angular 16+) + Akita / NgRx ak veľa state |
| Icons | Lucide React | Lucide Angular |

**Angular caveat.** Angular Material je **ťažký** override toho štýlu, môže
sa stať že lepšie ide custom DS bez Material. To re-evaluate keď 06 finalizuje.

## Bundle size estimate (React stack)

| Layer | Gzipped |
|---|---|
| React + React DOM | 45 kB |
| Radix UI (per route, tree-shaken) | 15–25 kB |
| TanStack Table (queue only) | 8 kB |
| TipTap base (KB editor only) | 30 kB (lazy load via route splitting) |
| Lucide React (tree-shaken per used icon) | 5–10 kB |
| date-fns (tree-shaken) | 3–8 kB |
| Inter Variable + JetBrains Mono subset | 35–45 kB (woff2, latin-ext) |
| Tokens + components custom code | 20–30 kB |
| **Portal first paint (no editor, no table)** | **~ 130 kB gzipped** |
| Workspace first paint (queue + tokens) | ~ 160 kB gzipped |
| Workspace + KB editor (lazy) | ~ 190 kB gzipped |

GOAL §5 cieľ "TTI < 2 s na typickej linke" — splnené pri 130 kB initial + HTTP/2
+ Service Worker prefetch. Validuje **08 DevOps** v Lighthouse budgets.

## Adoption strategy

### Phase 1 — Foundation (MVP start)

- Install Radix UI Primitives + Lucide + Inter/JetBrains Mono.
- Implement `Button`, `IconButton`, `TextField`, `TextArea`, `Select`,
  `Checkbox`, `Radio`, `Card`, `Modal`, `Toast`, `Badge`, `StatusBadge`,
  `Tabs`, `Tooltip`, `FormField`.
- Implement `AppShell`, `TopBar`, `TenantSwitcher`.
- Implement `DataTable` na top TanStack Table.
- Vytvoriť **Storybook** s týmto setom (povinné per 08 DevOps + 09 QA).

### Phase 2 — Workspace specifics

- `Composer`, `Timeline`, `CommentItem`, `ActionBar`, `FilterBar`,
  `QueueSidebar`, `ContextPanel`, `BulkActionBar`.
- `CommandPalette` (Cmd+K).

### Phase 3 — Portal specifics + KB read

- `ServiceCatalogTile`, `ServiceCatalogItem`, `DynamicForm`.
- `MarkdownRenderer`, `CodeBlock`, `HelpfulnessVote`.

### Phase 4 — Heavy lazy chunks (v1)

- `KbEditor` (TipTap) — lazy load route `/kb/editor`.
- `Calendar` (react-big-calendar / FullCalendar) — lazy load route `/changes/calendar`.
- `RelationshipGraph` (React Flow) — lazy load route `/cmdb/ci/:id` tab Relationships.

## Validácia — Storybook + axe + visual regression

Každý komponent musí mať Storybook stories pred merge:

- **Default** state.
- **All variants** (primary / secondary / ...).
- **All sizes** kde aplikovateľné.
- **Disabled, loading, error** states.
- **Light + dark + hc** theme matrix.
- **a11y addon** — axe runs na každú story, no critical violations.

**Visual regression** — Chromatic alebo Playwright snapshots. Baseline per theme.

## Otvorené závislosti

- `[06-tech-stack-selector]` Finálny framework rozhoduje cestu (React /
  Vue / Angular). Tento dokument poskytuje default React + fallback Vue +
  caveat Angular.
- `[06-tech-stack-selector]` CSS strategy — či CSS Custom Properties + plain
  CSS modules, alebo Vanilla Extract / Stitches s typed tokens. Headless
  knižnice fungujú so všetkými.
- `[06-tech-stack-selector]` Validačná schéma (Zod / Yup / Valibot) per
  framework + form library.
- `[04-architecture]` Routing knižnica (React Router 6 vs. TanStack Router
  vs. Vue Router) — vplyv na code-splitting jednotky pre Calendar / KbEditor
  / RelationshipGraph lazy chunks.
- `[04-architecture]` Service Worker pre prefetch + offline draft auto-save —
  rozhoduje sa v Architecture (či Vite PWA plugin alebo manual).
- `[08-devex-devops]` Storybook hosting (Chromatic alebo internal GitHub
  Pages) — alignment s monorepo CI.
- `[08-devex-devops]` Self-host Inter + JetBrains Mono fonts subset SK+EN
  z `packages/design-system/fonts/` (no CDN per on-prem).
- `[09-qa-test-strategy]` Visual regression tooling consensus.
