# H.3 — Portal: new-incident form

> **Status**: ✅ DONE (2026-05-28)
> **Branch**: `chunk/H.3-portal-new-incident` (merged, deleted)
> **PR**: #30 — merged squash via `--admin --delete-branch` > **Bundle outcome**: portal 162.1 KB / 180 KB (+0.04 KB vs H.4); NewIncidentRoute lazy chunk 24.15 KB (RHF + zod contained).
> **Deviations**: Attachments deferred per user default — TODO + feature follow-up logged, no BFF endpoint augmentation. Radio group inline `<fieldset role="radiogroup">` (G.1 doesn't expose Radio primitive). LHCI kept `warn` per H.0/H.4 pattern.
> **Persona**: Lucia
> **Cieľ**: implementovať route `/new-incident` — RHF + Zod form (summary,
> description, priority, category, attachments) → submit `POST /api/incidents`
> → success obrazovka s ticket ID + link na ticket detail.

## Pivot vs ROADMAP

ROADMAP portal feature `new-incident`. H.3 zaviazať RHF + Zod stack
(potvrdený r2) + FileUpload primitive z G.1.

## Inputs

- **`docs/agents/ux-persona-analyst/wireframes/portal/02-new-ticket.md`** — autoritatívny.
- **`docs/spec/incident-management.md` §POST flow + lifecycle**.
- **`docs/agents/qa-test-strategy/acceptance-criteria.md` §portal-incident-broken-laptop (#1)`** — full journey AC.
- **`docs/agents/design-system/microcopy.md` §3 errors + §7 helper text**.
- **`apps/bff/src/api/endpoints/incidents.ts`** — `IncidentCreateFe` shape.
- **`packages/api-mocks/src/handlers/incidents.ts`** — MSW POST handler (E.1).

## Outputs

```
apps/portal/src/routes/new-incident.tsx
apps/portal/src/features/incidents/
├── NewIncidentRoute.tsx                       # { Component, action }
├── components/{NewIncidentForm,SuccessScreen}.tsx
├── schema.ts                                  # zodSchema for IncidentCreateFe
├── api.ts                                     # postIncident(payload) → Incident
└── hooks.ts                                   # useNewIncident (TQ mutation)

apps/portal/lighthouserc.json                  # /new-incident graduates warn → error
packages/i18n/catalogs/portal/{sk,en}.json     # +newIncident.* (~15 keys)
tools/browser-test/scenarios/h3-portal-new-incident.spec.ts
```

## Done-when

- [ ] `NewIncidentForm` uses `useForm({ resolver: zodResolver(newIncidentSchema) })` from `@hookform/resolvers/zod`.
- [ ] Fields: `summary` (TextField, required, max 100), `description` (TextArea, required, max 5000), `priority` (Select), `category` (Combobox), `attachments` (FileUpload, optional, max 5 files × 10 MB).
- [ ] Helper text per field — `microcopy.md §7` (e.g., "Krátka veta — detail napíš nižšie." pre summary).
- [ ] Submit → optimistic UI (button `loading` state) → `POST /api/incidents` → on success: navigate `/new-incident/success?id=INC-X` rendering `<SuccessScreen>` per wireframe §"Po odoslaní" — ticket ID + 3 CTAs (View ticket / Report another / Done).
- [ ] On 401 → redirect `/login`; on 4xx validation → inline field errors via RHF `setError`; on 5xx → toast s "Server teraz neodpovedá…" (`microcopy.md §3.2`).
- [ ] Attachments upload: multipart `POST /api/attachments` (existing F.x endpoint, alebo doplniť BFF endpoint).
- [ ] `pending-changes` register: form sa registruje ako dirty pri prvom input (per H.1 PendingChangesContext).
- [ ] LHCI portal `/new-incident` mobile: TTI ≤ 2.0 s, LCP ≤ 1.7 s, score ≥ 0.9.
- [ ] Browser test: fill form, submit, verify success screen + new ticket ID.
- [ ] i18n parity + `pnpm -r ... + size` green.
- [ ] ROADMAP toggle.

## Stratégia

1. **A**: Schema (Zod) + API + hook + route registration.
2. **B**: Form component (`@sdm/design-system` Form + FormField wrappers) + SuccessScreen.
3. **C**: Browser test + LHCI graduate + PR.

## Open questions

- **Attachments BFF endpoint**: F.x deferred binary upload to Phase H. Ak BFF nemá `POST /api/attachments`, **scope addition** — doplniť multipart streaming endpoint v BFF (verify v F.6 §23.6 documentation — endpoint je documented ale not implemented). Ak refactor je príliš veľký, defer attachments to feature follow-up + ship without.
- **Priority + category options**: BFF má reference endpoints (`/api/reference/pri`, `/api/reference/category`). Cache 15 min per F.2.
- **Anonymous incidents** (no logged-in user): out of MVP. Form requires session.

## Notes pre subagenta

- Reuse G.1 `Form` + `FormField` + `TextField` + `TextArea` + `Select` + `Combobox` + `FileUpload`.
- Reuse `microcopy.md §3.2` error messages — i18n keys: `errors.{required,tooShort,tooLong,...}`.
- Subagent **NESMIE** merge own PR.
