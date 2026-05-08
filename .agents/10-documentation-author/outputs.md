# Outputs — Documentation Author

Cieľový adresár: `docs/spec/` + samostatné top-level dokumenty v `docs/`.

## Per-modul špecifikácie

| Cesta | Modul | Zdroje (krížovo) |
|---|---|---|
| `docs/spec/incident-management.md` | Incident | 01 endpointy + 02 journeys + 03 lifecycle + 05 RBAC + 07 komponenty + 09 testy |
| `docs/spec/request-management.md` | Request + Service Catalog | rovnako |
| `docs/spec/problem-management.md` | Problem | rovnako |
| `docs/spec/change-management.md` | Change + CAB | rovnako |
| `docs/spec/knowledge-management.md` | KB | rovnako |
| `docs/spec/cmdb.md` | CMDB (CI + vzťahy) | rovnako |
| `docs/spec/multi-tenancy.md` | **Cross-cutting** | 01 tenant API + 03 Tenant entita + 05 tenant security + 04 ADR-11 |

### Štruktúra per-modul spec (max 5–8 strán)

```markdown
# <Modul> — špecifikácia

> Konsolidovaný spec pre vývoj. Zdrojové artefakty sú v docs/agents/.

## TOC
[auto]

## 1. Cieľ a scope (MVP / v1)
## 2. Persony, ktoré modul používajú
## 3. Kľúčové user journeys
## 4. Doménový model (entity, lifecycle)
## 5. REST API (endpointy v scope)
## 6. UI — obrazovky a komponenty
## 7. Bezpečnosť a RBAC
## 8. Testy a akceptačné kritériá
## 9. Otvorené body
## Zdroje
- docs/agents/api-analyst/endpoints.md#<anchor>
- docs/agents/ux/journeys.md#<anchor>
- ...

## Otvorené závislosti
[per kontrakt v .agents/README.md]
```

## Cross-cutting top-level dokumenty

| Cesta | Účel | Cieľová dĺžka |
|---|---|---|
| `docs/system-overview.md` | High-level tour: C4, stack, auth, dáta, branching | 6–10 strán |
| `docs/dev-handbook.md` | Vývojárska príručka — od špecu k implementácii | 8–12 strán |
| `docs/onboarding.md` | Day-1 quick start | 2–3 strany |

### `docs/system-overview.md` — sekcie

1. Čo to je a prečo (z GOAL.md)
2. C4 Level 1 + Level 2 (zo 04)
3. Tech stack (zo 06)
4. Auth + multi-tenancy (zo 05)
5. Dátové toky pre kľúčové journeys (zo 04)
6. Mock backend a dev environment (zo 08)
7. Branching a release model (zo 04 ADR + 08)
8. Linky na ďalšie dokumenty

### `docs/dev-handbook.md` — sekcie

1. Repo layout (zo 04 monorepo-layout + 08)
2. Coding conventions (zo 06 + 04)
3. Ako pridať nový feature — krok-za-krokom
4. Test strategy (zo 09 v skratke + linky)
5. CI/CD (zo 08)
6. ADR index (zoznam s 1-vetnými popisom + linky)
7. Riešenie typických problémov (FAQ)

### `docs/onboarding.md` — sekcie

1. Cieľ projektu (1 odsek z GOAL.md)
2. Repo clone + dev start (3–5 príkazov)
3. Kľúčové persony (krátke karty)
4. „Kde čo nájdem" — mapa repa a dokumentácie
5. Ďalšie kroky pre nového člena tímu

## Validácia (PM)

- Každý súbor existuje, > 1024 B, má H1 + TOC.
- Per-modul spec má všetkých 9 očakávaných H2 sekcií + `## Otvorené závislosti`.
- `system-overview.md` obsahuje aspoň 2 mermaid diagramy (C4 L1 + L2).
- `dev-handbook.md` obsahuje aspoň 1 očíslovaný step-by-step návod.
- `onboarding.md` má < 4 strany (cieľ kompaktnosť).
- Žiadny dokument neduplikuje > 200 znakov priamo z `docs/agents/` — povinné
  sú **odkazy** namiesto kopírovania.

## Povinná záverečná sekcia v každom artefakte

Každý markdown artefakt zo zoznamu vyššie **musí končiť** sekciou
`## Otvorené závislosti` podľa kontraktu v `.agents/README.md`. PM ju
parsuje pred otvorením PR. Ak žiadne flagy nemáš, napíš
`Žiadne. Artefakt je samonosný.`. Ak nájdeš kritickú inkonzistenciu,
vytvor flag s tagom adresovaným príslušnému 01–09 agentovi — PM môže
re-otvoriť refinement rundu.
