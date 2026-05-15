# Komponentový inventory v1 — SDM-Rewrite Design System

## Changelog (round 2)

- Doplnené komponenty po 04 component-diagram aligning (`QueueTable` alias k
  `DataTable.density=compact`, `ServiceCatalogRenderer` ako JSON-schema dynamic
  form pre Service Catalog, `CMDBGraph` ako CMDB-specifický alias k
  `RelationshipGraph`).
- Pridaný **`Can`** permission wrapper komponent (rieši `[05-security]` flag pre
  RBAC UI gating) — kontrakt mapovaný na permission keys z
  [`security/rbac.md`](../security/rbac.md) §6.
- Pridaný **`Markdown`** read komponent (react-markdown + remark-gfm +
  rehype-sanitize, allowlist tagov per
  [`security/owasp-mitigations.md`](../security/owasp-mitigations.md))
  — rieši `[05-security]` markdown rendering contract.
- `RelationshipGraph` aktualizovaný: 06 r2 zvolilo **Cytoscape 3** canvas mode
  (NIE React Flow). r1 zmienka o React Flow odstránená.
- `Calendar` doplnený: 06 r2 zvolilo **FullCalendar 6** priamo v MVP (NIE
  react-big-calendar).
- `KbEditor` doplnený: 06 r2 confirmed **TipTap 2** s konkrétnymi extensions.

> Inventory komponentov odvodený z UX wireframov
> (`docs/agents/ux-persona-analyst/wireframes/`) a screen-inventory.
> Každý komponent: účel, varianty, props (vysoká úroveň, nie TS signatúra),
> a11y poznámky, density mapovanie, tokeny.
>
> **Nedefinujem runtime kód** — len kontrakt. Implementácia rozhodne
> Tech Stack agent (06) a Architecture (04).
>
> **Naming**: každý komponent má `data-component` atribút rovný jeho názvu
> v `kebab-case` (`button`, `data-table`, `status-badge`) — pomáha e2e testom
> a debug snapshotu.
>
> **Density**: každý komponent ktorý existuje v portál aj workspace má
> mať buď `density="compact" | "default" | "comfortable"` prop, alebo
> dvojicu variantov. Default = `comfortable` v portáli, `compact` v workspace.

# Komponenty (P0/P1)

## Button

**Účel.** Spustí akciu. Primárna interakcia v action bar (Save, Submit,
Approve, Reject, Take, Escalate).

**Varianty.**

| Variant | Použitie | Background | Border | Text |
|---|---|---|---|---|
| `primary` | Hlavná akcia per obrazovka (Submit ticket, Save & Send, Approve) | `color.brand.bg` | none | `color.text.inverse` |
| `secondary` | Sekundárna akcia (Cancel, Save draft, Reset filters) | `color.background.surface` | `color.border.default` | `color.text.body` |
| `tertiary` / `ghost` | Inline akcia, ikon-only button v rade | transparent | none | `color.text.body` |
| `destructive` | Reject, Delete, Archive | `color.danger.solid` | none | `color.text.inverse` |
| `success` | Approve change (rare; obvykle používame primary) | `color.success.solid` | none | `color.text.inverse` |

**Sizes (mapuje sa na density).**

| Size | Min-height | Padding | Font |
|---|---|---|---|
| `xs` | 24 px | `spacing.1 spacing.2` | `font.size.xs` |
| `sm` | 28 px | `spacing.1_5 spacing.3` | `font.size.sm` |
| `md` | 36 px | `spacing.2 spacing.4` | `font.size.base` |
| `lg` | 44 px | `spacing.3 spacing.5` | `font.size.md` |

**Props (high-level).**

- `variant` (required)
- `size` (default: `md`)
- `leadingIcon` / `trailingIcon`
- `loading` (boolean — disable + spinner, `aria-busy`)
- `disabled`
- `fullWidth`
- `as` ("button" | "a" | "link") — keď je to navigation, render `<a>`

**A11y.**

- Native `<button type="button">` (alebo `<a>` ak `as="link"`).
- `aria-disabled` pri `disabled`, `aria-busy` pri `loading`.
- Focus ring: `shadow.focus.brand` (alebo `.danger` pre destructive).
- Min target ≥ 44 × 44 px na mobile (WCAG 2.5.5 AAA; aspoň 24 × 24 pre AA).
- Loading button nesmie zmeniť šírku (rezerva spinneru predpočítaná).

## IconButton

Square button — iba ikona + `aria-label`.

**Sizes**: `xs` (20 px), `sm` (28 px), `md` (36 px), `lg` (44 px — mobile-safe).

**Použitie.** Toolbar actions (KB editor formatting), close (`✕`), more (`⋮`),
copy-to-clipboard.

**A11y.** `aria-label` je **povinný** (nie tooltip-only). Tooltip cez
`Tooltip` komponent je doplnok, nie náhrada.

## Link

**Účel.** Inline hyperlink, in-app navigácia, ticket / KB / CI references
v texte.

**Varianty.** `default` (brand color), `subtle` (text body color, underline
on hover), `inline-code` (link wrapping code-formatted ref).

**A11y.** `<a href>` (nie `<button>`). `:focus-visible` ring. Differentation
not by color alone — `text-decoration: underline` pri všetkých link variantoch
v texte (WCAG 1.4.1).

## Icon

**Účel.** Wrapper nad icon system. Predpoklad: **Lucide** (open-licensed,
moderne tvarované, dobre čitateľné v 14 px).

**Sizes**: `xs` (12), `sm` (16), `md` (20), `lg` (24).

**A11y.** Dekoratívna ikona `aria-hidden="true"`. Sémantická ikona
(samostatne stojaca) `role="img"` + `aria-label="..."`.

## Avatar

**Účel.** Reprezentuje používateľa (timeline, comment, assignee).

**Varianty.** `image` (foto), `initials` (fallback — 2 písmená), `system`
(robot ikona pre System events).

**Sizes**: `xs` (20), `sm` (24), `md` (32), `lg` (40).

**A11y.** `<img alt="Anna Kováčová">` pri image variante. Pri iniciálach
`role="img"` + `aria-label`.

## Badge

**Účel.** Krátka label info (priority, status, count, tag, language flag).
Pozri špecifické subvarianty `StatusBadge`, `PriorityBadge`, `TenantEnvBadge`.

**Varianty.**

| Variant | Background | Text | Border |
|---|---|---|---|
| `neutral` | `color.neutral.100` | `color.text.body` | `color.border.default` |
| `info` | `color.info.bg` | `color.info.fg` | `color.info.border` |
| `success` | `color.success.bg` | `color.success.fg` | `color.success.border` |
| `warning` | `color.warning.bg` | `color.warning.fg` | `color.warning.border` |
| `danger` | `color.danger.bg` | `color.danger.fg` | `color.danger.border` |
| `brand` | `color.brand.bg-subtle` | `color.brand.fg` | `color.brand.500` |

**Shapes**: `rounded` (default, `radius.sm`), `pill` (`radius.full`), `square` (`radius.xs`).

**Sizes**: `xs` (16 × 16, count badge na bell), `sm` (badge v table row), `md` (status badge v ticket header).

**A11y.** Pri použití len-farba (red dot pre priority) **musí byť sprevádzaný
textom alebo `aria-label`**. Príklad: `<Badge variant="danger" aria-label="Priority: Critical">🔴 Critical</Badge>`.

## StatusBadge

Špecializácia `Badge` — namapovaná na ticket status lifecycle podľa
`[03-domain-modeller]` (state machine per modul).

**Use case.** Ticket header, queue table row, dashboard list.

**Props.**

- `status` ("new" | "open" | "in_progress" | "hold" | "pending" | "resolved" | "closed" | "reopened")
- `module` ("incident" | "request" | "problem" | "change" | "kb") — určí mapping label-u

**A11y.** `aria-label` rozšírený o priateľský popis: napr. `"Status: V riešení, prevzala Anna pred 12 minútami"`.

## PriorityBadge

**Severity škála** z [tokens.md § 4](./tokens.md#priority--risk-semantic-mapping).
Vždy ikona + text label, nikdy len farba.

**Variants**: `critical`, `high`, `medium`, `low`, `none`.

## TenantEnvBadge

Vizuálne odlíšenie tenant prostredia (production / staging / dev / sandbox)
v tenant-switcher dropdown a v top bar pri "high-risk tenant".

**Color tokens** z `color.env.*`.

**A11y.** `aria-label="Production tenant — proceed with caution"` pri production.

## AppShell

**Účel.** Top-level layout container — fixuje top bar (header), optional
sidebar (workspace), main content area, optional right panel (workspace
ticket detail), notification drawer slot.

**Varianty.**

- `portal` — top bar + main column (centered, `layout.container.lg`),
  no sidebar, mobile-first.
- `workspace` — top bar + left sidebar (collapsible) + main + right panel
  (collapsible), full-width.

**Props.** `sidebar`, `rightPanel`, `banner` (slot — system message banner z `z.banner`).

**A11y.** Landmarks: `<header>`, `<nav>`, `<main>`, `<aside>` (right panel),
`<footer>` (mobile portal). Skip-link "Preskočiť na hlavný obsah".

## TopBar

**Účel.** Globálna lišta — logo, tenant switcher, primary nav (workspace),
language switcher, notifications bell, user menu.

**Slots.** `start` (logo + tenant), `center` (workspace navigation links), `end`
(language + notifications + user).

**Sticky.** `z.sticky`, position sticky top: 0.

**A11y.** `<header>` landmark, `role="banner"`. Logo `<a>` na home.
Aktívna nav položka `aria-current="page"`.

## NavMenu

**Účel.** Workspace primary nav — Queue · Incident · Problem · Change · KB · CMDB.

**Varianty.** `horizontal` (top bar), `vertical` (sidebar — collapsible).

**Props.** `items[]` (label, icon, route, badge?), `activeItem`, `orientation`.

**A11y.** `<nav role="navigation" aria-label="Hlavná navigácia">`. Klávesy
`Tab` cez items, `Enter` activate.

## TenantSwitcher

**Účel.** Wireframe `shared/tenant-switcher.md`. Dropdown s search, list of
tenants user has role in, current marker.

**Variants.**

- `compact` (top bar) — current tenant + caret
- `expanded` (dropdown) — search + list
- `single` (read-only — len 1 tenant) — display only, no caret

**Props.** `currentTenant` (id, name, env), `availableTenants[]`,
`hasPendingChanges` (boolean — confirm modal pri prepnutí), `onSwitch(tenantId)`.

**A11y.**

- `aria-haspopup="listbox"`, `aria-expanded`.
- Aktívny tenant `aria-current="true"`.
- Keyboard shortcut `T` documented v `?` overlay.
- Env badge `TenantEnvBadge` next to high-risk tenants.

## Breadcrumb

**Účel.** Hierarchia navigácie ("← Späť na catalog", "Catalog → Hardvér →
Externý disk").

**A11y.** `<nav aria-label="breadcrumb">`, `<ol>`, last item `aria-current="page"`.

## Tabs

**Účel.** Switch medzi viewmi (Timeline tabs All/Public/Internal, Change
detail tabs Detail/Impact/Rollback/Approvals, CMDB CI tabs).

**Varianty.** `default` (underline accent), `pill` (filled bg), `segmented`
(border around group — for calendar Day/Week/Month).

**Props.** `items[]` (label, key, count?, icon?), `activeKey`, `onActivate(key)`,
`density` (compact/default).

**A11y.** WAI-ARIA tabs pattern: `role="tablist"`, `role="tab"` s
`aria-selected`, `aria-controls`. Keyboard: `←/→` cycle through tabs,
`Home`/`End` jump.

## Accordion

**Účel.** Collapsible sekcie (CMDB attribute groups, KB editor settings
right panel).

**Props.** `items[]` (title, key, defaultOpen?, content), `multiple`
(boolean — viacero open naraz), `persistKey` (localStorage key pre per-user persistence).

**A11y.** Trigger button `aria-expanded`, `aria-controls`. Content
`role="region"` + `aria-labelledby`.

## TextField

**Účel.** Single-line text input.

**Varianty.** `text`, `email`, `password`, `number`, `search`, `tel`, `url`.

**States.** `default`, `focus`, `hover`, `disabled`, `read-only`, `error`,
`success`.

**Props (high-level).**

- `label` (povinný, môže byť `srOnly`)
- `helper` (helper text pod input)
- `error` (string — error message, prepne do error state)
- `leadingIcon` / `trailingIcon` / `trailingAddon` (button alebo content)
- `clearable` (✕ button)
- `density` (compact/default/comfortable)

**A11y.** `<label>` linked s `<input>` cez `for`. Helper a error spojené cez
`aria-describedby`. Error má `role="alert"`. `aria-invalid="true"` v error state.

## TextArea

**Účel.** Multi-line text (ticket description, comment, KB body fallback).

**Props.** Same as TextField + `rows`, `autoResize`, `maxLength`.

**A11y.** `aria-multiline="true"` (native pre `<textarea>`). Pri `maxLength`
zobrazené counter "120 / 5000" + `aria-describedby`.

## Select

**Účel.** Klasický dropdown picker (status, category, severity).

**Varianty.** `single`, `multi`.

**Props.** `options[]`, `value`, `onChange`, `placeholder`, `searchable`
(prepne na Combobox), `clearable`.

**A11y.** WAI-ARIA listbox pattern alebo native `<select>` (preferované pre
< 10 opt). Klávesy `↑/↓` highlight, `Enter` select, `Esc` close.

## Combobox

**Účel.** Autocomplete picker — user picker (assignee), CI picker, tag input,
internal record link search.

**Props.** `options[]` (alebo `loadOptions(query)` async), `value`,
`renderOption`, `multi`, `creatable`.

**A11y.** WAI-ARIA combobox pattern. `aria-autocomplete="list"`,
`aria-activedescendant`. Loading state has `aria-busy`.

## Checkbox

**Účel.** Boolean toggle, multi-select v table row, settings.

**States.** `unchecked`, `checked`, `indeterminate` (table "select all" pri
partial selection), `disabled`.

**A11y.** Native `<input type="checkbox">`. Label spojený. Indeterminate
cez `aria-checked="mixed"`.

## RadioGroup

**Účel.** Mutually exclusive single-select (urgency v portal new ticket).

**Props.**

- `RadioGroup`: `name`, `value`, `onChange`, `orientation` (horizontal/vertical)
- `Radio`: `value`, `label`, `description?`

**A11y.** `role="radiogroup"` + `aria-labelledby`. Native `<input type="radio">`.
Klávesy: `↑/↓` selectu radio v group (auto-select, focus-driven).

## Switch

**Účel.** Boolean preferences (notifications on/off, dark mode toggle).

**A11y.** `role="switch"`, `aria-checked`. Klávesa `Space` toggle.
Vizuálne odlíšiteľné od checkboxu (pill shape).

## FileUpload

**Účel.** Drag-drop alebo file picker (portal attachments, KB editor image
paste).

**Varianty.** `dropzone` (large area), `inline` (button only).

**Props.** `accept` (mime types), `multiple`, `maxSize` (bytes), `maxFiles`,
`onUpload(files)` — progress callback, `renderItem(file, progress)`.

**A11y.** Drag-drop **must have** alternatívne button "vyber zo zariadenia"
(WCAG 2.5.7 — Pointer Gestures). Progress `role="progressbar"` s
`aria-valuenow`. Error per file inline pod nim.

## AttachmentChip

**Účel.** Reprezentuje uploaded file v message composer / form
("screenshot-error.png (180 KB) [✕]").

**Props.** `name`, `size`, `mimeType`, `progress?`, `onRemove`, `onPreview`.

**A11y.** `aria-label` rozšírený o popis stavu ("Príloha screenshot-error.png,
180 kilobajtov, nahrané").

## Form

**Účel.** Wrapper s form-level concerns — submission state, optimistic UI,
draft auto-save, scroll-to-error on submit.

**Props.** `onSubmit`, `mode` ("create" | "edit" | "approve"), `autoSave`
(boolean + storage key), `submitting` (controlled).

**A11y.** `<form>` element. `aria-busy` pri submit. Scroll-to-first-error
on validation failure. Live region announcing "Saving..." / "Saved" cez
`aria-live="polite"`.

## FormField

**Účel.** Wrapper kombinuje `FieldLabel`, input, `FieldHint`, `FieldError`
do konzistentného slot pattern.

**Props.** `label`, `name`, `required`, `hint`, `error`, `children` (input).

**A11y.** Required marker `*` má `aria-label="povinné"`. Helper a error sú
spojené cez `aria-describedby` na input.

## FieldLabel

`<label>` element. Required marker `*` má `aria-label="povinné"`.
`font.size.sm`, `font.weight.medium`, `color.text.body`.

## FieldHint

Helper text pod inputom, `font.size.xs`, `color.text.secondary`.
Spojený s inputom cez `aria-describedby`.

## FieldError

`role="alert"`, `color.danger.fg`. Spojený s inputom cez `aria-describedby`
a inputu sa pridá `aria-invalid="true"`.

## Card

**Účel.** Container pre súvisiace info — action card na portal home, KB
result card, featured catalog item card, requester card v context panel.

**Varianty.**

- `surface` (default — biele pozadie, `shadow.xs`, `radius.md`, `spacing.6`)
- `outlined` (no shadow, `border-color.border.default`)
- `interactive` (hover lift — `shadow.sm`, cursor pointer, focus ring)
- `subtle` (`color.background.subtle` bg, no shadow)

**Slots.** `header` (icon + title + meta), `body`, `footer` (CTA).

**A11y.** Pri `interactive` variante: render ako `<a>` alebo `<button>`,
celá karta klikateľná, focus ring viditeľný.

## DataTable

**Účel.** Workspace queue, KB list, CMDB browse, change list.

**Density.** Compact (workspace default 28–32 px row), default (36 px),
comfortable (44 px). Cieľová veľkosť dát: **rádovo desiatky riadkov per
view** (GOAL §11), max ~ 100 po filteri — **bez virtualizácie**.

**Features.**

- `columns[]` (key, header, render, width, sortable, sticky)
- `rows[]` data
- `selectable` ("none" | "single" | "multi") — render checkbox column
- `rowKey` (function)
- `onRowClick` / `onRowOpen`
- `selectedKeys`, `onSelectionChange`
- `sortBy`, `onSortChange`
- `columnConfig` persisted v localStorage
- `splitView` (boolean — when row clicked, render right pane instead of route)
- `density`
- `emptyState` slot

**Klávesy** (zhoda s wireframe `workspace/01-queue.md`):

| Klávesa | Akcia |
|---|---|
| `j` / `↓` | Next row |
| `k` / `↑` | Previous row |
| `Enter` | Open detail |
| `Space` | Toggle row selection |
| `Shift+Space` | Range select |
| `Cmd+A` | Select all visible (s confirm pri > 50) |
| `Esc` | Clear selection |

**A11y.**

- `<table>` element s `<thead>`, `<tbody>`.
- `aria-rowcount`, `aria-colcount`, per row `aria-rowindex`.
- Sortable headers `aria-sort="ascending|descending|none"`.
- Selected rows `aria-selected="true"`.
- Row focusable (`tabindex="0"`); roving tabindex pattern.
- Cell `<th scope="col">` v hlavičke, `<th scope="row">` pre primary cell.

## ListRow

**Účel.** Generic list item — KB search results, my tickets v portal home,
CI relationships list view.

**Varianty.**

- `compact` (single line + meta line)
- `detailed` (title + 2-line snippet + meta)
- `media` (avatar + content)

**A11y.** Ak interactive → `<a>` alebo `<button>`. Visible focus ring.

## Timeline

**Účel.** Comment list v ticket detail (portal + workspace) + KB activity feed.

**Varianty.**

- `comment` (avatar + author + timestamp + body + attachments)
- `system` (icon + minimal text — "Status changed to Open")
- `activity` (KB analytics — view, vote)

**Color accent.** Left border 4 px (`border.width.thick`):

- `public` → `color.info.border`
- `internal` → `color.warning.border`
- `system` → `color.neutral.300`

**A11y.** `<ol role="feed">` s `aria-busy` pri loading more. Each item
`role="article"`, `aria-posinset`, `aria-setsize`. Live region pre new comments
appearing — `aria-live="polite"`.

## CommentItem

Single item v `Timeline`. Slots: `avatar`, `author`, `timestamp`,
`badges`, `body`, `attachments`, `actions` (edit/delete iba pre author).

**A11y.** `<article>` s `aria-labelledby` (author + timestamp). Edit/delete
actions visible iba pri hover/focus, ale dostupné cez keyboard `Tab`.

## Composer

**Účel.** Workspace ticket reply composer s tabs (Public reply / Internal note
/ Resolution) + toolbar (KB-link inserter, attach, templates) + Cmd+Enter submit.

**Props.** `tabs[]` (default — public/internal/resolution), `activeTab`,
`value`, `onChange`, `onSubmit`, `toolbar` (slot — buttons), `mentions`
(boolean — `@user` autocomplete pri internal note).

**A11y.** Editor `role="textbox"`, `aria-multiline="true"`,
`aria-label="Composer"`. Toolbar `role="toolbar"`. Submit hotkey
documented v `?` overlay.

## EmptyState

**Účel.** Žiadne tickety v queue, žiadne search results, žiadne notifications.

**Slots.** `icon`, `title`, `description`, `actions` (1–2 buttons).

**A11y.** `role="status"` ak je hint po user action, inak plain section.
Heading hierarchia rešpektovaná.

## ErrorState

**Účel.** "Niečo sa pokazilo — skús refresh", network error, permission
denied page.

**Varianty.** `inline` (v karte, v panely), `page` (full screen),
`boundary` (React error boundary fallback).

**A11y.** `role="alert"` pri page variant. Action buttons (Retry, Contact
support) majú jasné labely.

## LoadingSkeleton

**Účel.** Shimmer placeholder pre table rows, cards, timeline pri pending
fetch.

**Varianty.** `text` (line), `block` (rectangle), `circle` (avatar),
`table-row` (group), `card`.

**A11y.** `aria-busy="true"` na parent + `aria-label="Načítavam..."`.
`prefers-reduced-motion` → static placeholder (no shimmer).

## CodeBlock

**Účel.** Code v KB článkoch a v KB editor toolbar. Syntax highlight
(language auto-detect), **copy button** vždy viditeľný v top-right.

**Props.** `code`, `language`, `showLineNumbers`, `wrap`.

**A11y.** `<pre>` + `<code>`. Copy button `aria-label="Skopírovať kód"`.
Po kliku live region oznámi "Skopírované".

## MarkdownRenderer

> **Alias `Markdown`** — preferovaný kratší názov pri použití v JSX:
> `<Markdown content={article.body} />`. `MarkdownRenderer` je dlhšia forma
> pre kontext kde alias kolidoval.

**Účel.** Render KB článok body (portal + workspace), comment body, ticket
description body. **Read-side render only** — write-side je `KbEditor` (TipTap).

**Implementation backend (r2 final per 06 + 05 security contract)**:
`react-markdown@9.x` + `remark-gfm` + `rehype-sanitize` (allowlist mode). NIE
`dangerouslySetInnerHTML`, NIE raw HTML pass-through. **Sanitization je
povinná** — nesmie sa obísť ani s `unsafe={true}` flagom; ESLint pravidlo
to bude blokovať.

**Sanitization allowlist** (synchronizovaná s
[`security/owasp-mitigations.md`](../security/owasp-mitigations.md)
§Markdown sanitizer whitelist):

| Allowed | Blocked |
|---|---|
| `p, strong, em, ul, ol, li, code, pre, a, h1-h6, blockquote, img, table, thead, tbody, tr, td, th, hr, br` | `script, style, iframe, form, object, embed, link, meta` |
| Attributes: `href`, `src`, `alt`, `title`, `colspan`, `rowspan` | `on*` (všetky event handlers), `style`, `javascript:` URIs |
| URL schemes: `http`, `https`, `mailto`, relative paths | `javascript:`, `data:` (okrem `data:image/png|jpg|svg+xml` whitelisted v `img.src`) |

**Props.**

- `content` (required, string — raw markdown)
- `variant` ("article" | "comment" | "inline") — line-height + heading scale tune
- `onLinkClick` (optional, intercepts external links — telemetry hook)
- `density` (compact / default / comfortable)

**Defaults.**

- Externé linky (`http://` mimo current origin): `target="_blank"
  rel="noopener noreferrer"` + visual hint (↗ icon) + `aria-label` "otvorí sa
  v novom okne".
- Code blocks: render cez `CodeBlock` komponent (syntax highlight + copy).
- Images: lazy-load (`loading="lazy"`), max-width container, click → modal full-size.
- Callouts: `> [!note]`, `> [!warning]`, `> [!danger]` rendered ako `Card`
  variant subtle s ikonou + `color.{info|warning|danger}.bg`.

**A11y.**

- Heading hierarchia preserved — komponent zhadzuje H1 z markdown na H2 v
  rámci article (lebo article title je už H1).
- Images `alt` required — markdown bez alt textu vyhodí build-time warning v
  Storybook (v unit teste sa fail-uje).
- Externý odkaz `aria-label` "otvorí sa v novom okne".
- Tables majú implicit `<caption>` ak markdown obsahuje "Table:" prefix na riadku
  pred tabuľkou (extension cez remark plugin).

## Toast

**Účel.** Krátka feedback správa (Success, Error, Info, Warning) — bottom-right.

**Props.** `variant`, `title`, `description`, `duration` (default 5 s), `action`
(button "Undo", "Retry"), `onDismiss`.

**A11y.** `role="status"` pre success/info (`aria-live="polite"`),
`role="alert"` pre error/warning (`aria-live="assertive"`). Auto-dismiss
**pauzuje** pri hover/focus.

## Modal

**Účel.** Centered overlay pre focused tasks — confirm dialogs, bulk
operations, escalate modal, approve / reject change.

**Props.** `title`, `description`, `size` ("sm" | "md" | "lg" | "fullscreen-mobile"),
`onClose`, `dismissible` (boolean — `Esc` close), `initialFocus`,
`footer` slot.

**A11y.**

- `role="dialog"` + `aria-modal="true"` + `aria-labelledby` (title) +
  `aria-describedby` (description).
- **Focus trap** — focus ostáva v modal kým je open.
- On open: focus na first interactive (alebo `initialFocus` prop).
- On close: focus return na trigger element.
- `Esc` close (ak `dismissible`).
- Body `overflow:hidden`, `inert` na zvyšok appky.

## ConfirmDialog

Špecializácia `Modal` — 2 actions (cancel, confirm), title + description.
Variant `destructive` (red confirm) pre delete/reject.

**Použitie.** Tenant switch pri pending form, Cancel ticket form,
Bulk close ticketov, Reopen ticket.

## Drawer

**Účel.** Slide-in panel zo strany — notifications drawer (right), filter
panel (right alebo bottom mobile).

**Props.** `side` ("right" | "left" | "bottom"), `size`, `dismissible`.

**A11y.** Same ako Modal (focus trap, `role="dialog"`).

## Tooltip

**Účel.** Hover hint na ikon-only button, status meaning, helper info.

**Constraints.** **Nikdy** nepoužívať tooltip ako jediný zdroj kritickej
info (WCAG 1.3.1). Tooltip dopĺňa, nereplikuje.

**A11y.** `role="tooltip"`, button má `aria-describedby` (NIE
`aria-labelledby` — label je už v `aria-label` alebo viditeľnom texte).
Trigger na focus aj hover. `Esc` closes.

## Popover

**Účel.** Klikateľný popover s rich content — contact card on hover requester,
KB suggestions inline, color picker.

**Props.** `trigger` ("click" | "hover"), `placement`, `offset`.

**A11y.** `role="dialog"` ak content má interactive elements, else
`role="group"`. Focus trap pri click trigger; on close return focus.

## Dropdown

**Účel.** Menu trigger (More menu `⋮`, sort, density picker, column config).

**Items.** Action items, sub-menus, separators, checkable items (toggle column
visibility).

**A11y.** `role="menu"` + `role="menuitem"`. Klávesy `↑/↓`, `Enter`,
`Esc`, `Tab` (close).

## CommandPalette

**Účel.** `Cmd+K` spotlight — global search (tickets, KB, CIs, users),
quick actions (Go to queue, New incident, Switch tenant).

**Sections.** Recent, Suggestions, Search results (grouped by type).

**A11y.** Combobox pattern, `aria-activedescendant`. `Esc` close.
Search input auto-focus.

## ActionBar

**Účel.** Sticky bottom alebo top action bar v ticket detail / change detail
(Reply, Close, Escalate, Take, Watch, More).

**Props.** `actions[]` (label, icon, onClick, disabled, primary?, shortcut?),
`density`.

**A11y.** Buttons disabled state `aria-disabled`. Shortcut visible v tooltip
+ `?` overlay.

## FilterBar

**Účel.** Workspace queue filter chips + saved view selector + advanced filter
modal trigger.

**Props.** `filters[]` (chips), `savedViews[]`, `activeView`, `onSaveView`.

**A11y.** Filter chip = toggle button (`role="button"` + `aria-pressed`).
Filter group `role="group"` + `aria-label`.

## SearchInput

**Účel.** Generic search bar (KB search, Catalog search, queue search).

**Features.** Debounce (default 250 ms — KB 300 ms, queue 200 ms, command
palette 100 ms). Clearable. Match highlight in results (caller's responsibility).

**A11y.** `role="searchbox"` (or `<input type="search">`). Result count
oznámené live region.

## QueueSidebar

**Účel.** Workspace left sidebar — queue list, saved views, collapsible.

**Props.** `queues[]` (label, count, badge?), `savedViews[]`, `activeKey`,
`collapsed`, `onToggleCollapse`, `onCreateSavedView`.

**A11y.** `<nav aria-label="Queues">`. Counts oznámené ako súčasť aria-label
(`aria-label="My open queue, 6 tickets"`).

## ContextPanel

**Účel.** Workspace right panel v ticket detail — requester, CI, history,
KB suggestions, related records. Sections collapsible.

**Props.** `sections[]` (key, title, content, collapsedByDefault).

**A11y.** `<aside aria-label="Kontext">`. Each section `<section>` + heading.

## BulkActionBar

**Účel.** Sticky bottom bar viditeľná pri ≥ 1 selected row v `DataTable`.

**Props.** `selectedCount`, `actions[]` (Take, Assign to, Close, ...),
`onClearSelection`.

**A11y.** Live region announces "5 ticketov vybraných". Action buttons
`aria-label` explicit ("Pridelit si 5 ticketov").

## Calendar

**Účel.** Change calendar — Day / Week / Month view, time × days grid.
**Implementation backend (r2 final per 06)**: FullCalendar 6 (open-source build)
+ `@fullcalendar/daygrid` + `@fullcalendar/timegrid` + `@fullcalendar/interaction`
(drag-resize). Lazy-loaded chunk (~95 kB) na route `/changes/calendar`.

**Variants.** `day`, `week`, `month`.

**Props.** `events[]` (id, start, end, riskTier, title), `onEventClick`,
`onEventDragResize` (v1+), `freezeRanges[]`.

**A11y.**

- `role="grid"` (calendar grid).
- Each cell `role="gridcell"`.
- Events `role="button"` + `aria-label` ("CHG-503 Apache patch, emergency,
  Saturday 17 May 02:00 to 06:00").
- Klávesy: arrow keys navigate cells, `Enter` open event.
- **Alternatívny list view** pre screen readers (povinný — calendar grid
  visualization ne-screen-reader friendly).

## CalendarBlock

Single event block — coloured by risk (`color.severity.*`), label inside,
hover tooltip s full info, conflict overlay.

**A11y.** `aria-label` rozšírený o všetky kritické info; `role="button"`.
Conflict overlay má `aria-describedby` linkujúci na conflict popis.

## ApprovalChecklist

**Účel.** Change detail Approvals tab — list approvers + status (✅/⏳/❌).

**Props.** `approvers[]` (name, role, status, timestamp), `onSendReminder`.

**A11y.** `<ul>` s items `aria-label` opisujúcim status. "Send reminder"
button per approver má explicit `aria-label="Pošli pripomienku Lukášovi Hricovi"`.

## ImpactList

**Účel.** Change detail Impact tab — affected CIs + business services.

**Props.** `cis[]`, `services[]`, `conflicts[]`, `onExpand`.

**A11y.** Grouped list with `<h3>` headings per category. Expand button
`aria-expanded`.

## CIAttributeGroup

**Účel.** CMDB CI detail attribute groups (Key, Database, Network, Compliance,
Custom). Collapsible per group, per-user persistence.

**Props.** `groupKey`, `title`, `attributes[]` (label, value, type),
`defaultCollapsed`.

**A11y.** Each attribute `<dl>` row (definition list). Group toggle
`aria-expanded`.

## RelationshipGraph

**Účel.** CMDB CI relationships visualization — canvas-based graph, pan/zoom,
click select, double-click drill-in. **Implementation backend (r2 final per
06)**: Cytoscape 3 (canvas mode) + `react-cytoscapejs`. Lazy-loaded chunk
(~110 kB) na route `/cmdb/ci/:id` tab Relationships.

**Layout algorithms** (cytoscape plugin): `cose-bilkent` (default — force-directed
high-quality), `dagre` (tree / hierarchy), `breadthfirst` (impact-cascade
visualization). Layout config je súčasť props.

**Props.** `nodes[]` (id, label, type, tenantId), `edges[]` (source, target,
relationType), `centerNodeId`, `layout` ("auto"|"tree"|"force"),
`onNodeSelect`, `onNodeDrillIn`, `directionFilter` ("up"|"down"|"both"),
`maxNodes` (default 200 — performance gate; nad limitom prompt "Zobraziť viac").

**A11y.**

- **Povinný alternative list view** pre screen readers (toggle button "Zobraziť
  ako zoznam" / "Zobraziť ako graf"). Cytoscape canvas je natívne SR-unfriendly
  — list view je obligatórny fallback.
- Graph keyboard navigation: `Tab` cycle nodes (poradie = breadth-first od
  center node), `Enter` drill-in, arrow keys pan canvas.
- Each node v list view `role="treeitem"`, `aria-level`, `aria-expanded`.
- Cross-tenant nodes (read-only cross-tenant viewer per `[05-security/rbac.md]`
  sp_admin) majú `aria-label` rozšírený o tenant kontext:
  `aria-label="External tenant: Acme East — DB cluster prod-01"`.
- Zoom level oznámený live region pri zmene (Cmd+plus / Cmd+minus).

## CMDBGraph

**Účel.** CMDB-specifický alias k `RelationshipGraph` so pre-konfigurovanými
defaults pre CMDB use case (per 04 `components/workspace.md` W-05 module).

**Defaults vs. base `RelationshipGraph`**:

- `layout` default `"cose-bilkent"` (force).
- `directionFilter` default `"both"` (CMDB impact analysis chce upstream + downstream).
- `maxNodes` default 200, prompt nad limitom.
- Node color coding per CI class (`color.severity.*` pre risk tier of CI).
- Edge style per relationType: `depends_on` solid, `hosts` thick, `peers_with`
  dashed (`border.style.dashed`).
- Built-in legend toggle.

**Pozor**: ak budeme niekedy chcieť graf v inej doméne (napr. problem → root
cause graph), použijeme base `RelationshipGraph` priamo s custom konfiguráciou,
nie `CMDBGraph`.

**A11y.** Inherited from `RelationshipGraph`. Plus: legend musí mať textovú
alternatívu (visible + `aria-label` na legend trigger).

## KbEditor

**Účel.** WYSIWYG editor s markdown shortcuts, drag-drop images, code blocks,
internal record `#` autocomplete, version history. **Implementation backend
(r2 final per 06)**: TipTap 2 s extensions: `@tiptap/starter-kit`,
`@tiptap/extension-link`, `@tiptap/extension-image`,
`@tiptap/extension-code-block-lowlight`, `@tiptap/extension-mention` (pre `#`
record autocomplete), `@tiptap/extension-task-list`. Lazy-loaded chunk (~70 kB)
na route `/kb/editor`.

**Pozor**: `KbEditor` je **write-side** komponent. Pre **read-side** render
(KB článok detail, komentáre) použij `Markdown` komponent — react-markdown +
remark-gfm + rehype-sanitize, NIE TipTap render mode (sanitization stack je
iný).

**Underlying library recommendation** — viď [`library-recommendation.md`](./library-recommendation.md).

**Props.** `initialContent`, `onChange`, `onSubmitForReview`, `onSaveDraft`,
`mentions` (config), `attachmentUploader`.

**A11y.**

- Editor surface: `role="textbox"`, `aria-multiline="true"`,
  `aria-label="Article body"`.
- Toolbar `role="toolbar"`.
- Drag-drop image: alternative `<button>` file picker.
- Live region pre auto-save ("Saved 14:32").

## KbArticleHeader

**Účel.** KB článok detail header — title, category, last updated, read time,
language flag, breadcrumb.

**A11y.** Title je `<h1>` na článok detail page. Meta info v `<dl>` (key/value
páry pre last updated, category, language).

## HelpfulnessVote

**Účel.** "Pomohol ti tento článok? 👍 / 👎" + optional textarea.

**A11y.** Buttons explicit `aria-pressed` state. Po klik live region
"Vďaka, pomôže to ostatným.".

## ServiceCatalogTile

Category tile (Hardvér / Softvér / Prístupy / Iné) — icon, label, count.
Klik filtruje featured list.

**A11y.** Render ako `<a>` (route push) alebo `<button>` (filter state).

## ServiceCatalogItem

Featured item card v catalog browser — icon, title, description, SLA hint,
"Požiadať" CTA.

**Slot:** `cost-banner` (Odhadovaná cena).

**A11y.** Cieľ — celá karta klikateľná, focus ring na celej karte (ne len na
"Požiadať" CTA). SLA hint pre screen readers cez `aria-describedby`.

## DynamicForm

**Účel.** Generated form pre Service Catalog Request Item template (dynamic
fields per item — text, textarea, number, date, select, multi, radio, file,
user picker, CI picker).

**Schema-driven.** Backend dodá form definition; frontend renderuje cez
field-type registry.

**A11y.** Field type registry MUSÍ rešpektovať a11y guidelines per FormField.
Server-side validácie sa zobrazia po submit; client-side po blur.

## MobileApproveSheet

**Účel.** Peter (change manager) klikol notifikáciu z mobilu — full-screen
sheet s key info + Approve/Reject buttons ≥ 44 × 44 px.

**A11y.** Buttons must include label + icon, never icon-only. Step-up auth
(2FA) flow rendered ako secondary modal.

## Divider

Horizontálna alebo vertikálna divider line. `color.border.default`.

**A11y.** Pri sémantickom oddelení sekcií `role="separator"`. Pri čisto
dekoratívnej čiare `aria-hidden="true"`.

## VisuallyHidden

`sr-only` wrapper — text only for screen readers. CSS: `clip-path`,
`width: 1px`, `height: 1px`, `overflow: hidden`, `position: absolute`.

**Použitie.** Skip-link target, additional context pre icon-only buttons,
heading hierarchy maintenance keď visible heading by bol zbytočný.

## Spinner

Loading indicator (inline). Used in `Button` loading state, network calls.
**Nie** ako jediný indicator dlhej operácie — ak > 3 s, switch to progress bar.

**A11y.** `role="progressbar"` (indeterminate) + `aria-label="Načítavam"`.
`prefers-reduced-motion` → fade-only animation.

## ProgressBar

Determinate alebo indeterminate. File upload, bulk operations progress.

**A11y.** `role="progressbar"` + `aria-valuenow` (determinate),
`aria-busy="true"` (indeterminate). Visible percentage label vedľa baru.

## KeyboardShortcutHint

`<kbd>` element wrapper — render keyboard shortcut visually (`Cmd K`).

**A11y.** Native `<kbd>` element. Listed v `?` overlay (cheat sheet)
v textovej forme tiež.

## NotificationDrawer

Side drawer s zoznamom notifikácií. Mark all read, filter, link na zdroj
(ticket detail).

**A11y.** Trigger button v top bar má `aria-label="Notifications, 3 unread"`,
počet sa update-uje live. Drawer = `Drawer` komponent.

## UserMenu

Dropdown z top bar avatar — Profile, Preferences (theme, language, density),
Help (`?` shortcut overlay), Sign out.

**A11y.** Trigger `aria-haspopup="menu"`. Menu items čisto `role="menuitem"`.
Sign out vyžaduje confirm dialog (prevention against accidental click).

## Can

**Účel.** Permission-guarded wrapper — render `children` iba ak aktívny tenant
+ aktívna rola má dané permission. UX optimalizácia (skrytie akcie keď user
nemá right) — **NIE security gate** (server-side enforcement je v BFF, viď
[`security/rbac.md`](../security/rbac.md) §1 princíp 4).

**Implementation backend.** Permission keys sú definované v
[`security/rbac.md`](../security/rbac.md) §6 (Permission union type).
`Can` komponent číta `ActiveTenantContext.effectivePermissions[]` z React
context, ktorý je naplnený pri tenant switch BFF response.

**Props.**

- `permission` (string — permission key, napr. `"incident.transition.status"`)
- `permissions` (string[] — viacero permissions, AND-spojené default)
- `mode` ("all" | "any") — defaultný `"all"` pri `permissions[]`
- `fallback` (ReactNode — render alternative keď deny; default `null`)
- `children` (ReactNode)

**Príklad použitia.**

```jsx
<Can permission="incident.transition.status">
  <Button variant="primary">Zmeniť status</Button>
</Can>

<Can permissions={["change.read", "change.approve"]} mode="all">
  <Button>Approve change</Button>
</Can>

<Can permission="incident.delete" fallback={<Tooltip content="Vyžaduje rolu admin">...</Tooltip>}>
  <IconButton aria-label="Odstrániť" icon={<TrashIcon />} />
</Can>
```

**A11y.**

- Žiadny vlastný DOM output — children sú render-prop. Žiadne wrapper `<div>`.
- Keď permission deny: deti **nie sú vôbec mountnuté**, nie len `display:none`.
  Inak by skrytý fokus-able element rušil tab order.
- Pri rapid permission change (tenant switch) sa re-render rieši cez React
  context — visible feedback je v parent `AppShell` (toast "Tenant prepnutý,
  niektoré akcie sa zmenili").

**Pozor — žiadny info disclosure**: ak permission deny, `Can` **nemá**
zobrazovať detail prečo. Pre 403 RBAC errors zobrazené pri API call (mutation
returned 403), pozri [`microcopy.md`](./microcopy.md) §403 / RBAC errors —
text "Skontroluj rolu s administrátorom", bez menovania konkrétnej permission.

## QueueTable

**Účel.** Workspace-specifický alias k `DataTable` s pre-konfigurovanými
defaults pre queue (per 04 `components/workspace.md` W-01 module). Dense
inbox view, optimalizovaný na keyboard navigation.

**Defaults vs. base `DataTable`**:

- `density="compact"` (28–32 px rows per UX risks R-008).
- `selectable="multi"` (bulk actions per `BulkActionBar`).
- `splitView=true` (klik na row otvorí ticket detail v right pane, nie route).
- `columns[]` typical preset: status badge, priority badge, ID, summary,
  requester, assignee, age, SLA state. Persisted v localStorage cez `columnConfig`.
- `pollingInterval=30000` (30 s TTL refetch per 04 workspace.md W-01).
- Keyboard shortcuts (j/k/Enter/Space/b) viac scoped — `j`/`k` cycling preferred.

**Pozor**: ak chceme tabuľku mimo workspace queue (KB list, CMDB browse, change
list), použijeme priamo `DataTable` s vlastnou konfiguráciou. `QueueTable` má
**queue-specific** defaults a polling.

**A11y.** Inherited from `DataTable`. Plus:

- Sticky filter bar nad table — `role="search"` landmark.
- Aktívne filter chips musia byť oznámené pri page load (live region:
  "Zobrazujem 24 ticketov, filtrované podľa: Otvorené, Vysoká priorita").

## ServiceCatalogRenderer

**Účel.** Schema-driven dynamic form renderer pre Service Catalog Request Item
template (per 04 `components/portal.md` §2.4 + 06
`libraries.md` §3 pattern). Backend (BFF) normalizuje CA SDM Service Catalog
template → JSON schema; tento komponent render-uje formulár.

**Implementation backend.** RHF + Zod (06 r2 confirmed). Render off Zod schema
built from CatalogField[] via `buildZodSchema(fields)` registry
(per [`tech-stack-selector/libraries.md`](../tech-stack-selector/libraries.md) §3).

**Field type registry** (typovo-bezpečný discriminated union):

| Field type | Renderuje sa ako | Validation defaults |
|---|---|---|
| `text` | `TextField` | `z.string().min(1)` ak required |
| `textarea` | `TextArea` | `z.string()` |
| `number` | `TextField type="number"` | `z.number().int().optional()` |
| `date` | `TextField type="date"` (React Aria DatePicker v1+) | `z.date()` |
| `select` (single) | `Select` | `z.enum([...])` |
| `select` (multi) | `Combobox multi` | `z.array(z.enum([...]))` |
| `radio` | `RadioGroup` | `z.enum([...])` |
| `checkbox` | `Checkbox` | `z.boolean()` |
| `file` | `FileUpload` | `z.array(z.instanceof(File))` |
| `user-picker` | `Combobox` (async loadOptions) | `z.string()` (user ID) |
| `ci-picker` | `Combobox` (async loadOptions na CI search) | `z.string()` (CI ID) |
| `markdown-help` (non-input) | `Markdown` block (read-only help text) | n/a |

**Props.**

- `schema` (CatalogField[] from BFF)
- `defaultValues` (optional — prefill pre edit)
- `onSubmit` (data, formApi) — submit handler
- `onCancel` (optional)
- `submitting` (controlled)
- `mode` ("create" | "edit")

**Server-side validation.** Server vráti per-field errors po submit; renderer
mapuje na `setError(fieldName, ...)` v RHF.

**A11y.**

- Wrapper je `Form` komponent → všetky `Form` a11y pravidlá platia.
- Každý field má `FormField` wrapper (label + hint + error spojené cez `aria-describedby`).
- Conditional fields (visibility podľa iného field value) musia mať `aria-live`
  oznámenie pri zjavení / zmiznutí.
- Scroll-to-first-error on submit fail (inherited from `Form`).

## RouteBanner

System banner top-of-page — read-only tenant, suspended, scheduled maintenance.
`z.banner`.

**A11y.** `role="status"` pre info banners, `role="alert"` pre kritické
(suspended, security). Dismissible cez ✕ button pri non-critical.

## Pagination

Pagination control pre tabuľky / KB search. (Pri rádovo desiatkach položiek
preferovaný **"Load more"** button pred page splitting — menej friction.)

**A11y.** `<nav aria-label="Pagination">`. Aktívna page `aria-current="page"`.
Disabled prev/next majú `aria-disabled`.

# Density mapping summary

| App | Default density | Komponenty so špecifickou hodnotou |
|---|---|---|
| **portal** | `comfortable` | `Form` má `comfortable` field padding, `Button` default `lg` na mobile |
| **workspace** | `compact` | `DataTable` rows 28–32 px, `TextField` 28 px tall v inline edit, `IconButton.sm` v action bar |

Mixed: `portal` na mobile používa `comfortable` (touch target ≥ 44 px),
desktop `default`.

# Token coverage check

Každý komponent vyššie odkazuje na tokeny z [`tokens.md`](./tokens.md). Žiadny
nemá hard-coded hex / px hodnotu. Kontrolný checklist:

- [x] Button → `color.brand.*`, `spacing.*`, `font.size.*`, `shadow.focus.*`
- [x] DataTable → `color.background.subtle/hover/selected`, `density.*`
- [x] StatusBadge → `color.success/warning/danger/info/.bg/.fg/.border`
- [x] Modal → `color.background.overlay`, `shadow.lg`, `z.modal`
- [x] Calendar → `color.severity.*`, `border.style.dashed`
- [x] FocusRing → `shadow.focus.brand` / `shadow.focus.danger`
- [x] Toast → `z.toast`, `motion.duration.slow`, `motion.easing.emphasized`

# P2 / future (listed only, kontrakt v1+ iterácii)

- `DiffViewer` — KB editor version history diff.
- `PrinterView` — CMDB CI export PDF layout.
- `CalendarPresenter` — CAB meeting big-screen mode.
- `AnalyticsCharts` — KB analytics, reporting widgets (recharts / visx kategória).

## Otvorené závislosti

- `[06-tech-stack-selector]` Finálny framework / komponentová knižnica —
  **[resolved-in-round-2]** React 19 + Radix UI primitives + custom skin
  (canonical). Detail v [`library-recommendation.md`](./library-recommendation.md).
- `[06-tech-stack-selector]` Graph viz library pre `RelationshipGraph` /
  `CMDBGraph` — **[resolved-in-round-2]** Cytoscape 3 canvas mode (NIE React Flow).
- `[06-tech-stack-selector]` WYSIWYG editor pre `KbEditor` —
  **[resolved-in-round-2]** TipTap 2 s extensions (StarterKit, Link, Image,
  CodeBlockLowlight, Mention, TaskList).
- `[06-tech-stack-selector]` Calendar library — **[resolved-in-round-2]**
  FullCalendar 6 (daygrid + timegrid + interaction).
- `[06-tech-stack-selector]` Markdown render library — **[resolved-in-round-2]**
  react-markdown 9 + remark-gfm + rehype-sanitize (sanitization allowlist
  per 05 OWASP).
- `[06-tech-stack-selector]` Form library — **[resolved-in-round-2]** RHF 7 +
  Zod 3 + `@hookform/resolvers/zod` (canonical pre `Form`,
  `ServiceCatalogRenderer`, `DynamicForm`).
- `[04-architecture]` `DataTable` / `QueueTable` split-view pattern —
  **[resolved-in-round-2]** cez `splitView=true` prop + `QueueTable` defaults
  (klik row → right pane render, route ostáva `/queue`). Detail v 04
  `components/workspace.md` §2.3.
- `[04-architecture]` Notification drawer state — **[resolved-in-round-2]** cez
  `NotificationDrawer` komponent (deklarovaný vyššie) + TanStack Query
  cache (žiadny Zustand/jotai per 06 r2 "Žiadny Redux/Zustand"). Polling
  interval + badge counter rieši `useNotifications()` hook.
- `[05-security]` `<Can permission="...">` wrapper komponent —
  **[resolved-in-round-2]** kontrakt definovaný v sekcii `## Can` vyššie.
- `[05-security]` Markdown rendering contract (sanitization) —
  **[resolved-in-round-2]** kontrakt definovaný v sekcii `## MarkdownRenderer`
  (alias `Markdown`) vyššie. Allowlist synchronizovaná s 05 OWASP whitelist.
- `[09-qa-test-strategy]` E2E test selectors — `data-component` atribút per
  komponent **pretrváva** (deklarované v intro). QA r2 acceptance-criteria.md
  ich používa v 18 journeys.
- `[09-qa-test-strategy]` axe-core v CI — **pretrváva** (QA + DevOps Phase C).
- `[03-domain-modeller]` `StatusBadge` mapping label-ov v SK/EN per modul —
  **pretrváva** (vstup pre 03 v post-conv stage). Microcopy referenčný mapping
  je v [`microcopy.md`](./microcopy.md) §2.2.
- `[08-devex-devops]` Self-host Inter Variable + JetBrains Mono fonts —
  **pretrváva** (Phase C DevOps detail).
