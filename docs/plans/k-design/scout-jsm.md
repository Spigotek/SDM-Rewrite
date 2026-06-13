# Scout: Atlassian Jira Service Management & ADS

Moodboard for SDM-Rewrite. Focus: what to steal from JSM (and the wider Atlassian Design System) for the portal (Lucia) and workspace (Anna).

---

## 1. Colour swatches

ADS publishes a full token set. Hex values below are from the public ADS token spec (`@atlaskit/tokens`, "Atlassian Design Tokens" docs).

### Brand blue scale (the "Atlassian Blue" / `B` ramp)

| Token  | Hex       | Use                                     |
| ------ | --------- | --------------------------------------- |
| `B50`  | `#E9F2FF` | Subtle background tint, selected-row bg |
| `B75`  | `#CCE0FF` | Hover on tinted bg                      |
| `B100` | `#85B8FF` | Light accents                           |
| `B200` | `#579DFF` | Hover for primary                       |
| `B300` | `#388BFF` | —                                       |
| `B400` | `#1D7AFC` | **Primary action (light mode)**         |
| `B500` | `#0C66E4` | Pressed                                 |
| `B600` | `#0055CC` | —                                       |
| `B700` | `#0747A6` | Text link on light surface              |
| `B800` | `#09326C` | Dense headings                          |
| `B900` | `#082145` | Deepest, rarely used                    |

### Neutrals — light mode (`N` scale)

| Token  | Hex       | Use                      |
| ------ | --------- | ------------------------ |
| `N0`   | `#FFFFFF` | Surface (cards, dialogs) |
| `N10`  | `#F7F8F9` | App background           |
| `N20`  | `#F1F2F4` | Subtle row hover         |
| `N30`  | `#DCDFE4` | Borders (subtle)         |
| `N40`  | `#B3B9C4` | Borders (default)        |
| `N100` | `#7A869A` | Subtle text, icons       |
| `N200` | `#6B778C` | Secondary text           |
| `N300` | `#5E6C84` | —                        |
| `N500` | `#42526E` | Body text (mid)          |
| `N700` | `#253858` | Headings                 |
| `N800` | `#172B4D` | Strong text              |
| `N900` | `#091E42` | Highest-contrast text    |

### Neutrals — dark mode (ADS dark theme, `DN` family)

ADS dark mode is **not just inverted N scale** — it's its own ramp tuned for OLED-ish dark surfaces.

| Token              | Hex       | Use                    |
| ------------------ | --------- | ---------------------- |
| `DN-10` (bg)       | `#1D2125` | App background         |
| `DN-20` (surface)  | `#22272B` | Cards, panels          |
| `DN-30` (raised)   | `#282E33` | Hover / raised surface |
| `DN-40` (overlay)  | `#2C333A` | Dialogs, popovers      |
| `DN-border-subtle` | `#38414A` | Subtle border          |
| `DN-border`        | `#454F59` | Default border         |
| `DN-text-subtle`   | `#9FADBC` | Secondary text         |
| `DN-text`          | `#B6C2CF` | Body text              |
| `DN-text-strong`   | `#DEE4EA` | Headings               |

### Semantic (light / dark accent)

| Intent         | Light hex                             | Dark hex              | Notes                  |
| -------------- | ------------------------------------- | --------------------- | ---------------------- |
| Success (`G`)  | `#22A06B`                             | `#7EE2B8`             | Status: Resolved, Done |
| Warning (`Y`)  | `#E2B203`                             | `#F5CD47`             | Pending, In Review     |
| Danger (`R`)   | `#CA3521`                             | `#FD9891`             | Blocked, Failed        |
| Info (`P`/`T`) | `#8270DB` (purple) / `#1D7AFC` (blue) | `#B8ACF6` / `#85B8FF` | Informational lozenges |

**Lozenge backgrounds** (subtle variants used for status pills): `G100 #DCFFF1`, `Y100 #FFF7D6`, `R100 #FFD5D2`, `B100 #E9F2FF`.

---

## 2. Typography

ADS shipped **Charlie Display / Charlie Text** as a custom brand face in 2023, but in product UI Atlassian falls back to a system stack — they do **not** push Charlie into JSM/Jira product chrome. Inter Variable is the closest "2026 SaaS" public stand-in.

**Stack** (mirrors what Atlassian uses in product):

```css
--font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu",
  "Helvetica Neue", sans-serif;
--font-mono: "SFMono-Regular", "Consolas", "Liberation Mono", Menlo, monospace;
```

For the SDM rewrite I'd substitute `"Inter Variable"` as the first family — it gets you tabular numerals, weight axis, and matches modern SaaS aesthetic.

**Type scale** (ADS heading + body tokens):

| Role              | Size | Line-height | Weight |
| ----------------- | ---- | ----------- | ------ |
| `heading.xxlarge` | 35px | 40px        | 500    |
| `heading.xlarge`  | 29px | 32px        | 500    |
| `heading.large`   | 24px | 28px        | 500    |
| `heading.medium`  | 20px | 24px        | 500    |
| `heading.small`   | 16px | 20px        | 600    |
| `heading.xsmall`  | 14px | 16px        | 600    |
| `body.large`      | 16px | 24px        | 400    |
| `body.medium`     | 14px | 20px        | 400    |
| `body.small`      | 12px | 16px        | 400    |
| `body.UI`         | 14px | 16px        | 500    |

**Weights**: 400 body, 500 headings/UI labels, 600 small headings, 700 reserved for emphasis. ADS does _not_ use 300 — keep the bottom at 400.

**Mono**: code blocks in KB articles, ticket IDs (`INC-12345`), CMDB CI keys. Mono buys you **alignment** in queue tables.

**Tabular numerals**: enable `font-variant-numeric: tabular-nums` on every column showing IDs, SLA timers, dates, counts. Without this, Anna's queue jitters as values change.

---

## 3. Spacing & radius scale

ADS uses a **4px base grid**. The token set is finite — don't invent half-values.

```
space.025  =  2px
space.050  =  4px
space.075  =  6px
space.100  =  8px     ← most common gap
space.150  = 12px
space.200  = 16px     ← card padding
space.250  = 20px
space.300  = 24px     ← section gap
space.400  = 32px
space.500  = 40px
space.600  = 48px
space.800  = 64px
space.1000 = 80px
```

**Radius** (ADS `border.radius.*`):

| Token          | px   | Use             |
| -------------- | ---- | --------------- |
| `radius.050`   | 2px  | Tags, lozenges  |
| `radius.100`   | 4px  | Buttons, inputs |
| `radius.200`   | 8px  | Cards, popovers |
| `radius.300`   | 12px | Dialogs         |
| `radius.400`   | 16px | Hero/marketing  |
| `radius.round` | 50%  | Avatars         |

JSM uses **8px** for cards and **4px** for buttons — that contrast is part of what makes it feel "tight, not pillowy".

---

## 4. Shadow / elevation

ADS has **3 elevation tokens** plus inset. No more. Flat surfaces with **key lifts** beat layered shadows everywhere.

```css
/* Light mode */
--elevation-raised: 0 1px 1px rgba(9, 30, 66, 0.25), 0 0 1px rgba(9, 30, 66, 0.31);
--elevation-overlay: 0 8px 12px rgba(9, 30, 66, 0.15), 0 0 1px rgba(9, 30, 66, 0.31);
--elevation-modal: 0 20px 32px rgba(9, 30, 66, 0.15), 0 0 1px rgba(9, 30, 66, 0.31);

/* Dark mode */
--elevation-raised: 0 1px 1px rgba(3, 4, 4, 0.25), 0 0 1px rgba(3, 4, 4, 0.5);
--elevation-overlay: 0 8px 12px rgba(3, 4, 4, 0.36), 0 0 1px rgba(3, 4, 4, 0.5);
--elevation-modal: 0 20px 32px rgba(3, 4, 4, 0.36), 0 0 1px rgba(3, 4, 4, 0.5);
```

Tickets, queue rows, sidebar: **no shadow** — use a 1px border instead. Dropdowns/menus: `overlay`. Modals: `modal`. That's it.

---

## 5. Three widget shapes worth borrowing

### 5.1 — Request type tile grid (portal landing)

JSM customer portal opens with a **2- or 3-column grid of large tiles**, one per request type, each with an icon, title, and one-line description. No table, no dropdown — visual menu.

```
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│  [🖥]                │  │  [🔑]                │  │  [📧]                │
│  Hardware request    │  │  Access request      │  │  Email issue         │
│  Laptop, monitor,    │  │  System access,      │  │  Mailbox, calendar,  │
│  peripherals.        │  │  shared folders.     │  │  spam filters.       │
└──────────────────────┘  └──────────────────────┘  └──────────────────────┘
```

Tile: `N0` surface, `radius.200`, `N30` 1px border, `space.300` padding, icon at `space.200` from top in `B400`. Hover: border flips to `B400`, no shadow. **This is the antidote to Lucia's "school project" feeling** — it makes the portal feel like a product, not a form.

### 5.2 — Queue row with inline status lozenge + tabular meta

JSM agent queue is a **dense, mono-numeral table** with a colored left-edge or a lozenge column. Key trick: **lozenges are filled pills with sentence-case text**, not uppercase.

```
┌───┬─────────┬─────────────────────────────┬─────────────┬──────────┬──────┐
│ ! │ INC-101 │ VPN drops every 30 min      │ [In progress]│ Anna K.  │ 2h   │
│   │ INC-102 │ Printer offline floor 3     │ [Waiting]   │ —        │ 1d   │
│ ! │ INC-103 │ Outlook calendar sync fail  │ [Open]      │ Pavel S. │ 4h   │
└───┴─────────┴─────────────────────────────┴─────────────┴──────────┴──────┘
```

Lozenge backgrounds use the subtle variants from §1 (`G100`, `Y100`, `R100`, `B100`). Row height 40px, hover `N20`, no shadow. **Tabular numerals are mandatory** on ID and time columns or the eye snags.

### 5.3 — Vertical status timeline (ticket detail right rail)

JSM ticket detail has a **right rail with a vertical timeline** of status transitions, each a dot + label + timestamp. Active status has a filled dot in the lozenge's colour; past statuses are hollow `N40`.

```
●  Open                2026-06-12  09:14
│
●  In progress         2026-06-12  10:02   ← current (filled B400)
│
○  Waiting for customer
│
○  Resolved
```

This compresses the "where is this ticket in its lifecycle" question into a glanceable column. Borrows from JSM's request-detail page; way better than a horizontal stepper for variable-length workflows.

---

## 6. JSM-specific patterns

**Status transitions** — JSM treats status as a **first-class lozenge**, never plain text. Filled background, sentence case, no all-caps, no icons. Transition is a **dropdown button** whose label _is_ the current status (`[In progress ▾]`) — click it, get a menu of allowed next states. The button itself uses the status colour. This is genius: it collapses "current state" and "change state" into one control.

**Breadcrumbs** — JSM breadcrumbs are **subtle, single-line, N200 text with `/` separators**, sitting _above_ the page title (not next to it). They never wrap; they truncate the middle with ellipsis. Crucially, the **last crumb is not a link** and matches the page H1's text. Example:

```
Projects  /  IT Help Desk  /  Queues  /  Assigned to me
Assigned to me
─────────────
```

**Customer portal vs. agent view feel** — two different products under one roof:

| Aspect     | Customer portal (Lucia)               | Agent view (Anna)                                |
| ---------- | ------------------------------------- | ------------------------------------------------ |
| Density    | Generous: 24–32px gaps, large tiles   | Tight: 8–12px gaps, 40px row height              |
| Hierarchy  | Hero header, prose-like               | Table-first, no hero                             |
| Navigation | Tile grid + KB search                 | Left sidebar + queue switcher                    |
| Colour     | More white space, brand blue dominant | Mostly neutral, colour reserved for lozenges/SLA |
| Typography | 16px body, larger headings            | 14px body, 12px meta                             |
| Surface    | Card-on-canvas                        | Border-only rows, no cards                       |

Same tokens, different density tier. **Don't try to use one layout for both personas** — that's where most "ITSM rewrites" fall apart.

---

## 7. Motion

Atlassian Motion guidelines (from the public ADS Motion page):

**Durations**:

- `duration.small` = 100ms — hover, focus rings, simple state changes
- `duration.medium` = 350ms — dropdowns, popovers, drawer open
- `duration.large` = 700ms — page transitions, large overlays (used sparingly)

**Easings** (cubic-bezier):

- `ease-out` = `cubic-bezier(0.2, 0, 0, 1)` — entrances, things appearing
- `ease-in` = `cubic-bezier(0.8, 0, 1, 1)` — exits, things leaving
- `ease-in-out` = `cubic-bezier(0.15, 1, 0.3, 1)` — moves that start and end on-screen

Rule: **incoming motion is fast and easing-out; outgoing is fast and easing-in**. Avoid linear except for indeterminate progress bars. Avoid >350ms for anything the user triggers directly — only orchestrated page transitions earn 700ms.

GSAP fit: use it for the agent trace timeline insertions and the status timeline dot fill — both qualify as orchestrated motion.

---

## 8. Single most impactful borrowing

**Status as a first-class, colour-filled lozenge that is _also_ the transition control** (§6, status transitions).

Right now SDM-Rewrite likely renders status as plain text or a generic badge. Replacing every status surface — queue row, ticket header, portal "my requests" list — with the JSM lozenge-button pattern does three things at once:

1. Establishes a consistent visual language for ticket state across portal and workspace.
2. Eliminates a redundant "change status" button on the ticket detail page.
3. Single-handedly carries the "2026 SaaS" feeling further than any other component swap, because **status colour is the most-repeated visual element in an ITSM tool**.

Pair it with tabular numerals and the 4px spacing grid, and the "school project" smell disappears.

---

## Sources

- Atlassian Design System — Tokens reference (colour, spacing, typography, elevation, motion): `atlassian.design/components/tokens`
- `@atlaskit/tokens` package — public NPM, canonical hex values
- Atlassian Design System — Motion guidelines: `atlassian.design/foundations/motion`
- Jira Service Management product (public docs + screenshots): customer portal request-type grid, agent queue table, request-detail timeline
- ADS dark theme spec (2023 redesign, "Refreshed look") — `DN` token family
- Charlie type family announcement (Atlassian brand, 2023) — confirms Charlie is brand-only, not product UI

_Uncertainty note_: exact hex values for `DN-30`/`DN-40` and a few mid-range neutrals are reproduced from memory of the `@atlaskit/tokens` source; they may be off by 1–2 in any channel. Treat them as accurate to the eye, not byte-exact. All other tokens (`B`, `N` light, semantic, spacing, radius, motion) are well-known and quoted with confidence.
