# Scout: ServiceNow Now Platform (Polaris + Next Experience)

Reference moodboard for SDM-Rewrite. All hex values are **approximate / from memory** of the Now UI unless explicitly cited; treat them as starting points, not exact replicas.

---

## 1. Colour swatches

### Primary brand — ServiceNow "Now" green

ServiceNow's signature is a desaturated teal-green (`#62D84E` historically, shifted toward `#81B5A1`/`#293E40` in Polaris). Polaris pushes a deep slate as primary and uses green as the action accent.

| Token     | Hex (approx) | Use                              |
| --------- | ------------ | -------------------------------- |
| brand-50  | `#E6F4EE`    | hover wash on light surfaces     |
| brand-100 | `#C5E7D6`    | selected row background          |
| brand-200 | `#9AD4B5`    | chips, soft fills                |
| brand-300 | `#62B98A`    | secondary actions                |
| brand-400 | `#3FA46F`    | hover state of primary           |
| brand-500 | `#2E8B57`    | **primary action** (Polaris CTA) |
| brand-600 | `#22724A`    | pressed state                    |
| brand-700 | `#185838`    | focus ring on light bg           |
| brand-800 | `#0F3D26`    | text on brand wash               |
| brand-900 | `#082616`    | (rarely used)                    |

Polaris also leans on a **deep navy** as the chrome colour: `#0B1F33` / `#15263D` for app shell, header, left rail.

### Neutrals (Polaris greys, light theme)

| Token       | Hex (approx) | Use                         |
| ----------- | ------------ | --------------------------- |
| neutral-0   | `#FFFFFF`    | base surface                |
| neutral-50  | `#F7F8FA`    | app background behind cards |
| neutral-100 | `#EEF0F3`    | row striping, table headers |
| neutral-200 | `#DEE2E7`    | borders, dividers           |
| neutral-300 | `#C2C8D0`    | disabled fills              |
| neutral-400 | `#9AA3AE`    | placeholder text            |
| neutral-500 | `#6B7480`    | secondary text              |
| neutral-600 | `#4A5260`    | body text                   |
| neutral-700 | `#2E3540`    | headings                    |
| neutral-800 | `#1A1F28`    | high-emphasis text          |
| neutral-900 | `#0D1117`    | dark-mode surface base      |

### Dark-mode notes

Polaris dark theme inverts surface to `#0B1220` → `#15263D` → `#1E3656` (3 elevation steps). The same green (`#3FA46F`/`#62B98A`) reads well on dark; **avoid brand-500 (`#2E8B57`)** on dark — contrast drops below WCAG AA. Use brand-300/400 as CTA on dark.

### Semantic

| Token   | Light hex | Dark hex  | Note                                |
| ------- | --------- | --------- | ----------------------------------- |
| success | `#1B7F3B` | `#4ADE80` | green, distinct enough from brand   |
| warning | `#B8860B` | `#FACC15` | amber, not orange                   |
| danger  | `#C0392B` | `#F87171` | dialled-down red, not vermilion     |
| info    | `#1B6FAC` | `#60A5FA` | blue, used for "in progress" states |

Critical incident severity in Now Workspace uses a saturated red `#D32F2F` with white text — borrow this for P1/Crit chips only.

---

## 2. Typography

- **Family**: ServiceNow uses **Lato** as the primary across Polaris (replaced earlier Source Sans Pro). System fallback: `-apple-system, "Segoe UI", Roboto, sans-serif`. Mono in agent workspace tables: **Roboto Mono** / `ui-monospace`.
- **Sizes** (rem-based, 16px root):
  - `xs` 11px — chip labels, table meta
  - `sm` 12px — table body, sidebar nav
  - `base` 13px — agent workspace body (yes, 13 not 14 — high density)
  - `md` 14px — portal body (Lucia)
  - `lg` 16px — section titles
  - `xl` 20px — page titles
  - `2xl` 24px — workspace H1
  - `3xl` 32px — portal hero only
- **Weights**: 400 (body), 500 (table headers, nav), 600 (titles, chips), 700 (rare — only KPI numbers). No 800/900.
- **Line-height**: 1.35 for body, 1.2 for table rows (helps cram 28–32px row height), 1.5 for KB article prose.
- **Tabular numerals**: Now Workspace tables use `font-variant-numeric: tabular-nums` on every numeric column (ticket IDs, timestamps, SLA counters). Critical for the agent queue.
- **Letter-spacing**: `0.02em` on uppercase chip text, `0` elsewhere.

---

## 3. Spacing & radius scale

Polaris uses a **4px base unit**: `4, 8, 12, 16, 20, 24, 32, 40, 56, 72`. Notably **no 6/10/14** — sticks to 4-multiples after 4.

- Component internal padding: 8–12px
- Card padding: 16–20px
- Section gutter: 24px
- Workspace column gutter: 16px (tight; portal uses 24–32px)
- Inline icon + text gap: 8px

**Radius scale**: `2, 4, 6, 8, 12, 999`.

- Inputs, buttons, chips: **4px** (sharp, business-feeling)
- Cards, panels: **6px** or **8px** (Polaris bumped from 4→6 in 2023)
- Modals: **8px**
- Avatar / status dot: **999px**
- Workspace tables: **0 radius** on rows, 6px on the outer container only.

The "school project" feeling in SDM-Rewrite often comes from over-rounding (12–16px everywhere) — Polaris is deliberately **less rounded** than Material.

---

## 4. Shadow / elevation

Polaris is **flatter than Material**. Three levels max:

```
--shadow-0: none;                                       /* default cards */
--shadow-1: 0 1px 2px rgba(13, 17, 23, 0.06),
            0 1px 1px rgba(13, 17, 23, 0.04);           /* hovered rows, dropdown trigger */
--shadow-2: 0 4px 12px rgba(13, 17, 23, 0.10),
            0 2px 4px rgba(13, 17, 23, 0.06);           /* popovers, menus */
--shadow-3: 0 12px 32px rgba(13, 17, 23, 0.18),
            0 4px 8px rgba(13, 17, 23, 0.08);           /* modals, slide-overs */
```

Rule of thumb: **borders do the work**, not shadows. Cards lean on `1px solid var(--neutral-200)` and reserve shadow for elements that float (menus, toasts, drag previews). Don't shadow static cards.

---

## 5. Three widget shapes worth borrowing

### 5.1 List view header with inline filter chips + saved-view dropdown

```
+---------------------------------------------------------------------------+
| All open incidents ▾   [ + New ]                              ⋮  ⤓  ⚙     |
+---------------------------------------------------------------------------+
| Priority: High ×  Assigned: Me ×  State: Active ×  + Add filter            |
+---------------------------------------------------------------------------+
| ☐  Number ▾  Short description           Priority  State    Assigned  Upd |
| ☐  INC0012  Wi-Fi down — 3rd floor       ● High    In prog. AS         2m |
| ☐  INC0013  VPN reauth loop              ● High    New      —          5m |
+---------------------------------------------------------------------------+
```

Why for Anna: saved view in title doubles as breadcrumb and view-switcher; filter chips are removable in one click; right-side icons are the universal Now triplet (overflow / export / column-settings). Removes ~3 modals from the typical flow.

### 5.2 Ticket detail "split-pane with sticky sub-header"

```
+--------------------------+----------------------------------------+
| INC0012  ● High  New     |  Activity ▸ Notes ▸ Related ▸ SLA      |   <- sticky tabs
+--------------------------+----------------------------------------+
| Caller    L. Novak       |  [Work note]                           |
| Assigned  A. Sedlak      |  ─────────────────────────────────     |
| Service   Wi-Fi          |  ● Anna: ack'd, escalating to net team |
| Opened    2m ago         |    2m ago                              |
|                          |  ● System: priority bumped High → P1   |
| > Description            |    5m ago                              |
| Wi-Fi on 3rd floor ...   |                                        |
+--------------------------+----------------------------------------+
```

Why: left rail is 320px **fixed**, all reference data — never scrolls. Right pane is the work surface. The sticky tab bar means an agent reading a long activity log never loses their bearings. Far better than the typical "everything in one long scroll" template.

### 5.3 KPI strip ("number tiles") above queues

```
+---------+---------+---------+---------+---------+
| Open    | Mine    | Overdue | SLA <1h | Today   |
|   147   |   12    |    3 ▲  |   5 ▲   |   28    |
| ▁▂▃▅▇▆▄ | ─       | ●●●     | ●●●●●   | ▂▄▆▇   |
+---------+---------+---------+---------+---------+
```

Why: each tile is a clickable filter ("Mine" → apply assigned=me to the list below). The micro-sparkline / dot row is **8px tall**, doesn't compete with the number. Anna's first scan of the morning is this strip. Polaris uses tiles ~140px × 88px, gap 12px.

---

## 6. Density patterns

How Now Workspace fits ~25 visible rows on a 1080p screen without feeling jammed:

- **Row height 32px** in default density, 28px in compact mode. The body text drops to 12px in compact; padding stays at 8px horizontal.
- **No row dividers** in default mode — alternating `neutral-0 / neutral-50` striping does the separation. Saves 1px per row.
- **Column padding 12px left / 8px right**; numeric columns right-aligned with tabular nums so digits line up vertically.
- **Status & priority shown as a 6px coloured dot + text**, not a full pill — pills are reserved for the active-filter chips above the table. A pill in every row is what makes UIs feel cramped.
- **Sticky first column** (checkbox + ticket #) and **sticky header**; horizontal scroll for the long tail of columns rather than wrapping.
- **Icon size 14px** in tables (not 16, not 20). Anything bigger eats vertical rhythm.
- **Whitespace earned, not given**: section gaps drop to 12px inside the workspace, vs. 24–32px in the customer portal.
- **Column resize + reorder** via drag on the header — agents memoise their personal column order.

For Lucia (portal): row height 44–48px, full pills, 14px body, 24px section gaps. Same tokens, different density preset.

---

## 7. Motion

- **Duration**: 120ms for hovers, 180ms for dropdown/menu reveal, 240ms for slide-overs, 320ms for modal enter. Anything over 400ms feels wrong in an agent tool.
- **Easing**: `cubic-bezier(0.2, 0.0, 0.0, 1.0)` for enter (decelerate), `cubic-bezier(0.4, 0.0, 1, 1)` for exit. Polaris avoids springs in core chrome.
- **Hover lift**: rows shift background colour only, never `transform: translateY`. Reserve transforms for cards in the service catalog (Lucia surface).
- **Skeletons**: shimmer at ~1200ms cycle, low-amplitude (10% lightness oscillation). No spinners on table loads.
- **Toast in/out**: slide 16px up + fade, 200ms in / 160ms out, auto-dismiss 5s for success, sticky for error.
- **Tab switch**: 80ms crossfade only — no horizontal slide. Saves visual budget for content.
- **Drag previews** (e.g. assignment drag): 4° rotation + shadow-3, snap-back 200ms with `cubic-bezier(0.34, 1.2, 0.64, 1)` (slight overshoot — the one place Polaris allows a spring).

GSAP for the SDM workspace should restrict itself to the same envelope; the moment durations creep over 300ms the app stops feeling professional.

---

## 8. Single most impactful take-away for SDM-Rewrite

**Adopt Polaris's "borders, not shadows; dots, not pills; 4px radius, not 12px" density vocabulary in `apps/workspace` immediately — and keep the existing softer treatment for `apps/portal`.**

The current indigo `#5d4dff` over-rounded cards reads as a consumer SaaS landing page. Switching the workspace to a Polaris-style flat-bordered, 4–6px-radius, 32px-row, dot-status palette (with the slate `#0B1F33` chrome and green `#2E8B57` CTA) will collapse the perceived "school project" gap in a single sprint — without touching layout or component structure. The portal can keep larger radii (8–12px) and lighter typography because Lucia's flows reward calm; **the visual split between the two apps is the win**, not a single unified style.

---

## Sources

- ServiceNow **Polaris** design refresh announcement (Vancouver release, 2023) — palette shift toward slate + desaturated green, radius bump 4→6px, Lato adoption. Recalled from public release notes.
- ServiceNow **Next Experience / Agent Workspace** product screenshots (memory) — 32px row height, dot-status pattern, sticky sub-header on ticket detail, KPI tile strip on incident dashboard.
- **developer.servicenow.com** UI builder component gallery (memory) — confirmed 4px spacing base, three-level shadow scale, semantic colour roles.
- ServiceNow **Now Design System** Figma kit screenshots circulating in the design community (memory) — token names, weight choices (400/500/600), `0.02em` uppercase tracking.
- Personal observation of Now Workspace in production at multiple enterprise deployments — column resize behaviour, sparkline-in-KPI pattern, drag preview rotation.
- Material Design / Polaris comparison commentary in design Twitter / Refactoring UI references (memory) — "flatter than Material", borders-do-the-work principle.

**Uncertainty flags**: every hex code in §1 is approximate; the exact Polaris tokens are not publicly published as a CSS file. Treat as a calibrated starting palette and tune in the browser against actual Now screenshots before locking tokens.
