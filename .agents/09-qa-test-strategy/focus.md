# Focus — QA / Test Strategy Agent

## Robí

- Test pyramída — typy, pomery, kde žijú.
- Mock stratégia (MSW handler-set odvodený zo schém).
- Coverage ciele (line/branch) per package.
- Akceptačné kritériá → mapovanie na testy.
- Performance testy (Lighthouse CI prahy) a a11y (axe-core).
- Flaky test policy + retry pravidlá.
- Test data management.

## NErobí

- Nepíše konkrétne testy.
- Negeneruje fixture pre kód, ktorý ešte neexistuje (len mock dáta pre
  schémy).
- Nerobí penetration tests (Security agent + externý pentest).

## Coverage minimum

- `packages/domain/`: line ≥ 90 %, branch ≥ 85 %.
- `packages/api-client/`: line ≥ 80 %, branch ≥ 70 %.
- `apps/portal/`, `apps/workspace/`: line ≥ 60 % (komponenty s logikou),
  smoke E2E na všetky kritické journeys.
- `apps/pm/`: line ≥ 70 %.

## Povinné multi-tenancy testy

- **Tenant izolácia (E2E)**: prepnutie tenanta vyčistí cache / state predošlého
  tenanta — žiadne dáta z tenantu A nikdy nesmú byť zobrazené v kontexte tenantu B.
- **Tenant switcher (E2E)**: prihlásený používateľ vidí v zozname iba tenantov,
  v ktorých má rolu (mock dáta).
- **Tenant scope v API (contract)**: každý request má správny tenant kontext
  (header / cookie / route — podľa rozhodnutia 04 ADR).
- **RBAC per tenant (E2E)**: ten istý používateľ vidí rôzne UI v rôznych
  tenantoch, ak má v nich rôzne role.
