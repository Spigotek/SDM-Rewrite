# Theming — light / dark / high-contrast

> Definuje, ako sa tokeny z [`tokens.md`](./tokens.md) prelínajú medzi témami.
> **Theme switching** funguje cez CSS custom properties (`--color-*`) na
> `<html data-theme="light|dark|hc">`. Žiadny FOUC pri prepínaní (theme
> persisted v localStorage + applied před React render cez inline script).

## 1. Súbor podporovaných tém

| Téma | `data-theme` | Pôvod | Použitie |
|---|---|---|---|
| Light | `light` (default) | systémový default | Bežné denné používanie |
| Dark | `dark` | systémové `prefers-color-scheme: dark` | Tmavá kancelária, neskorá zmena, agent po dlhom shift |
| High contrast | `hc` | systémové `prefers-contrast: more` alebo manual toggle | A11y need (low vision) |

**Auto-detect.** Pri prvom load: read `prefers-color-scheme` a `prefers-contrast`.
Po manuálnej zmene cez User menu → persist v localStorage. Manual override má prednosť.

## 2. Light theme (default)

**Hodnoty** sú už definované v [`tokens.md`](./tokens.md) sekciách 2, 3, 4.
Sumár load-bearing tokenov:

| Token | Hodnota | Použitie |
|---|---|---|
| `color.background.app` | `#F8FAFC` (slate-50) | Hlavné pozadie |
| `color.background.surface` | `#FFFFFF` | Karty, modaly |
| `color.text.body` | `#1E293B` (slate-800) | Body text |
| `color.text.secondary` | `#475569` (slate-600) | Meta |
| `color.brand.bg` | `#4F46E5` (indigo-600) | Primary CTA |
| `color.border.default` | `#E2E8F0` (slate-200) | Default borders |
| `shadow.xs` | `0 1px 2px 0 rgba(0,0,0,0.05)` | Card resting |

**Estetika.** Light + airy. Vrstvy: white (cards) > slate-50 (app bg) > slate-100
(subtle backgrounds). Borders sú clean slate-200, neagresívne.

## 3. Dark theme

Plný color inversion — nie low-contrast. Inšpirovaný Linear / Vercel dark.

| Token | Hodnota | Poznámka |
|---|---|---|
| `color.background.app` | `#0F0F11` (near-black, mild warm) | NIE pure #000 — pure black + Inter = too sharp |
| `color.background.surface` | `#18181B` (zinc-900) | Cards / modals — slightly elevated |
| `color.background.subtle` | `#27272A` (zinc-800) | Sidebar, code block bg |
| `color.background.hover` | `#3F3F46` (zinc-700) | Row hover |
| `color.background.selected` | `#1E1B4B` (indigo-950) | Selected row — brand tint |
| `color.background.overlay` | `rgba(0,0,0,0.65)` | Modal backdrop — denser than light theme |
| `color.text.primary` | `#F4F4F5` (zinc-100) | Headings |
| `color.text.body` | `#E4E4E7` (zinc-200) | Body |
| `color.text.secondary` | `#A1A1AA` (zinc-400) | Meta |
| `color.text.tertiary` | `#71717A` (zinc-500) | Placeholders |
| `color.text.disabled` | `#52525B` (zinc-600) | Disabled |
| `color.text.inverse` | `#FAFAFA` | Stays light on solid brand bg |
| `color.brand.bg` | `#6366F1` (indigo-500) | **Lighter** than light theme — better contrast on dark |
| `color.brand.bg-hover` | `#818CF8` (indigo-400) | Hover |
| `color.brand.fg` | `#818CF8` (indigo-400) | Brand text/icons |
| `color.border.default` | `#27272A` (zinc-800) | **Lower** opacity than light — dark theme borders splash less |
| `color.border.emphasis` | `#3F3F46` (zinc-700) | |

### Status colors v dark

Sémantické farby sa **prelínajú** — bg sa stáva tmavá variant, fg jasnejšia
(better contrast).

| Status | bg (dark) | fg (dark) | Kontrast fg/bg |
|---|---|---|---|
| success | `#052E16` (green-950) | `#4ADE80` (green-400) | 5.5:1 ✓ AA |
| warning | `#451A03` (amber-950) | `#FBBF24` (amber-400) | 7.1:1 ✓ AAA |
| danger | `#450A0A` (red-950) | `#F87171` (red-400) | 5.2:1 ✓ AAA |
| info | `#172554` (blue-950) | `#60A5FA` (blue-400) | 5.7:1 ✓ AAA |

### Shadows v dark

V dark theme **opacity sa zvýši**, pretože dark bg shadow "zožerie":

| Token | Light value | Dark value |
|---|---|---|
| `shadow.xs` | `0 1px 2px 0 rgba(0,0,0,0.05)` | `0 1px 2px 0 rgba(0,0,0,0.30)` |
| `shadow.sm` | `0 1px 3px 0 rgba(0,0,0,0.08), ...` | `0 1px 3px 0 rgba(0,0,0,0.40), 0 1px 2px -1px rgba(0,0,0,0.20)` |
| `shadow.md` | `0 4px 8px -2px rgba(0,0,0,0.08), ...` | `0 4px 8px -2px rgba(0,0,0,0.50), 0 2px 4px -2px rgba(0,0,0,0.25)` |
| `shadow.lg` | `0 12px 24px -6px rgba(0,0,0,0.10), ...` | `0 12px 24px -6px rgba(0,0,0,0.60), 0 4px 8px -4px rgba(0,0,0,0.30)` |
| `shadow.xl` | `0 20px 40px -12px rgba(0,0,0,0.15), ...` | `0 20px 40px -12px rgba(0,0,0,0.70), 0 8px 16px -8px rgba(0,0,0,0.40)` |

Alternatíva — niektoré frameworks v dark theme **vymieňajú shadow za border-top**
pre subtle elevation (Vercel Geist UI pattern). Decision: shadows zatiaľ
zachované, ale border-top elevation je acceptable variant pre subtle cards.

## 4. High-contrast theme (HC)

**Cieľová skupina.** Používatelia s low vision (znížená ostrosť, glaucoma,
cataracts). Cieľ: WCAG **AAA** contrast (7:1 text, 4.5:1 UI), žiadne shadows,
silné borders, vždy underline pri linkoch.

### Princípy

- **Žiadne shadows** — depth indikovaný cez border (color.border.emphasis 2 px).
- **Borders na všetkých interactive** — buttons, inputs, badges (≥ 2 px).
- **Focus ring 3 px solid** (nie blurred shadow ring).
- **Text contrast ≥ 7:1** — body text na app bg.
- **Severity colors zachované** ale s explicitnejším border-color tokens.
- **Žiadne semi-transparent overlays** — modal backdrop je solid (rgba(0,0,0,0.90)
  alebo CSS custom property hodnota plne nepriehľadná na HC).
- **Žiadne hover-only state changes** — focus state = hover state v HC.

### HC color values

| Token | HC light | HC dark |
|---|---|---|
| `color.background.app` | `#FFFFFF` | `#000000` |
| `color.background.surface` | `#FFFFFF` | `#000000` |
| `color.background.subtle` | `#F0F0F0` | `#1A1A1A` |
| `color.text.body` | `#000000` (kontrast 21:1) | `#FFFFFF` |
| `color.text.secondary` | `#1A1A1A` (kontrast 18:1) | `#F0F0F0` |
| `color.brand.bg` | `#1E1B4B` (indigo-950) | `#A5B4FC` (indigo-300) |
| `color.brand.fg` | `#1E1B4B` | `#A5B4FC` |
| `color.border.default` | `#000000` (2px) | `#FFFFFF` (2px) |
| `color.border.focus` | `#1E1B4B` (3px solid) | `#A5B4FC` (3px solid) |

### HC link rule

Všetky `<a>` linky majú `text-decoration: underline` aj v default state
(nie len hover). Underline thickness 2 px.

## 5. Theme switching implementácia

### CSS strategy

```css
:root,
[data-theme="light"] {
  --color-background-app: #F8FAFC;
  --color-text-body: #1E293B;
  /* … */
}

[data-theme="dark"] {
  --color-background-app: #0F0F11;
  --color-text-body: #E4E4E7;
  /* … */
}

[data-theme="hc"] {
  --color-background-app: #FFFFFF;
  --color-text-body: #000000;
  --shadow-xs: none;
  --border-width-default: 2px;
  /* … */
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
    /* dark theme tokens — auto-applied if user didn't pick manually */
  }
}

@media (prefers-contrast: more) {
  :root:not([data-theme]) {
    /* hc tokens */
  }
}
```

### FOUC prevention

Pred React render aplikuj theme:

```html
<script>
  (function() {
    var t = localStorage.getItem('theme');
    if (!t) {
      var prefersDark = matchMedia('(prefers-color-scheme: dark)').matches;
      var prefersHc   = matchMedia('(prefers-contrast: more)').matches;
      t = prefersHc ? 'hc' : (prefersDark ? 'dark' : 'light');
    }
    document.documentElement.setAttribute('data-theme', t);
  })();
</script>
```

Inline v `<head>` PRED bundle script tag → zero FOUC.

### Theme switcher UI

V `UserMenu` → "Vzhľad" submenu:

- ◯ Svetlý
- ◯ Tmavý
- ◯ Vysoký kontrast
- ● Podľa systému (default)

Toggle persists v `localStorage.theme = 'light'|'dark'|'hc'|null` (null = system).

## 6. Density theming

Density je orthogonal k color theme — kombinovateľné. `data-density="compact|default|comfortable"`
na `<html>` alebo per-app root (`<body data-app="portal">` → comfortable;
`<body data-app="workspace">` → compact).

| App | Default density | User toggle |
|---|---|---|
| portal | comfortable | nie (forced — kvôli mobile usage) |
| workspace | compact | áno (User menu → Density → Compact / Default / Comfortable) |

## 7. Per-tenant branding hooks

Niektorí enterprise tenants chcú custom logo / accent. Cez CSS variables:

```css
[data-tenant="acme-hq"] {
  --brand-mark: url("acme-hq-logo.svg");
  /* nepredávame accent override pre tenants — branding je globálny.
     Tenant má len logo lettermark replacement. */
}
```

**Decision** — accent (`color.brand.*`) **nie je** per-tenant override-able
v MVP. Konzistencia naprieč tenants > flexibilita. v1+ rozhodne PO ak vznikne
need.

## 8. Tenant environment color (independent layer)

Tenant env (production/staging/dev/sandbox) má svoje vlastné color tokens
(`color.env.production` ... ) — independent od theme. V dark theme tieto
colors sa upravia na lighter shades (pozri `tokens.json` `color.env.*`).

Vizuálne: tenant env badge je vždy viditeľný v top bar pri non-production
(staging / dev / sandbox), pretože "high-risk visual indicator" je security
concern (Peter Production approve vs. staging dry-run).

## 9. Test matrix

Per release validujeme cez Lighthouse + manual:

| Theme | Density | App | Test focus |
|---|---|---|---|
| light | comfortable | portal | Default Lucia experience |
| light | compact | workspace | Default Anna experience |
| dark | comfortable | portal | Evening user |
| dark | compact | workspace | Night shift agent |
| hc | comfortable | portal | A11y AAA pass |
| hc | compact | workspace | A11y AAA pass |
| dark | default | workspace | User density override |

Plus: `prefers-reduced-motion` × každá z 6 kombinácií (12 total).

## Otvorené závislosti

- `[06-tech-stack-selector]` CSS strategy — či pôjdeme do CSS custom properties
  (najjednoduchšie, work-out-of-box) alebo CSS-in-JS s typed tokens
  (Vanilla Extract, Stitches). Tokens sú framework-agnostic, ale tooling diff.
- `[06-tech-stack-selector]` Bundle inline FOUC-prevention script — či cez
  Vite plugin (inject pred build) alebo manuálne v `index.html`.
- `[08-devex-devops]` Visual regression baseline naprieč 6 (12) kombináciami —
  ktorá tooling (Percy, Chromatic, Playwright snapshots).
- `[09-qa-test-strategy]` Cross-theme visual regression v CI. Sample obrazovky:
  portal home, workspace queue, ticket detail.
- `[03-domain-modeller]` Per-tenant logo data shape — predpokladáme
  ` tenant.brand.logoUrl` v tenant config, validation rules (max size, mime).
- `[?]` Manual theme override má prednosť pred system pref. Otázka: re-detect
  system pref keď user nastaví na "Podľa systému" znovu — áno (live listener
  na `matchMedia` change).
