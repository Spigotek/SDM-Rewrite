# Outputs — Domain Modeller

Cieľový adresár: `docs/agents/domain/`

| Cesta | Účel | Min. obsah |
|---|---|---|
| `entities.md` | Agregáty + ich entity, atribúty, invarianty | jeden H2 per agregát, atribútové tabuľky |
| `relationships.md` | Vzťahy medzi agregátmi | mermaid ER diagram + tabuľka |
| `lifecycles/<entity>.md` | State machine per kľúčová entita | `stateDiagram-v2` per súbor |
| `glossary.md` | CA SDM pojem ↔ UI pojem ↔ DB tabuľka | tabuľka so 4 stĺpcami |
| `ui-views.md` | Odvodené / agregované UI viewy | popis + zdrojové entity + freshness |
| `model.ts` | Re-export typov + UI-only typové aliasy | TS súbor |

## Povinné lifecycles

- `lifecycles/incident.md`
- `lifecycles/request.md`
- `lifecycles/problem.md`
- `lifecycles/change.md`
- `lifecycles/kb-article.md`

## Povinné modely identity / tenancy

- `entities.md` musí obsahovať H2 `## Tenant`, `## User`, `## Role`
  a popísať vzťah User ↔ Role ↔ Tenant (mnoho-na-mnoho cez Role).
- `relationships.md` musí ukázať, ako tenant scope ovplyvňuje business entity
  (každá business entita má `tenant: Tenant` field).

## Povinná záverečná sekcia v každom artefakte

Každý markdown artefakt zo zoznamu vyššie **musí končiť** sekciou
`## Otvorené závislosti` podľa kontraktu v `.agents/README.md`. PM ju parsuje
v refinement loope a podľa nej rozhoduje o opätovnej invokácii. Ak žiadne
flagy nemáš, napíš `Žiadne. Artefakt je samonosný.`.

## Validácia (PM)

- `entities.md` má aspoň 6 H2 (po jednom per modul v scope).
- `lifecycles/` obsahuje aspoň 5 .md súborov, každý so `stateDiagram-v2` blokom.
- `glossary.md` má aspoň 30 riadkov tabuľky.
- `model.ts` prejde `npx tsc --noEmit --strict`.
