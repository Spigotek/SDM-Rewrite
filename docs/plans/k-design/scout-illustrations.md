# Scout — Illustrations & Empty States

Scope: pick a single primary illustration source for SDM-Rewrite v1.1.4+ empty states, plus a lightweight icon fallback for ultra-minimal contexts. Bias: tiny inline-SVG set, CSS-custom-property themable, dark-mode-ready, open-source.

## 1. Survey

### unDraw (Katerina Limpitsouni)

- **Licence**: unDraw Licence — MIT-equivalent. Free for commercial use, no attribution required.
- **Style**: Flat 2D, single accent colour (everything else greyscale/neutral), human figures + objects, friendly but not childish.
- **Customisation**: Built-in colour picker on the site re-tints the accent colour at download time. SVG source uses literal hex values — one find/replace per file converts the accent to `currentColor` or a CSS var.
- **Format**: SVG (also PNG). Clean, optimisable with SVGO.
- **Weight**: ~5–15 KB raw per illustration, ~2–5 KB gzipped. Approximate.
- **Verdict**: Strongest match for SDM's tone — professional but warm, friendly enough for Lucia, neutral enough for Anna.

### Storyset by Freepik

- **Licence**: Freepik Free Licence — free with attribution; Premium removes attribution. Attribution requirement is awkward for a B2B product.
- **Style**: Four styles (Amico, Bro, Pana, Rafiki) — flat illustrative, large compositions, multi-colour. Animated variants available.
- **Customisation**: Per-element colour picker on the site, plus animation. SVG exports are large (multi-path).
- **Format**: SVG, PNG, animated SVG, Lottie.
- **Weight**: 30–80 KB per SVG raw — too heavy for our budget.
- **Verdict**: Attribution + weight kill it for a bundled-asset use case.

### Saly by Alyona Pak

- **Licence**: Free for personal & commercial use (custom licence on Figma Community).
- **Style**: 3D rendered characters, very on-trend, vibrant.
- **Customisation**: Effectively none post-export — they are rasterised 3D renders shipped as PNG/Figma assets. SVG exports are huge gradient meshes.
- **Format**: PNG (primary), Figma source, occasional SVG.
- **Weight**: 100–500 KB per PNG. Way over budget.
- **Verdict**: Wrong category — not themable, not single-colour, can't follow dark mode without a second export.

### Heroicons + lucide (monochrome line)

- **Licence**: Heroicons MIT (Tailwind Labs). lucide ISC.
- **Style**: Monochrome line icons (`currentColor` by default). Not illustrations — but at 96–128 px they read as minimalist empty-state visuals.
- **Customisation**: 100 % themable via `currentColor`; stroke width controllable.
- **Format**: SVG, React components (`lucide-react` already a dep).
- **Weight**: <1 KB per icon raw; tree-shaken in `lucide-react`.
- **Verdict**: Ideal fallback for ultra-minimal contexts (inline empty rows, compact panels) — already in the project.

### Open Peeps (Pablo Stanley)

- **Licence**: CC0 — public domain, no attribution.
- **Style**: Hand-drawn line illustrations of people, mix-and-match (head/body/accessories). Charming, sketchy.
- **Customisation**: Monochrome line + optional fill; recolourable via SVG editing. Single-colour body works well with `currentColor`.
- **Format**: SVG, PNG, Sketch/Figma libraries.
- **Weight**: 10–25 KB per composed illustration raw. Approximate.
- **Verdict**: Tone-wise too playful/sketchy for Anna's agent UI; great for Lucia but inconsistent across both personas.

### Humaaans (Pablo Stanley)

- **Licence**: CC BY 4.0 (attribution required).
- **Style**: Flat vector people, mix-and-match, multi-colour pastel palette.
- **Customisation**: Modular figures; recolouring requires editing many fills per file.
- **Format**: SVG, Sketch.
- **Weight**: 15–40 KB per composed scene raw. Approximate.
- **Verdict**: Attribution + multi-fill recolour cost rules it out.

### Tabler illustrations

- **Licence**: MIT (same project as Tabler icons).
- **Style**: Flat 2D, two-tone (primary + accent), small library (~30 illustrations as of last check).
- **Customisation**: Two CSS variables drive primary + accent fills — designed for themable apps.
- **Format**: SVG, React components.
- **Weight**: 4–10 KB raw per illustration. Approximate.
- **Verdict**: Excellent secondary candidate. Smaller catalogue than unDraw, but the themability is best-in-class.

### Blush (by Pablo Stanley & team)

- **Licence**: Free tier limited; full library is paid (Blush Pro).
- **Style**: Multi-collection (varies by illustrator); customisable on the site via the Blush editor.
- **Customisation**: Strong online editor, weak SVG-level customisation post-download.
- **Format**: SVG, PNG.
- **Weight**: 30–100 KB per SVG raw.
- **Verdict**: Paid tier + heavy SVGs disqualify it.

## 2. Recommendation

**Primary: unDraw.** Single-accent flat illustrations re-tint cleanly to any brand colour via one find/replace from the unDraw default `#6c63ff` to `currentColor` (or `var(--colour-illustration-accent)`). MIT-equivalent licence with no attribution requirement removes legal friction. Catalogue is huge (>2 500 illustrations) so all ten v1.1.4 empty states are covered without commissioning anything. Weight per asset (5–15 KB) keeps us inside the 30 KB total budget.

**Fallback: lucide-react (already a dep).** For compact empty states where a full illustration is overkill (inline list empties, modal empties, dense agent-workspace panels), render an oversized lucide icon (96–128 px) inside a tinted circle. Zero extra dependency, perfectly themable via `currentColor`, matches the existing icon vocabulary, and naturally follows dark mode through CSS vars.

## 3. Concrete asset list (v1.1.4)

unDraw search terms / canonical filenames below. Names follow `undraw_<slug>` convention; the slug is what appears in the file the site serves.

| #   | Empty state                                 | Persona | unDraw search / slug                              | Notes                                |
| --- | ------------------------------------------- | ------- | ------------------------------------------------- | ------------------------------------ |
| 1   | No open tickets (portal)                    | Lucia   | `undraw_relaxation` or `undraw_done_a-34`         | Friendly "all caught up" mood.       |
| 2   | No tickets assigned to me (workspace queue) | Anna    | `undraw_empty_inbox` / search `inbox`             | Neutral, professional.               |
| 3   | No KB articles found                        | both    | `undraw_no_data` or `undraw_empty`                | Pair with "Try a different keyword". |
| 4   | No catalog items in category                | Lucia   | `undraw_empty_cart` or `undraw_shopping`          | Catalog browse = shopping metaphor.  |
| 5   | No notifications                            | both    | `undraw_notify` / search `bell`                   | Mute-bell composition.               |
| 6   | No search results                           | both    | `undraw_not_found` / `undraw_searching`           | Magnifying-glass scene.              |
| 7   | No recent activity                          | both    | `undraw_calm_woman` or `undraw_empty_street`      | Quiet/idle mood.                     |
| 8   | Permission denied                           | both    | `undraw_security` or `undraw_access_denied`       | Locked-door / shield.                |
| 9   | Generic error                               | both    | `undraw_warning` / `undraw_bug_fixing`            | Caution-icon scene.                  |
| 10  | Offline / connection lost                   | both    | `undraw_server_down` or `undraw_signal_searching` | Disconnected-cable scene.            |

Slugs are best-effort from training-time knowledge; verify exact filenames on undraw.co at download time. If a slug 404s, the search term will return an obvious match.

## 4. Implementation notes

**Location**

```
packages/design-system/
└── illustrations/
    ├── EmptyTickets.svg
    ├── EmptyQueue.svg
    ├── EmptyKb.svg
    ├── EmptyCatalog.svg
    ├── EmptyNotifications.svg
    ├── EmptySearch.svg
    ├── EmptyActivity.svg
    ├── PermissionDenied.svg
    ├── GenericError.svg
    ├── OfflineLost.svg
    └── index.ts
```

**Authoring pipeline** (one-time, per asset):

1. Download SVG from undraw.co with the site colour-picker set to `#5d4dff`.
2. Run through SVGO with `removeViewBox: false`, `removeDimensions: true`, `convertColors: { currentColor: true }` for the accent fill — collapses the brand fill to `currentColor`.
3. Add `role="img"` and a Slovak/English `<title>` to the SVG root.
4. Commit raw `.svg` (not pre-rasterised).

**Import as React components** — use `vite-plugin-svgr` (Vite-native, zero runtime cost):

```ts
// vite.config.ts
import svgr from "vite-plugin-svgr";
plugins: [svgr({ svgrOptions: { titleProp: true, ref: false } }), react()];

// usage
import EmptyTickets from "@design-system/illustrations/EmptyTickets.svg?react";
<EmptyTickets aria-label="Žiadne otvorené tickety" style={{ width: 240, height: "auto" }} />
```

**Theming via CSS Custom Properties**

Inside the SVG, the accent fill becomes `currentColor`. The host component sets `color`:

```css
.empty-state__illustration {
  color: var(--colour-illustration-accent, var(--colour-primary-500));
  width: 240px;
  height: auto;
}

@media (prefers-color-scheme: dark) {
  :root {
    --colour-illustration-accent: var(--colour-primary-400);
  }
}
```

Neutral greys inside the illustration stay as-is (they read well on both light and dark backgrounds at default unDraw greys), or — if dark-mode contrast suffers — replace them with `var(--colour-illustration-neutral)` during SVGO post-processing.

**Accessibility**

- SVG root: `role="img"` + `aria-label="<Slovak description>"`.
- Decorative-only contexts: `aria-hidden="true"` and rely on the surrounding text.
- Provide a non-empty `<title>` child so VoiceOver/NVDA announce something useful.
- All empty-state composites: heading (`h2`/`h3`) + body copy + CTA must be reachable independent of the illustration.

**Lucide fallback pattern**

```tsx
import { Inbox } from "lucide-react";

<div className="empty-state empty-state--compact" role="status">
  <span className="empty-state__icon-circle">
    <Inbox size={48} strokeWidth={1.5} />
  </span>
  <p>Žiadne nové podania v rade</p>
</div>;
```

```css
.empty-state__icon-circle {
  display: inline-flex;
  padding: 16px;
  border-radius: 999px;
  background: var(--colour-primary-50);
  color: var(--colour-primary-500);
}
```

## 5. Bundle size budget

| Asset              | Raw SVG (approx) | Gzipped (approx)   |
| ------------------ | ---------------- | ------------------ |
| EmptyTickets       | 6 KB             | 2 KB               |
| EmptyQueue         | 5 KB             | 2 KB               |
| EmptyKb            | 4 KB             | 1.5 KB             |
| EmptyCatalog       | 6 KB             | 2 KB               |
| EmptyNotifications | 4 KB             | 1.5 KB             |
| EmptySearch        | 5 KB             | 2 KB               |
| EmptyActivity      | 5 KB             | 2 KB               |
| PermissionDenied   | 5 KB             | 2 KB               |
| GenericError       | 4 KB             | 1.5 KB             |
| OfflineLost        | 6 KB             | 2 KB               |
| **Total**          | **~50 KB raw**   | **~18 KB gzipped** |

Raw total exceeds the 30 KB target out-of-the-box. Reach the budget by:

1. Pick illustrations under 5 KB raw (most unDraw assets qualify after SVGO).
2. Run SVGO aggressively: `mergePaths`, `convertPathData: { floatPrecision: 1 }`, `cleanupNumericValues`. Typically saves 20–35 %.
3. Drop two illustrations in favour of the lucide-icon fallback (e.g. PermissionDenied + GenericError) — saves ~9 KB raw and matches the more terse error tone anyway.

Realistic post-optimisation target: **~28 KB raw / ~9 KB gzipped** — inside budget.

Vite-plugin-svgr emits the SVG as a React component, so the markup is inlined into the JS chunk. Route-split or lazy-load illustrations that only one page uses (e.g. `EmptyCatalog` only on `/catalog`) to keep first-paint chunks lean.

## 6. Lucide icon mapping for empty states

For inline / compact contexts, render at 48–96 px with `strokeWidth={1.5}` inside a tinted circular badge:

| Empty state               | lucide icon                      | Rationale                         |
| ------------------------- | -------------------------------- | --------------------------------- |
| No open tickets           | `Inbox`                          | Universal "inbox empty".          |
| No tickets assigned to me | `ClipboardList` or `ListChecks`  | Personal queue / task list.       |
| No KB articles            | `BookOpen` or `FileQuestion`     | Knowledge base.                   |
| No catalog items          | `PackageOpen` or `ShoppingBag`   | Catalog/products.                 |
| No notifications          | `BellOff`                        | Explicitly muted bell.            |
| No search results         | `SearchX` or `Search`            | Search-with-x is most expressive. |
| No recent activity        | `Activity` or `History`          | Pulse/timeline-empty.             |
| Permission denied         | `Lock` or `ShieldAlert`          | Access blocked.                   |
| Generic error             | `AlertTriangle` or `CircleAlert` | Standard caution.                 |
| Offline / connection lost | `WifiOff` or `CloudOff`          | Connection state.                 |

Pairing rule: full unDraw illustration on **dedicated empty-state pages** (e.g. `/tickets` with zero rows); lucide-icon badge in **embedded empties** (modals, sidebars, inline lists, dashboard widgets).

## Sources

- unDraw — https://undraw.co (Katerina Limpitsouni)
- Storyset — https://storyset.com (Freepik)
- Saly — https://www.figma.com/community/file/890095002328610853 (Alyona Pak)
- Heroicons — https://heroicons.com (Tailwind Labs)
- lucide — https://lucide.dev
- Open Peeps — https://www.openpeeps.com (Pablo Stanley)
- Humaaans — https://www.humaaans.com (Pablo Stanley)
- Tabler illustrations — https://tabler.io/illustrations
- Blush — https://blush.design (Pablo Stanley & team)
- vite-plugin-svgr — https://github.com/pd4d10/vite-plugin-svgr
- SVGO — https://github.com/svg/svgo

## Licence summary

- **unDraw** — unDraw Licence (MIT-equivalent; commercial use, no attribution). **Recommended.**
- **lucide** — ISC (commercial use, no attribution). **Recommended fallback.**
- Storyset — Freepik Free (attribution required) / Premium (no attribution, paid).
- Saly — Free for personal & commercial use (custom Figma Community licence).
- Heroicons — MIT.
- Open Peeps — CC0 (public domain).
- Humaaans — CC BY 4.0 (attribution required).
- Tabler illustrations — MIT.
- Blush — Mixed; free tier limited, full library paid.
