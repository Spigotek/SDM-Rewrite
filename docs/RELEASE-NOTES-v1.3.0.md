# Service Desk Management v1.3.0

**Service Desk Management v1.3.0** — "Live + Identity". Builds on v1.2.x
with brand visual identity, live SSE-driven notifications, and JSM-style
inline status transitions. Owner brief: "stále nie som spokojný s dizajnom
a komplexitou UI. Prekvap ma!". This is the surprise pass.

> Released 2026-06-14. Source tag: [`v1.3.0`](https://github.com/Spigotek/SDM-Rewrite/releases/tag/v1.3.0).
> Full changelog: [`docs/CHANGELOG.md`](./CHANGELOG.md).
> Phase L plan: [`docs/plans/L.1-v1.3.md`](./plans/L.1-v1.3.md).

## Three big surprises

### 1. Brand identity refresh

- **Designed SDM wordmark** — replaced the hardcoded `<span>SDM</span>` block
  with a `Wordmark` primitive. Two stacked rounded indigo squares
  (primary-500 front, primary-700 back, 4-px offset) + tightened "SDM"
  wordmark in Inter Variable 600 / -0.04em letter-spacing. GSAP entry
  on first mount (opacity 0→1 + scale 0.92→1 in 200 ms, then per-letter
  y stagger 30 ms). `prefers-reduced-motion` short-circuits to a static
  final state.
- **Brand gradient on portal home hero** — subtle radial indigo gradient
  (10 % alpha light / 18 % dark, capped 340 px tall) lifts the hero
  without dominating.
- **Serif accent on H1 headings** — Charter / Source Serif Pro / Iowan
  fallback chain (system serif, no new font @font-face). Applied to
  portal HeroGreeting H1, KB ArticleHeader H1, workspace Queue H1.
  Inter stays for everything else.
- **Count-up KPI ticker** — every KPI tile (3 in portal HeroStats, 5 in
  workspace QueueStats) animates its number from 0 to target on mount
  and on data refresh (gsap textContent tween, snap to integers,
  reduced-motion safe, defensive fallback).

### 2. Live notification center

The top-bar bell, hardcoded to 0 since v1.1.4, is now wired to the
J.3 SSE backend at `GET /api/events`:

- **`NotificationPopover` primitive** — 360-px anchored dropdown,
  GSAP fade+lift enter, document-level outside-click + Escape close.
  Contiguous same-ticket clustering (threshold 3 → "+N more"). Cap 10
  visible. Empty-state slot + mark-all-read + view-all footer.
- **`useNotifications` hook** in each app shell — feeds off the existing
  `EventSourceProvider`'s new `useAppEvents()` fan-out (single
  `EventSource` connection preserved). Maps J.3 event types
  (`tenant.suspended` → danger row, `session.expired` → warning row).
  Queue capped at 50; `lastReadAt` persisted per app in `localStorage`.
- **Bell UX** — real `<button>` with `aria-expanded` + `aria-haspopup`.
  Unread count badge from `useNotifications()`. Click toggles the
  popover. Ticket-level slots (`ticketRef` / `ticketHref`) wired in
  the primitive but currently unused — ready for the next BFF event
  expansion without DS changes.

### 3. JSM-style inline status transitions

K.1 brief §6.4 specified a "button" variant on `StatusBadge` where clicking
the lozenge opens an inline transition menu. K.2 / K.3 shipped the colour

- icon mapping but deferred the button mode. v1.3 ships it.

* **Extended `StatusBadge`** — new props: `transitionable`,
  `allowedTransitions`, `onTransition`, `disabled`. When transitionable,
  renders a `<button>` with a small chevron; click opens a popover menu
  listing allowed CA SDM transitions with their coloured dot + label +
  lucide icon. Keyboard nav (↑/↓, Enter, Escape). GSAP fade+lift enter,
  reduced-motion safe.
* **`CA_SDM_TRANSITIONS` lifecycle map** — exported constant documenting
  the legal next states for every lifecycle code (open → in_progress,
  resolved → closed / reopened, etc.).
* **Wired in workspace** — queue table rows, ticket detail header,
  problem detail header, change detail header. Mutations are optimistic
  (TanStack Query `onMutate` / rollback) + audited under the existing
  `data.<scope>.write` event with `details.op="status.transition"`
  (no new audit taxonomy per F.4 freeze).
* **Portal stays read-only** — customers don't change ticket status.

## Affected artefacts

- `ghcr.io/spigotek/sdm-{bff,portal,workspace}:1.3.0` (multi-arch
  `linux/amd64` + `linux/arm64`).
- Helm chart `oci://ghcr.io/spigotek/charts/sdm:1.3.0`.

## Deferred to v1.4+

- Backend `PATCH /api/<entity>/:id { status: ... }` endpoints — where
  the BFF doesn't yet accept the status patch, the FE shows a Toast
  ("Backend zatiaľ neumožňuje túto zmenu") and the UI is ready for
  catch-up.
- `GET /api/events?since=<lastReadAt>` for notification backlog
  hydration — fresh tabs currently start with an empty queue and fill
  as SSE pushes.
- `/notifications` route + the popover's "View all" link.
- Ticket-level SSE events on the BFF (notifications primitive already
  has the `ticketRef` / `ticketHref` slots wired).
- Real unDraw illustration downloads (placeholders ship since v1.2.0).
- Portal `/` mobile LHCI performance recovery (0.83 vs 0.88 floor).
- BFF `dueDate` + `slaState` projection onto `UiQueueItem` so the
  workspace "Po SLA" tile shows real numbers.
- HTTPS / reverse-proxy story (Service Worker still blocked on plain
  HTTP staging).

## Known limitations

Same as v1.2.x.
