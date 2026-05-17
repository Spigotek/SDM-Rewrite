# ADR-02 — Monorepo tool

**Status**: accepted (potvrdené v r2 cross-konvergenciou s 06 + 08)
**Dátum**: 2026-05-15
**Autor**: 04-architecture agent (runId 20260508-192438, round 1+2)

## Changelog (round 2)

- Status povýšený z r1 (originálne bolo `accepted`, ostáva — len doplnená
  cross-validácia s peer agentmi).
- 06 v `tech-stack-selector/comparison.md` + `decision.md` potvrdil
  kompatibilitu s pnpm workspaces (žiadna kolízia).
- 08 v `devex-devops/repo-bootstrap.md` zafixoval pnpm 9 workspaces +
  Node 22 LTS — nepriamo potvrdzuje toto ADR.
- Doplnené: **Turborepo je over the top pnpm workspaces**, nie alternatíva.
  Pri ich rozdelení (pnpm = package manager; Turborepo = task orchestrator)
  sú vrstvy ortogonálne — Turborepo je remove-able bez vplyvu na dep
  resolution.
- Flagy uzavreté na `[resolved-in-round-2]` kde aplikovateľné.

## Kontext

Repo má dve SPA (`portal`, `workspace`), BFF, a 7 zdieľaných packages
(`@sdm/api-client`, `@sdm/api-types`, `@sdm/domain`, `@sdm/design-system`,
`@sdm/auth`, `@sdm/i18n`, `@sdm/utils`) — viď `monorepo-layout.md`. Potreby:

- **Workspace dependencies**: jedna verzia `@sdm/domain` zdieľaná medzi
  `portal`, `workspace` a `bff`.
- **Build cache**: ak sa nezmenil `@sdm/utils`, jeho consumer SPA nemusí
  rebuildovať utility chunk.
- **Task orchestrácia**: `pnpm build` musí stavať len to, čo sa zmenilo,
  v správnom poradí (typecheck → build → test).
- **Selektívny CI** — PR-y meniace len `apps/portal` nespúšťajú workspace
  testy.
- **Žiadny vendor lock-in** — chceme nástroj, ktorý je open-source, široko
  prijatý a nemá tendenciu zaviesť proprietárne API.

GOAL §11 NFR: jednoduchosť, stredne komplexné SPA, "rádovo desiatky"
položiek v queue — žiadne enterprise potreby na škálu (10k+ packages).

## Rozhodnutie

**pnpm workspaces + Turborepo**.

- **pnpm workspaces** — package manager + workspace protocol. `workspace:*`
  protocol pre internal deps, content-addressable store pre disk efficiency.
- **Turborepo** — task orchestrator + remote build cache. Cache key založený
  na hash file + dependency graf. Žiadny lock-in do proprietárneho jazyka
  (Turborepo config je JSON, žiadne `project.json` per package ako Nx).

## Dôsledky

**Pozitívne**:
1. **Disk efficiency** — pnpm content-addressable store, žiadny duplicate
   `node_modules` per package.
2. **Strict deps** — pnpm nedovolí "phantom deps" (package importuje, čo
   nedeklaroval). Pomáha v boundaries enforcement.
3. **Selektívny build** — `turbo run build --filter=portal` postaví len portál
   a jeho deps.
4. **Remote cache** — CI runs zdieľajú cache cez self-hosted backend
   (Turborepo má bezplatný self-hosted server). DevOps agent rozhodne, kde
   ho hostovať.
5. **Žiadny lock-in** — Turborepo config je tenký JSON. Ak by sme ho v
   budúcnosti chceli odstrániť, pnpm scripts ostávajú funkčné.
6. **Stable adoption** — pnpm + Turborepo má veľkú komunitu (vc, shadcn,
   tRPC, atď.), široko známe patterny.

**Negatívne**:
1. **Dva nástroje namiesto jedného** — pnpm pre dep management, Turborepo
   pre tasks. Tím musí pochopiť oba.
2. **Žiadny generator scaffolding** — Nx má `nx generate`, Turborepo nemá.
   Vyriešime cez templates v `tools/` (CLI script alebo `degit`).
3. **Pre on-prem customer install** — pnpm vyžaduje globálnu inštaláciu
   alebo `corepack enable` (Node 16+). DevOps agent zabezpečí v build image.

## Alternatívy

### A) Nx

**Prečo zamietnuté**:
- Nx zavádza `project.json` per package, executors (custom plugin systém),
  generators — veľký proprietárny ekosystem. Pre 9 packages + 3 apps je
  to overkill.
- Migrácia z Nx je notoricky drahá (Nx-specific veci sa rozsypú po repo).
- Default opinionated structure môže byť v rozpore s našou (P7: hranice
  packages explicitné). Nx síce má `enforce-module-boundaries` rule, ale
  je to bonus, nie kľúčový selling point.
- Performance Nx vs. Turborepo je porovnateľná pre náš scale (< 20 packages).

### B) Lerna

**Prečo zamietnuté**:
- Lerna je v "maintenance mode" (deprecated od 2022, prevzatý Nx). Žiadny
  budúci development.
- Žiadny task cache modernej kvality.

### C) Rush

**Prečo zamietnuté**:
- Microsoft-centric, menšia komunita.
- Vyžaduje `rush.json` + per-package `package.json` overrides — komplexnejší
  setup ako pnpm + Turborepo.

### D) Iba pnpm workspaces (bez Turborepo)

**Prečo zamietnuté**:
- Funguje pre 3 packages. Pri 9 packages + 3 apps `pnpm -r run build` síce
  funguje, ale nemá:
  - Topological dependency graph (musí byť deklarovaný v `dependencies` poliach).
  - Build cache (každý run rebuilduje všetko).
  - Selective task running pre CI (`--filter`).
- Vyriešiteľné cez vlastné scripts, ale Turborepo to dáva zadarmo.

### E) Bun workspaces

**Prečo zamietnuté pre MVP**:
- Bun ako runtime je atraktívny, ale ako package manager pre on-prem
  customer install má menej dokumentovaných deployment patternov ako pnpm.
- Bun workspaces nemajú equivalent k pnpm strict mode.
- Re-evaluate v v1 ak BFF (06 Tech Stack) zvolí Bun ako runtime.

## Otvorené závislosti

| # | Flag | Smer | Popis | Status |
|---|---|---|---|---|
| 1 | `turborepo-remote-cache-host` | → 08-devex-devops | Self-hosted Turborepo cache server URL pre CI. | open (operatívne — patrí 08 deployment) |
| 2 | `pnpm-version` | → 08-devex-devops | pnpm 9.x cez corepack. | `[resolved-in-round-2]` — 08 `repo-bootstrap.md` zafixoval pnpm 9. |
| 3 | `scaffolding-tool` | → 08-devex-devops | Náhrada za Nx generators. | open (08 vlastní `tools/` CLI strategy). |
