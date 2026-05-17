# ADR-10 — Build pipeline / bundler

**Status**: accepted (potvrdené 06 v r2)
**Dátum**: 2026-05-15
**Autor**: 04-architecture agent (runId 20260508-192438, round 1+2)

## Changelog (round 2)

- 06 v `tech-stack-selector/libraries.md` potvrdil **Vite 5 (s prechodom na 6
  až bude stable)** pre obe SPA. 08 `repo-bootstrap.md` adopuje Vite 5 v Phase C.
- ADR povýšený z `proposed` na `accepted`.
- BFF (Hono) v r2 finalizovaný ako Node bez bundleru (tsx watch v dev, plain
  `tsc --build` pre prod) — viď `components/bff.md` §2.5.
- Flagy `framework-plugin`, `bff-bundler`, `polyfill-strategy` uzavreté.

## Kontext

Obe SPA potrebujú modern bundler s týmito vlastnosťami:
- **Dev HMR** — fast feedback loop (< 200 ms reload pri zmene komponentu).
- **Code-splitting per route** (ADR-05).
- **Tree-shaking** Design System (ADR-04 — initial bundle < 200 kB portál).
- **CSS bundling** — Catppuccin-style custom properties (07 Design System
  finalizuje), nie Tailwind / CSS-in-JS (per `.claude/rules/10-tech-stack.md`).
- **Asset handling** — SVG icons (Lucide ekv.), fonts, screenshots.
- **TypeScript first-class** (P stack-wide).
- **ESM only** — žiadny CJS support v produkcii.

GOAL §5: browsery posledné 2 verzie evergreens, build target `ES2020`.

## Rozhodnutie

**Vite** ako preferovaná voľba pre obe SPA. 06 Tech Stack Selector finalizuje
po výbere UI framework-u.

Konfigurácia (per app):
- `vite.config.ts` v `apps/portal/` a `apps/workspace/`.
- Plugins: framework plugin (React / Vue / ekv. — 06), `vite-plugin-checker`
  (TypeScript + ESLint v dev), `vite-plugin-svgr` ekv. pre SVG icons.
- Build target `ES2020`.
- Output: `apps/<app>/dist/` — static `index.html` + assets.
- Chunking: `manualChunks` pre vendor split (react, design-system, query lib).

**BFF** používa vlastný bundler (typically `tsx` runtime alebo `esbuild`
build → Node.js). To je 06 Tech Stack Selector decision, nezávislé od SPA
Vite.

## Dôsledky

**Pozitívne**:
1. **Fast HMR** — Vite ESM-native dev server, no bundle in dev. Reload v 50–200 ms.
2. **Production build optimized** — Rollup pod kapotou, dobrý tree-shake.
3. **Plugin ekosystém** — framework agnostic core, široká voľba pluginov.
4. **CSS custom properties podpora natívne** — žiadny PostCSS overhead
   pre tokens (07 Design System bude tokens publikovať ako `:root` CSS vars).
5. **Konzistencia s `.claude/rules/10-tech-stack.md`** — Vite je preferovaný
   pre renderer bundling.
6. **Široká adopcia** — Vite je de-facto modern bundler 2024+.

**Negatívne**:
1. **Žiadny SSR out-of-box production** — Vite má SSR mode, ale my SSR
   nepotrebujeme (ADR-05).
2. **Module federation** nie je natívne (mali by sme zatvoriť dva apps
   do micro-frontend). Mitigácia: monorepo s `packages/` je naša cesta, nie
   module federation.
3. **Dev experience polyfillz** — niektoré legacy deps nemajú ESM. Vite
   ich pre-bundluje, ale občas treba `optimizeDeps.include`.

## Alternatívy

### A) Webpack

**Prečo zamietnuté**:
- Pomaly v dev (vyžaduje bundle, žiadny ESM dev server).
- Komplexný config (loaders + plugins) — väčšina developerov ho dnes
  obchádza cez `create-react-app` (deprecated).
- Vite je modern preemnik.

### B) esbuild / SWC priame

**Prečo zamietnuté ako primary**:
- Niža-úroveň, vyžaduje vlastný dev server. Vite ich používa pod kapotou.

### C) Parcel

**Prečo nezvolené**:
- Zero-config je atraktívne, ale pre náš case "explicit > implicit" princíp
  uprednostníme Vite config.

### D) Rspack (Rust-based webpack)

**Prečo nezvolené pre MVP**:
- Nový, menšia komunita ako Vite. Re-evaluate v post-MVP.

### E) Next.js / Nuxt / SvelteKit

**Prečo zamietnuté**:
- Tieto sú frameworky, nie bundlery. Vyžadovali by SSR (ADR-01 alt. D, ADR-05
  diskutuje).

## Otvorené závislosti

| # | Flag | Smer | Popis | Status |
|---|---|---|---|---|
| 1 | `framework-plugin` | (vlastné) | `@vitejs/plugin-react`. | `[resolved-in-round-2]` (React 19 pick). |
| 2 | `bff-bundler` | (vlastné) | BFF: žiadny bundler — `tsx` watch v dev, `tsc --build` v prod, `node --enable-source-maps`. | `[resolved-in-round-2]` (ADR-01 finalizoval Hono+Node). |
| 3 | `chunk-strategy` | → 08-devex-devops | `manualChunks` config — vendor split. Bundle visualizer + size-limit gate v CI vlastní 08. | open (operatívne) |
| 4 | `polyfill-strategy` | (vlastné) | Browser target `ES2020`, browserslist `last 2 Chrome versions, last 2 Firefox versions, last 2 Safari versions, last 2 Edge versions`. Žiadne polyfills. | `[resolved-in-round-2]` |
