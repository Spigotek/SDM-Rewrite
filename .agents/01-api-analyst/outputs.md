# Outputs — API Analyst

Cieľový adresár: `docs/agents/api-analyst/`

| Cesta | Účel | Min. obsah |
|---|---|---|
| `endpoints.md` | Katalóg všetkých REST endpointov v scope | jeden H2 per endpoint, tabuľka parametrov, ukážka request/response |
| `endpoints.csv` | Strojovo čitateľný katalóg (pre PM/QA validáciu) | stĺpce: method, path, module, in_scope, auth_required |
| `schemas/index.ts` | Re-export všetkých typov | TS súbor, validný `tsc --noEmit` |
| `schemas/<entity>.ts` | TS typy pre jednu entitu (Incident, Request, ...) | `export interface ...` |
| `auth.md` | Autentifikačný flow (mermaid + tabuľka) | sekvenčný diagram + tabuľka endpointov auth |
| `gaps.md` | Operácie chýbajúce v REST | tabuľka: operácia, modul, dôvod, navrhovaný SOAP fallback alebo blocker |
| `soap-fallback.md` | Sumár SOAP operácií, ktoré budeme volať aj v novom FE | jeden H2 per operáciu |
| `versions.md` | Verzie API a kompatibilita s 17.4.x sub-releasmi | tabuľka |
| `multi-tenancy.md` | Ako CA SDM API reprezentuje tenanta + tenant kontext v volaniach | popis modelu, endpointy pre tenant listing, filter pravidlá |

## Kontrakt štruktúry `endpoints.md`

```markdown
## GET /caisd-rest/cnt/{id}
- **Modul**: Common (kontakty)
- **Auth**: REST access key (header `X-AccessKey`)
- **Path params**: `id` — string, contact UUID
- **Query**: ...
- **Response 200**: `Contact` (viď `schemas/contact.ts`)
- **Errors**: 401, 404
- **Notes**: ...
```

## Povinná záverečná sekcia v každom artefakte

Každý markdown artefakt zo zoznamu vyššie **musí končiť** sekciou
`## Otvorené závislosti` podľa kontraktu v `.agents/README.md`. PM ju parsuje
v refinement loope a podľa nej rozhoduje o opätovnej invokácii. Ak žiadne
flagy nemáš, napíš `Žiadne. Artefakt je samonosný.`.

## Validácia (PM)

- `endpoints.md` ≥ 50 endpointov pokrytých (heuristický minimum).
- `schemas/index.ts` musí prejsť `npx tsc --noEmit --strict`.
- `auth.md` obsahuje aspoň jeden ` ```mermaid` blok.
- `endpoints.csv` má všetky stĺpce vyplnené (žiadne prázdne `in_scope`).
