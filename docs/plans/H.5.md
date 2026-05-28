# H.5 — Portal: service catalog + new-request (DynamicForm)

> **Status**: ✅ DONE (2026-05-29)
> **Branch**: `chunk/H.5-portal-catalog` (merged, deleted)
> **PR**: #31 — merged squash via `--admin --delete-branch` > **Bundle outcome**: portal 162.16 KB / 180 KB (flat vs H.3); CatalogRoute lazy 3.74 KB + CatalogItemRoute lazy 14.62 KB.
> **Deviations**: new BFF `catalog.ts` (186 LOC) for `/api/catalog/items[/:id]` (CA SDM nemá native catalog); `date` field native input (DS DatePicker R-007 pending); `markdown-help` plain text (react-markdown deferred H.6); `file` placeholder (per H.3 attachments deferral); LHCI graduation reverted (staticDistDir 404 blocker).
> **Persona**: Lucia
> **Cieľ**: route `/catalog` (kategórie + featured items) + route
> `/catalog/:itemId` (DynamicForm rendered z JSON schema dodanej BFF) →
> submit `POST /api/requests`.

## Pivot vs ROADMAP

ROADMAP portal feature `service-catalog, new-request`. H.5 zaviazať
`ServiceCatalogRenderer` (G.1 placeholder, real impl tu) + RHF + Zod
schema build z `CatalogField[]`.

## Inputs

- **`docs/agents/ux-persona-analyst/wireframes/portal/03-service-catalog.md`** — autoritatívny (list + dynamic form).
- **`docs/spec/request-management.md`**.
- **`docs/agents/design-system/components.md` §ServiceCatalogRenderer, ServiceCatalogTile, ServiceCatalogItem, DynamicForm**.
- **`docs/agents/tech-stack-selector/libraries.md` §3** — `buildZodSchema(fields)` registry pattern.
- **`apps/bff/src/api/endpoints/requests.ts`** — `RequestCreateFe`.
- BFF musí poskytnúť `GET /api/catalog/items` + `GET /api/catalog/items/:id` (schema). **Verify v F.x; ak chýba, scope addition**.

## Outputs

```
apps/portal/src/routes/{catalog,catalog-item}.tsx
apps/portal/src/features/catalog/
├── CatalogRoute.tsx                           # list + categories + featured
├── CatalogItemRoute.tsx                       # DynamicForm
├── components/
│   ├── CategoryTiles.tsx
│   ├── FeaturedItemCard.tsx
│   ├── DynamicForm.tsx                        # schema-driven render
│   └── FieldRenderer.tsx                      # per-field-type dispatch
├── schema-builder.ts                          # buildZodSchema(fields) → ZodSchema
├── api.ts                                     # catalogItemsQuery, catalogItemQuery, postRequest
└── types.ts                                   # CatalogField, CatalogItem

apps/portal/lighthouserc.json                  # /catalog + /catalog/:itemId graduates
packages/i18n/catalogs/portal/{sk,en}.json     # +catalog.* keys (~20)
tools/browser-test/scenarios/h5-portal-catalog.spec.ts
```

## Done-when

- [ ] `/catalog` renders `CategoryTiles` (Hardvér / Softvér / Prístupy / Iné — 4 tiles, count per category) + `FeaturedItemCard` grid.
- [ ] `CategoryTile` click filters list to category.
- [ ] `/catalog/:itemId` renders item header + `DynamicForm` from schema (`GET /api/catalog/items/:id` returns `{ item, fields: CatalogField[] }`).
- [ ] `FieldRenderer` dispatches per type: text/textarea/number/date/select/multi/radio/checkbox/file/user-picker/ci-picker/markdown-help (per `components.md ServiceCatalogRenderer table`).
- [ ] `buildZodSchema(fields)` produces Zod schema; required fields marked.
- [ ] Submit → `POST /api/requests` with `{ catalogItemId, fields: {...} }`.
- [ ] Success → navigate `/tickets/REQ-X/success` (re-use H.3 SuccessScreen pattern alebo nový catalog-specific).
- [ ] Conditional fields (visibility per other field value) — `microcopy.md §13 aria-live`.
- [ ] LHCI: `/catalog` mobile TTI ≤ 2.2 s; `/catalog/:itemId` TTI ≤ 2.4 s (per `performance.md §2`).
- [ ] Browser test: pick category → click featured item → fill form → submit → verify success.

## Stratégia

1. **A**: List route (`CatalogRoute`) + tiles + featured cards.
2. **B**: Detail route (`CatalogItemRoute`) + `DynamicForm` + `FieldRenderer` + schema-builder.
3. **C**: Test + PR.

## Open questions

- **BFF catalog endpoints**: verify `GET /api/catalog/items` + `GET /api/catalog/items/:id` exist. Ak nie, **scope addition** (F.x has reference factories ale nie catalog/template aggregator). Mapping CA SDM `tpl_*` → CatalogField[].
- **User-picker / CI-picker**: async loadOptions cez `/api/users?q=` + `/api/cmdb?q=`. Reuse existing endpoints.
- **Markdown-help field type**: non-input, renders read-only Markdown — uses G.1 `<Markdown>`.

## Notes pre subagenta

- DynamicForm je **schema-driven** — registry pattern per `libraries.md §3`. NIE hardcoded fields.
- Reuse all G.1 form primitives.
- Subagent **NESMIE** merge own PR.
