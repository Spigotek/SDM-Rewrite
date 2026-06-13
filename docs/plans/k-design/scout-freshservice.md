# Scout: Freshservice (Crayons) & Zendesk (Garden)

Two ITSM/CX leaders, two very different aesthetics. Freshservice leans
**friendly-SaaS-cheerful** (greens, illustrations, rounded). Zendesk Garden
leans **calm-utilitarian-professional** (kale blue, restrained geometry).
SDM-Rewrite portal (Lucia) should borrow more from Freshservice; the agent
workspace (Anna) should borrow more from Garden.

## 1. Colour swatches

### Freshservice / Crayons (Freshworks)

Primary brand is the Freshworks green; product surfaces use cool greys.

| Token            | Hex                                                            | Use               |
| ---------------- | -------------------------------------------------------------- | ----------------- |
| Mint / brand 500 | `#19BCFE` (legacy Fresh blue) / `#12B76A` (Service Desk green) | Primary CTA       |
| Green 600        | `#039855`                                                      | Hover / focus     |
| Indigo accent    | `#2C5CC5`                                                      | Links, secondary  |
| Neutral 900      | `#12344D`                                                      | Body text         |
| Neutral 700      | `#475569`                                                      | Secondary text    |
| Neutral 200      | `#E2E8F0`                                                      | Borders, dividers |
| Neutral 50       | `#F8FAFC`                                                      | App background    |
| Surface          | `#FFFFFF`                                                      | Cards, panels     |
| Success          | `#10B981`                                                      | Resolved, OK      |
| Warning          | `#F59E0B`                                                      | Pending           |
| Danger           | `#E5484D`                                                      | Breached SLA, P1  |
| Info             | `#2E90FA`                                                      | Notices           |

> Caveat: Crayons has been refactored several times; exact hexes drift
> between v3/v4. Treat as accurate to ±2 on each channel.

### Zendesk Garden

Garden is built on **kale** (deep blue-green) as the brand spine plus a
named palette (each colour has 8 shades: 100–800).

| Token                         | Hex                | Use                   |
| ----------------------------- | ------------------ | --------------------- |
| Kale 700                      | `#03363D`          | Sidebar, agent chrome |
| Kale 800                      | `#01232B`          | Darkest neutral       |
| Blue 600                      | `#1F73B7`          | Primary CTA (default) |
| Blue 700                      | `#144A75`          | Hover                 |
| Grey 700                      | `#2F3941`          | Body text             |
| Grey 600                      | `#49545C`          | Secondary text        |
| Grey 300                      | `#D8DCDE`          | Borders               |
| Grey 100                      | `#F8F9F9`          | App background        |
| Green 600                     | `#038153`          | Success               |
| Yellow 600                    | `#AD5E18`          | Warning               |
| Red 600                       | `#CC3340`          | Danger                |
| Lemon / Mint / Pink / Crimson | full 100–800 ramps | Tag colours           |

Garden's hallmark is **named tag colours** (lemon, mint, pink, crimson,
royal, fuschia, azure) — useful for category chips on tickets.

## 2. Typography

**Freshservice / Crayons**

- Font family: **Inter** (web), fallback `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`.
- Scale (px / line-height):
  - `12 / 16` micro
  - `14 / 20` body (default)
  - `16 / 24` body-lg
  - `18 / 28` h4
  - `20 / 28` h3
  - `24 / 32` h2
  - `32 / 40` h1
- Weights: 400 body, 500 medium (buttons), 600 semibold (headings). Rarely 700.

**Zendesk Garden**

- Font family: **System UI stack** (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif`). Garden deliberately avoids shipping a webfont — perf first.
- Type scale (`@zendeskgarden/css-typography`):
  - `xs 10/16`, `sm 12/20`, `md 14/20`, `lg 16/24`, `xl 20/28`
  - Headings: `xxxl 36/44`, `xxl 28/36`, `xl 24/32`, `lg 20/28`, `md 16/24`, `sm 14/20`, `xs 12/16`
- Numeric weights: 400 / 600 / 700. Light (300) only for hero numbers in dashboards.

Take-away: **Inter for portal (Lucia)** matches the warmth target;
**system stack for workspace (Anna)** is faster and feels more "native tool".

## 3. Spacing & radius

| System         | Base unit | Scale                                           | Default radius                              |
| -------------- | --------- | ----------------------------------------------- | ------------------------------------------- |
| Freshservice   | 4 px      | 4, 8, 12, 16, 20, 24, 32, 40, 48, 64            | 6 px (cards), 4 px (inputs), 999 px (chips) |
| Zendesk Garden | 4 px      | xxs 4, xs 8, sm 12, md 20, lg 32, xl 40, xxl 48 | 4 px (default), 6 px (cards), 2 px (inputs) |

Both ladders are 4-px based. Freshservice tends to use **larger gaps on
portal pages** (24–32 px between cards) and **tight gaps in agent UI**
(8–12 px). Garden uses 20 px (`md`) as the workhorse — a slightly
unusual choice; produces a more "breathing" agent UI than 16 px.

## 4. Illustrations / warmth

**Freshservice** — heavy illustration footprint, on-brand:

- Style: **flat 2-D, soft rounded shapes, 2-tone gradients**, friendly characters with no facial detail, pastel palette aligned to the brand greens/mints. Illustrator-drawn (vector), not 3D.
- Where used:
  - Empty states ("No tickets yet — high five!")
  - Onboarding tour cards
  - Service catalog category headers (small spot illustrations)
  - Error pages (404, 500) — character with a coffee cup
  - Marketing dashboards
- Tone: cheerful, occasionally winking — not corporate.

**Zendesk Garden** — restrained, minimal:

- Style: **monochrome line illustrations** (single stroke weight, no fills), occasional accent colour from the kale/blue palette. Some products use abstract geometric shapes (folded paper, envelope, magnifying glass).
- Where used:
  - Empty queue states ("All caught up")
  - Help Center default theme hero
  - Sunshine/Explore onboarding
- Tone: calm, professional, "we know you're busy".

Take-away for SDM-Rewrite: **borrow Freshservice's flat 2-tone illustration
style for portal empty states and catalog headers**; keep workspace illustration-free or use Garden-style line icons only.

## 5. Three widget shapes worth borrowing (portal-biased)

### 5.1 Service-catalog tile (Freshservice)

```
+----------------------------------+
|   [icon]                         |
|                                  |
|   Request new laptop             |
|   Standard hardware request      |
|                                  |
|   ~ 2 day SLA   >                |
+----------------------------------+
```

- 240–280 px wide, 160 px tall, 6 px radius, 1 px border `#E2E8F0`.
- Icon top-left in a 40 px coloured square (category colour at 12% alpha bg + 100% fg).
- Hover: 2 px lift (`translateY(-2px)`) + shadow `0 4px 12px rgba(0,0,0,0.08)`.
- Click area is the entire card; chevron is decorative.

### 5.2 "My open ticket" status pill row (Freshservice + Garden hybrid)

```
+----------------------------------------------------+
| INC-1042   Email not syncing on iPhone             |
| [open] [P2] Updated 2h ago     Assigned: Anna K.   |
+----------------------------------------------------+
```

- Garden's named tag colours for status (`open=blue`, `pending=lemon`,
  `resolved=mint`, `closed=grey`) — 999 px radius, 11 px text, 600 weight.
- Border-left 3 px in priority colour (P1 red, P2 orange, P3 blue, P4 grey).
- Row-only hover state — no card chrome — so a list of 20 doesn't feel heavy.

### 5.3 "What can we help with?" hero search (Freshservice portal home)

```
+--------------------------------------------------+
|                                                  |
|     What can we help you with today?             |
|                                                  |
|   +------------------------------------------+   |
|   | [search-icon]  Search KB or services...  |   |
|   +------------------------------------------+   |
|                                                  |
|   Popular:  Wi-Fi   VPN   Password   Laptop      |
|                                                  |
+--------------------------------------------------+
```

- Centred hero, ~720 px wide max.
- Search input is **48 px tall, 8 px radius**, big icon, light shadow — feels like a Google Search input, not a form field.
- "Popular" chips below are clickable, prefill the search.
- This single widget converts catalog discovery dramatically — Lucia
  doesn't have to know whether her problem is a KB article or a request.

## 6. Service catalog patterns (Freshservice — critical for portal)

Freshservice's catalog is the gold standard for SDM-flavoured tools.
Structure:

1. **Browse by category** (left rail or top tabs)
   - Categories: Hardware / Software / Access / HR / Facilities / Other
   - Each category has an icon + colour pair (consistent across the app)
2. **Tile grid** (3-up on desktop, 2-up tablet, 1-up mobile)
   - Tile shape: see 5.1.
   - Filtered live by the hero search.
3. **Request form drawer** (slide-in from right, 480 px wide)
   - Opens when a tile is clicked — does NOT navigate to a new page.
   - Form fields are auto-generated from the service-item schema.
   - Footer: "Submit request" primary, "Save draft" tertiary, "Cancel" ghost.
4. **Submission confirmation**
   - Full-screen success state with **illustration** + "Request #SR-1042
     submitted" + "Track this request" link + auto-redirect after 8 s.

Zendesk's equivalent (Help Center) is more KB-heavy than catalog-heavy
and is less useful as a model for SDM portal.

Mapping to SDM-Rewrite:

- `apps/portal/src/pages/Catalog.tsx` → category tabs + search hero + tile grid
- Request drawer → reuse the existing drawer primitive from `packages/ui` if present; otherwise wrap `<dialog>` positioned right
- Schema-driven form from CA SDM `request_item` definitions (Lucia is read-only on schema, just renders)

## 7. Motion

**Freshservice**

- Page transitions: none (instant route swap). Inside the page, lots of micro-motion.
- Card hover: 150 ms ease-out, `translateY(-2px)` + shadow fade-in.
- Drawer slide: 220 ms cubic-bezier(0.16, 1, 0.3, 1) — Apple-style spring.
- Toast: bottom-right, slides up 180 ms, auto-dismiss 4 s, dismiss button visible.
- Skeleton shimmer: 1.4 s linear loop, very subtle (5% opacity gradient).

**Zendesk Garden**

- Motion tokens (`animation-duration-100/200/300`, easing `cubic-bezier(0.4, 0, 0.2, 1)`).
- Far more restrained — most state changes are **opacity-only**, no transform. Buttons don't lift. Toasts fade rather than slide.
- Drawer/modal: 200 ms fade + 4 px slide. No spring.

Take-away: **portal uses Freshservice motion (springy, lifty)**, **workspace uses Garden motion (subdued, opacity-driven)** — same codebase, different motion token set per app.

## 8. One concrete take-away for SDM-Rewrite

> **Adopt Freshservice's "Hero search + category tile grid + slide-in request drawer" pattern for the portal home page (Lucia).**

This single move replaces what is currently a tickets-list-as-landing-page
with a discovery surface that fits how Lucia actually thinks:
"I have a problem" → search → either find a KB article or open a request.
The catalog tile grid and slide-in drawer are mechanically simple
(CSS grid + a `<dialog>` element) and we already have everything in the
stack to build them. Add a few flat 2-tone illustrations for empty
states / category headers and the "school project" feeling is gone in
one chunk of work.

For workspace (Anna), keep the Garden-style restraint: kale-coloured
sidebar, named tag colours for ticket statuses, system-font typography,
opacity-only motion. The two apps **should not look like the same
product** — they serve different humans.

## Sources

- Freshworks Crayons design system: <https://crayons.freshworks.com> — tokens, typography scale, button motion. Last reviewed against v4.x.
- Zendesk Garden: <https://garden.zendesk.com> — kale palette, named tag colours, type scale, spacing tokens.
- Freshservice product UI: direct observation of the portal and agent app across 2023–2025 redesigns.
- Zendesk Support agent UI and Help Center theme defaults.

Uncertainty notes:

- Exact Crayons green hex shifted between v3 and v4; values above are
  the v4 set as of mid-2025.
- Garden's spacing-`md` was historically 20 px; some recent docs show
  16 px. If precision matters, check `@zendeskgarden/css-variables` in
  npm.
- Freshservice illustration set is not openly licensed — borrow the
  _style_, commission/redraw originals.
