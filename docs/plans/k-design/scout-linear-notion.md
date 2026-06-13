# Scout: Linear + Notion — Moodboard for SDM-Rewrite

Linear leads on motion, density, dark-first polish; Notion leads on calm typography, restrained neutrals, surface hierarchy. Linear → Anna (`apps/workspace`), Notion → Lucia (`apps/portal`).

## 1. Colour & Gradients

### Linear — dark-first palette (signature)

Dark by default. **Near-black neutrals** + a tightly controlled indigo→purple→magenta accent gradient.

| Token         | Hex (approx.)                        | Use                                                |
| ------------- | ------------------------------------ | -------------------------------------------------- |
| `--bg-0`      | `#08090A`                            | App background (true near-black, slight blue cast) |
| `--bg-1`      | `#101113`                            | Panels, sidebar                                    |
| `--bg-2`      | `#1C1D1F`                            | Cards, raised surfaces                             |
| `--bg-3`      | `#222326`                            | Hover row                                          |
| `--border`    | `#27282B` / `rgba(255,255,255,0.06)` | Hairlines, 1px                                     |
| `--text-0`    | `#F7F8F8`                            | Primary text                                       |
| `--text-1`    | `#B4BBC8`                            | Secondary                                          |
| `--text-2`    | `#737783`                            | Tertiary / metadata                                |
| `--accent`    | `#5E6AD2`                            | Linear indigo (brand)                              |
| `--accent-hi` | `#7A85E8`                            | Hover accent                                       |

**The gradient.** Marketing/onboarding sweeps indigo→purple→magenta→amber:

```
linear-gradient(135deg, #5E6AD2 0%, #8B6FE8 35%, #C879D6 65%, #F2A65A 100%)
```

In-app gradients are restrained — a radial wash at top of hero panels (`radial-gradient(ellipse at top, rgba(94,106,210,0.15), transparent 60%)`). Reserve the full rainbow for empty states and onboarding only.

**Status chips**: Urgent `#EB5757`, High `#F2994A`, Med `#F2C94C`, Low `#56C9F8`, Done `#5E6AD2`, Cancelled `#737783`.

### Notion — restrained, light-first

Paper-first. Default surface `#FFFFFF`, text `#37352F` (warm near-black, never pure `#000`). Dark mode: `#191919` bg / `#E6E6E6` text.

Accent system is a fixed 10-colour swatch with **paired text + background** tints designed never to clash:

| Name    | Text      | Background tint |
| ------- | --------- | --------------- |
| Default | `#37352F` | `#FFFFFF`       |
| Gray    | `#787774` | `#F1F1EF`       |
| Brown   | `#976D57` | `#F3EEEE`       |
| Orange  | `#CC772F` | `#F8ECDF`       |
| Yellow  | `#C29243` | `#FAF3DD`       |
| Green   | `#548164` | `#EEF3ED`       |
| Blue    | `#487CA5` | `#E9F3F7`       |
| Purple  | `#8A67AB` | `#F6F3F8`       |
| Pink    | `#B35488` | `#F9EEF3`       |
| Red     | `#C4554D` | `#FAECEC`       |

These are the **call-out / tag / highlight** swatches — Lucia benefits from this exact system for KB tags and ticket categories.

## 2. Typography

**Both use Inter Variable** (Linear ~2022; Notion ~2023). Notion adds optional **Lyon** (Commercial Type) serif for headings in "Serif" font style.

### Scale (Linear)

| Token       | px  | Weight | Tracking                       |
| ----------- | --- | ------ | ------------------------------ |
| `--fs-xs`   | 11  | 510    | +0.4 (small caps for metadata) |
| `--fs-sm`   | 12  | 500    | -0.005em                       |
| `--fs-base` | 13  | 450    | -0.011em                       |
| `--fs-md`   | 14  | 500    | -0.011em                       |
| `--fs-lg`   | 18  | 560    | -0.02em                        |
| `--fs-xl`   | 22  | 590    | -0.025em                       |
| `--fs-2xl`  | 32  | 620    | -0.03em                        |

Base reading size **13px** — tighter than web default; this is Linear's density. Tracking goes **negative** as size grows (optical kerning correction).

### Micro-typography rules to steal

- **Tabular numerals always** for IDs, dates, counts, durations: `font-variant-numeric: tabular-nums;`. Stops jitter on live updates.
- **Small caps** for chips/pills: `font-variant-caps: all-small-caps; letter-spacing: 0.06em;` at 11px.
- **Italic for computed metadata** ("created by you · 3m ago") — Notion's subtle "not user-typed" signal.
- **Weights 450 / 510 / 560** instead of 400/500/600. Inter Variable exposes these; they read calmer.

## 3. Spacing & Radius

Both use a **4px base unit**. **Linear** is tight: `4, 8, 12, 16, 24, 32` — list-row padding `8px`, card padding `16px`, section margin `32px`. **Notion** is airier: `8, 12, 16, 24, 32, 48` — page content has `96px` top breathing room.

**Radius** — Linear: `4` (chips), `6` (buttons/cards), `8` (modals), `12` (cmd+K). Notion: `3` (blocks), `6` (buttons), `8` (modal). Neither uses the trendy `16px` pill. **For SDM**: `6` workspace default, `4` chips, `10` modals.

## 4. Motion Design (headline section)

Linear is _uncontested_ here. Notion is intentionally calmer — "blocks should feel like paper, not chat bubbles". Steal from Linear for Anna; from Notion for Lucia's reading flows.

### Easings + durations (Linear's system)

Custom cubic-béziers, not browser defaults:

```css
--ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1); /* default UI easing */
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1); /* dramatic ins (modals) */
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1); /* page transitions */
--ease-spring: cubic-bezier(0.5, 1.5, 0.5, 1); /* playful: toasts, badges */

--dur-instant: 80ms; /* hover lift */
--dur-fast: 150ms; /* button press, focus ring */
--dur-base: 220ms; /* list item enter, card expand */
--dur-slow: 320ms; /* modal, command palette, route change */
--dur-page: 420ms; /* full-page route transitions */
```

Rule: **user-initiated finishes ≤220ms**; ambient (shimmer, toast) can run longer. >400ms feels laggy.

### List-item stagger on route mount (Linear's signature)

When you navigate, rows cascade in instead of popping:

- Row enters with `opacity 0→1`, `translateY(6px)→0`, `220ms`, `--ease-out-quart`.
- Stagger **20ms per row**, capped at first ~24 rows; remainder snaps in (so 500-row lists don't take 10s).
- Total stagger cap ≈ 480ms — beyond that it reads "slow", not "polished".

GSAP (in stack):

```ts
gsap.from("[data-row]", {
  opacity: 0,
  y: 6,
  duration: 0.22,
  ease: "power3.out",
  stagger: { each: 0.02, amount: Math.min(0.48, rows * 0.02) },
});
```

### Hover lifts (cards & rows)

- **Row hover** (tables): background `--bg-1 → --bg-2`, `80ms`. No translate, no shadow.
- **Card hover** (kanban, KB tile): `translateY(-2px)`, shadow `0 1px 2px rgba(0,0,0,0.2) → 0 4px 12px rgba(0,0,0,0.35)`, `120ms`, `--ease-out-quart`.
- Interpolate the full shadow string, never just blur. Pair with `will-change: transform`.

### Skeleton shimmer

A **moving sheen**, not a fade-pulse. Mostly transparent gradient with a brighter band travelling left→right:

```css
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}
.skeleton {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.04) 0%,
    rgba(255, 255, 255, 0.08) 50%,
    rgba(255, 255, 255, 0.04) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.6s linear infinite;
}
```

Period **1.6s**. Faster = anxious; slower = broken.

### Page transitions

Linear: `120ms` crossfade, no slide. Notion: instant. **Don't slide pages** — users read slides as "where did my content go?". Crossfade or nothing.

### Command palette open/close

`opacity 0→1` + `scale 0.96→1` + `translateY(-4px)→0`, `220ms`, `--ease-out-expo`. Backdrop fades `180ms`. On close, snap faster: `150ms ease-in`. Asymmetric ins/outs feel responsive.

### `prefers-reduced-motion`

Wrap the whole stack:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

GSAP: skip the `from()` and `gsap.set('[data-row]', { clearProps: 'all' })` when the query matches. Linear honours this; we must too (a11y).

## 5. Command Palette (cmd+K)

Linear's is the gold standard.

```
┌────────────────────────────────────────────────────────────┐
│  ⌘K   Search or type a command…                       Esc  │  ← 44px tall, 14px input
├────────────────────────────────────────────────────────────┤
│  RECENT                                                    │  ← small caps, 11px, --text-2
│   ⏱  Reopen INC-1042                          ⌘⇧O          │
│   ⏱  Create change request                                 │
│                                                            │
│  NAVIGATE                                                   │
│   #  My queue                                  G then Q     │
│   #  All open incidents                        G then I     │
│   #  Change calendar                           G then C     │
│                                                            │
│  ACTIONS                                                    │
│   +  New ticket                                ⌘N           │
│   ⇆  Assign to…                                A            │
│   ⊙  Set status…                               S            │
│                                                            │
│  TICKETS · 3 results for "billing"                          │
│   ◉  INC-1042  Billing portal login fails       Anna L.    │
│   ◯  INC-1038  Refund request stuck             —          │
│   ◯  CHG-0211  Billing API maintenance window   ↗ approved │
└────────────────────────────────────────────────────────────┘
```

**Behaviour**:

- Opens on `cmd+K` / `ctrl+K`; closes on `esc` or outside click.
- **Search-as-you-type**, no submit. `120ms` debounce on network only — local items filter instantly.
- **Grouped sections** with small-caps headers: Recent, Navigate, Actions, then entity types (Tickets, Changes, KB, Users).
- **Keyboard**: `↑/↓` cycles across groups, `enter` activates, `tab` stays in input, `cmd+1..9` jumps to result.
- **Mode prefixes**: `>` actions only, `#` navigation, `?` help. Mirror Linear.
- **Recents**: last 5, `localStorage`. Empty first run → single help line.
- Width `640px` max, height `min(70vh, 480px)`, internal scroll. Centred horizontally, **20% from top** (vertically centred covers what you were reading).

## 6. Three Widget Shapes Worth Borrowing

### A. Inline status pill with leading dot

```
●  In progress      ●  Urgent       ●  Waiting on customer
```

6px solid dot + label in `--text-1`, `rgba(white,0.04)` bg, `4px` radius, `2px 8px` padding. **Why**: scans faster than coloured text — dot is the signal, word is confirmation.

### B. Inline activity row (Notion-style mention block)

```
┌────────────────────────────────────────────────────────────┐
│  ◉ Anna Lago  assigned INC-1042 to  ◉ Lucia Novák   3m ago │
└────────────────────────────────────────────────────────────┘
```

Avatar + name as inline mention; verb in `--text-2`; entity as chip; timestamp italic. No card. **Why**: densest "X did Y to Z" representation without a table. Perfect for ticket activity tabs.

### C. Inline meta strip under titles

```
INC-1042  Billing portal login fails
●Urgent · ◉Anna L. · ⏱opened 2h ago · ⇆Tier 2 · ⊙waiting
```

Single line of icon-prefixed metadata under the title, middle-dot separated, all `12px --text-2`. **Why**: 5+ pieces of context in one row without a key/value table. Anna scans it in 200ms.

## 7. Sidebar Nav Patterns (Linear's collapsible left rail)

Template for Anna's workspace:

```
┌──────────────────────────────┐
│ ◆  SOIMCO Service Desk    ⌄  │  ← workspace switcher, 36px tall
├──────────────────────────────┤
│  ⌘K  Search...               │  ← cmd+K trigger
│  📥  Inbox                3  │  ← count badge, right-aligned
│  ⏱   My queue            12  │
│  ⭐  Starred                  │
├──────────────────────────────┤
│  ⌄ INCIDENTS                 │  ← collapsible group, small caps
│    ●  Triage              7  │
│    ●  In progress         5  │
│    ●  Waiting             2  │
│    ●  Resolved          124  │
│                              │
│  ⌄ CHANGES                   │
│    ●  Pending approval    3  │
│    ●  Scheduled           8  │
│    ●  Calendar               │
│                              │
│  › KNOWLEDGE                 │  ← collapsed group
│  › CMDB                      │
├──────────────────────────────┤
│  ⚙  Settings                 │
│  ◉  Anna Lago         ⌄      │  ← user menu, bottom-anchored
└──────────────────────────────┘
```

**Structure rules**:

- Width `240px` expanded, `52px` collapsed (icons-only); state persists per user.
- **Workspace switcher** top — org name + env badge (dev/prod) for single-tenant.
- **Top-level items** flat, no group header; always visible.
- **Collapsible groups** — small-caps `11px` header, chevron, state in `localStorage`, items indent `16px`.
- **Count badges** right-aligned, `11px tabular-nums`, `--text-2`, no background. Highlight (white on accent) only when it's "your responsibility" (your queue, inbox unread).
- **Drag-reorder** — faint `⋮⋮` handle on hover, insertion point as `1px --accent` line. Defer to v1.2.
- **Status dots** before group items match section's semantic colour.

For **Lucia's portal**: simpler — no groups, 4–5 flat items (Home, New ticket, My tickets, Knowledge, Catalog). Don't import the agent rail.

## 8. One Concrete Take-Away

**Ship Linear's list-item stagger on route mount as a global primitive, applied to every list view across both apps.**

30-line GSAP hook + a `data-row` convention. Zero design debate. Caps at 480ms total. Honours `prefers-reduced-motion`. Transforms the _felt_ quality of every queue, KB index, and CMDB browse in one PR. Anna notices day one; Lucia notices without being able to name why. If we ship one Linear-ism in Phase K, ship this.

## Sources

Worked from training-time knowledge — no live browsing. Cross-checked against memory of:

- Linear's public design blog (2020 "How we built Linear"; 2022 design system overview); Rauno Freiberg interviews on Linear motion.
- Notion's "Designing Notion" engineering blog; Ryo Lu / Ivan Zhao interviews on typography (Lyon serif, Inter base).
- Notion's call-out palette — 10 paired text/bg tints come straight from the app's inline colour picker.
- Inter Variable specimen (rsms.me/inter) for intermediate weights `450/510/560`.

**Uncertainty flags**: Linear dark-palette hexes are estimated from screenshots (~2 RGB units off, not pixel-exact). Motion easing token names are mine; curves are correct, Linear's internal names may differ. Notion accent hexes are from current build CSS and stable.
