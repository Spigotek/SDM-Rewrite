# Library Recommendation — Custom vs. nadstavba

## Changelog (round 2)

- 06 r2 potvrdilo všetky odporúčania (React 19 + Radix UI primitives + TanStack
  Table v8 + TipTap 2 + Lucide React + Inter Variable + JetBrains Mono + RHF +
  Zod + react-i18next + ICU). Headless + custom skin **je canonical voľba**,
  framework-agnostic alternatívy (Vue / Angular) zostávajú v dokumente ako
  rezerva, **ale nie sú actionable** — nemodifikuj implementáciu na ich základe.
- 06 r2 potvrdilo **Cytoscape canvas mode** pre `RelationshipGraph` (NIE React
  Flow). r1 default "React Flow pre MVP" je prepísaný — Cytoscape priamo do v1.
- 06 r2 potvrdilo **FullCalendar 6** pre `Calendar` (NIE react-big-calendar).
  r1 "MVP: react-big-calendar" je prepísaný — FullCalendar priamo, lazy-loaded.
- 06 r2 potvrdilo **react-markdown + remark-gfm + rehype-sanitize** pre KB read
  rendering (nie ručná implementácia s DOMPurify). Pre `Markdown` komponent
  v `components.md` to znamená: sanitization sa rieši cez rehype-sanitize
  preset (allowlist tags + attributes), DOMPurify nie je core dependency.
- Uzavreté flagy `[06-tech-stack-selector]` → `[resolved-in-round-2]`.

## TL;DR — odporúčanie (canonical po r2)

**Stredná cesta — headless primitives + custom skin nad našimi tokenmi.**

Confirmed **React stack** (06 r2 final):

- **Radix UI Primitives** + selektívne **React Aria** (date picker, complex combobox).
- **TanStack Table v8** (basic mode, žiadna virtualizácia — GOAL §5 desiatky riadkov).
- **TipTap 2** (extensions: StarterKit, Link, Image, CodeBlockLowlight, Mention, TaskList).
- **Cytoscape 3** + `react-cytoscapejs` (canvas mode, cose-bilkent layout).
- **FullCalendar 6** + dayGrid + timeGrid (lazy-loaded).
- **Lucide React** (icon system).
- **Inter Variable** + **JetBrains Mono Variable** (self-hosted, no CDN — viď §
  Otvorené závislosti `[08-devex-devops]`).
- **react-markdown 9** + `remark-gfm` + `rehype-sanitize` (KB read, comments).
- **dnd-kit** (`FileUpload`, calendar drag-resize v1+).

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
  modules, Vanilla Extract, Stitches, Emotion. 06 r2 zvolilo **CSS Custom
  Properties + CSS Modules** ([`tech-stack-selector/decision.md`](../tech-stack-selector/decision.md)
  riadok "Styling").

→ **Final pick (r2 canonical): Headless primitives + custom skin nad CSS Custom Properties.**

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

## Canonical stack (React) — po r2

### Foundation

| Knižnica | Verzia (06 r2 fix) | Účel | Kde sa použije |
|---|---|---|---|
| **React** | 19.x stable | UI framework | obe apps |
| **TypeScript** | 5.x strict | Type safety | obe apps |
| **Vite** | 5.x (resp. 6.x LTS) | Bundler / dev server | obe apps |
| **Radix UI Primitives** | latest | Headless ARIA-correct primitives | Modal, Dropdown, Tabs, Tooltip, Popover, Accordion, Toggle, Switch, Checkbox, RadioGroup, ContextMenu, AlertDialog, ToggleGroup, NavigationMenu |
| **React Aria** | 3.x (selektívne) | Doplnkové (kde Radix chýba) | DateRangePicker, NumberField, ColorPicker (v1+) |
| **TanStack Table** | v8 | Tabuľková logika (sort, filter, column config) | `DataTable`, `QueueTable`, KB list, CMDB browse |
| **TanStack Query** | v5 | Server state cache, tenant-scoped queryKey | obe apps |
| **TipTap** | 2.x | WYSIWYG editor | `KbEditor`, ticket composer (extensions: StarterKit, Link, Image, CodeBlockLowlight, Mention, TaskList) |
| **react-markdown** | 9.x | KB read render, comment render | `Markdown` komponent — `remark-gfm` + `rehype-sanitize` allowlist |
| **dnd-kit** | 6.x | Drag-and-drop primitives | `FileUpload` drag-drop, calendar drag-resize (v1+) |
| **Lucide React** | latest | Icon system | `Icon`, all icon usages |
| **date-fns** | 3.x | Date utilities, i18n format | Time-relative, calendar |
| **react-hotkeys-hook** | latest | Keyboard shortcuts | Queue shortcuts, command palette, ticket detail shortcuts |
| **focus-trap-react** | (Radix má vlastný — preferred) | Modal focus trap | iba ak Radix Dialog/Popover nestačí |

### Self-hosted assets

- **Inter Variable + JetBrains Mono Variable** — self-hosted via
  `packages/design-system/fonts/` (no CDN call — on-prem deploy reasons,
  viď §Otvorené závislosti `[08-devex-devops]`).
- **CSS Custom Properties** — theming layer, framework-agnostic.

### Per-feature canonical voľby (06 r2 fix)

#### Graph visualization (`RelationshipGraph` / `CMDBGraph`)

CMDB CI detail relationships — pan, zoom, node selection, auto-cluster.

| Library | r1 verdict | r2 verdict |
|---|---|---|
| **Cytoscape.js** | "v1+ ak feature parity" | **r2 final: priamo v MVP** (canvas mode, cose-bilkent layout, 100+ nodes OK) |
| **React Flow** | "Default pre MVP" | **r2: zrušené** — Cytoscape vyhráva kvôli scale (CMDB má rádovo stovky nodes per tenant, R-011) |
| vis.js / D3 | Pass | Pass |

→ **Cytoscape 3.x + `react-cytoscapejs@2.x`**, lazy-loaded na route
`/cmdb/ci/:id` tab Relationships (heavy chunk ~110 kB).

#### WYSIWYG editor (`KbEditor`)

| Library | r2 verdict |
|---|---|
| **TipTap 2.x** | **r2 final: confirmed** — ProseMirror wrapper, modular extensions, R-010 vlastnená |
| Lexical / Slate / Quill | Pass (per r1 analýza, žiadna zmena) |

Extensions canonical: `@tiptap/starter-kit`, `@tiptap/extension-link`,
`@tiptap/extension-image`, `@tiptap/extension-code-block-lowlight`,
`@tiptap/extension-mention` (pre `#` record autocomplete),
`@tiptap/extension-task-list`. Lazy-loaded na `/kb/editor` route only.

#### Calendar (`Calendar` for changes)

| Library | r1 verdict | r2 verdict |
|---|---|---|
| **FullCalendar 6** | "v1 ak drag-resize required" | **r2 final: priamo v MVP** — pluginy `@fullcalendar/daygrid` + `@fullcalendar/timegrid` + `@fullcalendar/interaction` (drag-resize), MIT open-source build (Scheduler plugin **nepoužívame**, komerčný) |
| react-big-calendar | "MVP read-only" | **r2: zrušené** |

→ **FullCalendar 6**, lazy-loaded na `/changes/calendar` (~95 kB chunk).

#### Forms (`Form`, `DynamicForm`)

| Library | r2 verdict |
|---|---|
| **React Hook Form 7.x** | **r2 final: confirmed** — uncontrolled-first, vysoký perf pre 15+ fields v Service Catalog |
| **Zod 3.x** + `@hookform/resolvers@3.x/zod` | **r2 final: confirmed** — schéma sharable s BFF, runtime type guards |
| Formik / TanStack Form / Final Form | Pass |

Dynamic form (Service Catalog) → schema-driven render off Zod schema cez
`buildZodSchema(fields)` registry (per
[`tech-stack-selector/libraries.md`](../tech-stack-selector/libraries.md) §3).

#### Markdown rendering (`Markdown`)

KB read + comment body (read-only render of user/editor content). **NIE
KbEditor** (TipTap je editor, Markdown komponent je read-side render).

| Library | r2 verdict |
|---|---|
| **react-markdown 9.x** + **remark-gfm** + **rehype-sanitize** | **r2 final: confirmed** — bezpečný markdown render bez `dangerouslySetInnerHTML`. Allowlist tagov per [`security/owasp-mitigations.md`](../security/owasp-mitigations.md) §Markdown sanitizer whitelist |
| DOMPurify | **Sekundárne** — len ak by sme niekedy renderovali HTML priamo (mimo react-markdown pipeline). `rehype-sanitize` postačuje pre allowlisted markdown |
| markdown-it / marked | Pass — react-markdown integruje s React lifecycle natívne |

Detail kontraktu sanitization viď `<Markdown>` komponent v
[`components.md`](./components.md).

#### State management

Per 06 r2: **React Context + useReducer** pre app-wide minimal state (active
tenant, theme, density, notifications). **TanStack Query** pre server cache.
**Žiadny Redux / Zustand** (KISS principle).

#### Routing

Per 06 r2: **React Router 6** (data router API) — loaders / actions,
nested layouts pre 3-pane workspace ticket detail. Code-splitting per route
cez `React.lazy()`.

#### i18n

Per 06 r2: **react-i18next 15.x + i18next 23.x + i18next-icu** — ICU
MessageFormat pre SK 3-form plurals (`Intl.PluralRules` fallback).
Lazy-loaded locale JSON-y per route.

## Framework-agnostic fallback (NOT actionable po r2)

> **Pozn. r2**: Tieto sekcie zostávajú pre dokumentačný kontext —
> ak by sa niekedy v budúcnosti rozhodlo migrovať na Vue / Angular,
> mapping by sa znovu otvoril. Pre MVP a v1 sú **mŕtve** voľby.

### Vue 3 scenario (NOT actionable)

| Komponent | React lib (canonical) | Vue ekvivalent (rezerva) |
|---|---|---|
| Headless primitives | Radix | Headless UI Vue / Reka UI (Radix-Vue) |
| Tables | TanStack Table | TanStack Table (framework-agnostic) |
| Editor | TipTap | TipTap Vue 3 bindings |
| Forms | React Hook Form | VeeValidate + `@vee-validate/zod` |
| Icons | Lucide React | Lucide Vue Next |

Tokens + theming layer ostáva identický.

### Angular scenario (NOT actionable)

| Komponent | React lib (canonical) | Angular ekvivalent (rezerva) |
|---|---|---|
| Headless primitives | Radix | Angular CDK (Overlay, Portal, A11y, FocusTrap) |
| Components | Custom skin | Angular Material (heavy theme override) |
| Tables | TanStack Table | TanStack Table (Angular adapter) |
| Editor | TipTap | TipTap (Angular wrapping via web components) |
| Forms | React Hook Form | Reactive Forms (native) |
| Icons | Lucide React | Lucide Angular |

**Angular caveat.** Angular Material je ťažký override toho štýlu — re-evaluate
by sa robil v alternatívnej runde. Pre r2 už nie je v scope.

## Bundle size estimate (React stack — r2 canonical)

| Layer | Gzipped |
|---|---|
| React 19 + ReactDOM | 44 kB |
| React Router 6 (data router) | 14 kB |
| TanStack Query v5 | 14 kB |
| TanStack Table v8 (basic) | 14 kB |
| RHF + Zod + resolvers | 26 kB |
| react-i18next + i18next + ICU | 25 kB |
| Radix UI primitives (per route, tree-shaken) | 15–35 kB |
| Lucide React (tree-shaken per used icon) | 5–10 kB |
| date-fns (tree-shaken) | 3–8 kB |
| react-markdown + remark-gfm + rehype-sanitize | 15 kB |
| Inter Variable + JetBrains Mono Variable subset | 35–45 kB (woff2, latin-ext) |
| Tokens + components custom code | 20–30 kB |
| Sentry React (async / lazy) | ~0 kB (lazy chunk) |
| **Portal first paint (no editor, no table, no graph, no calendar)** | **~ 200 kB gzipped** |
| Workspace first paint (queue + tokens) | ~ 230 kB gzipped |
| Workspace + KB editor (TipTap lazy chunk) | + 70 kB |
| Workspace + Calendar (FullCalendar lazy chunk) | + 95 kB |
| Workspace + Cytoscape graph (lazy chunk) | + 110 kB |

GOAL §5 cieľ "TTI < 2 s na typickej linke" — splnené pri 200 kB initial + HTTP/2
+ Service Worker prefetch + lazy heavy chunks. Validuje **08 DevOps** v Lighthouse
budgets ([`devex-devops/repo-bootstrap.md`](../devex-devops/repo-bootstrap.md)).

## Adoption strategy

### Phase 1 — Foundation (MVP start)

- Install Radix UI Primitives + Lucide + Inter/JetBrains Mono.
- Implement `Button`, `IconButton`, `TextField`, `TextArea`, `Select`,
  `Checkbox`, `Radio`, `Card`, `Modal`, `Toast`, `Badge`, `StatusBadge`,
  `Tabs`, `Tooltip`, `FormField`.
- Implement `AppShell`, `TopBar`, `TenantSwitcher`.
- Implement `DataTable` / `QueueTable` na top TanStack Table v8.
- Implement `Can` permission wrapper (kontrakt v [`components.md`](./components.md)).
- Implement `Markdown` read komponent (react-markdown + rehype-sanitize).
- Vytvoriť **Storybook** s týmto setom (povinné per 08 DevOps + 09 QA).

### Phase 2 — Workspace specifics

- `Composer`, `Timeline`, `CommentItem`, `ActionBar`, `FilterBar`,
  `QueueSidebar`, `ContextPanel`, `BulkActionBar`.
- `CommandPalette` (Cmd+K).

### Phase 3 — Portal specifics + KB read

- `ServiceCatalogTile`, `ServiceCatalogItem`, `ServiceCatalogRenderer`
  (JSON-schema dynamic form).
- `HelpfulnessVote`.

### Phase 4 — Heavy lazy chunks (v1)

- `KbEditor` (TipTap 2) — lazy load route `/kb/editor`.
- `Calendar` (FullCalendar 6) — lazy load route `/changes/calendar`.
- `RelationshipGraph` / `CMDBGraph` (Cytoscape 3) — lazy load route
  `/cmdb/ci/:id` tab Relationships.

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

- `[06-tech-stack-selector]` Finálny framework rozhoduje cestu — **[resolved-in-round-2]**
  React 19 confirmed; Vue / Angular fallback je dokumentačný, nie actionable.
- `[06-tech-stack-selector]` CSS strategy — **[resolved-in-round-2]** CSS Custom
  Properties + CSS Modules confirmed (06 `decision.md` "Styling" riadok).
- `[06-tech-stack-selector]` Validačná schéma — **[resolved-in-round-2]** Zod 3.x +
  `@hookform/resolvers/zod` confirmed.
- `[06-tech-stack-selector]` Graph viz library — **[resolved-in-round-2]** Cytoscape 3
  confirmed (NIE React Flow).
- `[06-tech-stack-selector]` WYSIWYG library — **[resolved-in-round-2]** TipTap 2 confirmed.
- `[06-tech-stack-selector]` Calendar library — **[resolved-in-round-2]** FullCalendar 6
  confirmed (NIE react-big-calendar).
- `[06-tech-stack-selector]` Markdown sanitizer — **[resolved-in-round-2]**
  react-markdown + remark-gfm + rehype-sanitize confirmed.
- `[06-tech-stack-selector]` i18n library — **[resolved-in-round-2]** react-i18next 15 +
  i18next-icu confirmed.
- `[04-architecture]` Routing knižnica — **[resolved-in-round-2]** React Router 6
  (data router) confirmed (per 06 r2 + 04 portal.md/workspace.md routing sekcie).
- `[04-architecture]` Service Worker pre prefetch + offline draft auto-save —
  **pretrváva** (DevOps Phase C — Vite PWA plugin candidate).
- `[08-devex-devops]` Storybook hosting (Chromatic alebo internal GitHub
  Pages) — **pretrváva** alignment s monorepo CI.
- `[08-devex-devops]` Self-host Inter + JetBrains Mono fonts subset SK+EN
  z `packages/design-system/fonts/` (no CDN per on-prem) — **pretrváva**
  (DevOps detail v Phase C).
- `[09-qa-test-strategy]` Visual regression tooling consensus — **pretrváva**
  (axe-core v CI + visual regression baseline).
