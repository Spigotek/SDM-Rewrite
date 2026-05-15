# Test Data Management — SDM-Rewrite

## Changelog (round 2)

- r2: žiadna zmena vo factory taxonomy ani per-journey fixture štruktúre.
- Závislosti uzavreté: 06 r2 factory library (`@faker-js/faker@9.x` seeded),
  06 r2 schema validator (`zod@3.x`), 04 r2 tenant context (`X-CA-SDM-Tenant` header
  → `Tenant` domain entity je dostatočné; žiadny `TenantContext` composite
  v MVP).
- Self-flagy: realistic SK + EN sample texts pre i18n testy + backup fixture
  z reálnej CA SDM inštancie — pretrvávajú do post-conv (po sprístupnení staging).

> Stratégia pre fixtury, faktory a seedy testovacích dát. Cieľ:
> **deterministické**, **reprodukovateľné**, **kompozičné** dáta naprieč
> unit / integration / E2E.

## 1. Princípy

1. **Faktóry, nie ad-hoc literály.** Každý test, ktorý potrebuje `Incident`, ho vytvorí cez `makeIncident({ overrides })`.
2. **Sane defaults.** Default faktóry produkuje **validný** záznam — test prepíše len atribúty relevantné pre tento test.
3. **Seedovaný RNG.** UUID, datumy, IDs sú deterministic per test cez `@faker-js/faker@9.x` so `faker.seed(42)`. Žiaden `Math.random()`.
4. **Žiadny shared state medzi testami.** Fixture-y sú **imutabilné** objekty alebo factory funkcie — nie mutating proxy.
5. **Schémy sú zdroj pravdy.** Faktóry produkujú dáta kompatibilné s `docs/agents/api-analyst/schemas/*.ts` validované cez `zod@3.x`. Schema drift = factory drift.
6. **Realistický slovník.** Mená person (`Lucia`, `Anna`, `Marek`, ...) z `02-ux-persona-analyst/personas.md`, tenant názvy `Acme HQ`, `Acme East`, `Acme West`.

## 2. Faktóry — taxonómia

Lokácia: `packages/api-mocks/src/fixtures/` (zdieľaná medzi MSW handlers a
všetkými test layers, per 08 r2 `mock-strategy.md` + 04 r2 monorepo-layout).

### 2.1 Primitive factories (samostatné, bez závislostí)

| Faktor | Vracia | Default override pattern |
|---|---|---|
| `makeUuid(seed?: number)` | `string` (deterministic UUID-like) | `makeUuid(1) → "u00000000-0000-0000-0000-000000000001"` |
| `makeTimestamp(offset?: number)` | ISO timestamp, base `2026-05-15T08:00:00Z` | `makeTimestamp(3600) → "2026-05-15T09:00:00Z"` |
| `makeRefNum(prefix, n)` | `string` | `makeRefNum("INC", 1042) → "INC-1042"` |

### 2.2 Tenant + User + Role

```ts
makeTenant({ id?, name?, isServiceProvider? }) => Tenant
makeUser({ id?, username?, defaultTenantId?, roles? }) => User
makeRoleAssignment({ userId, roleCode, tenantId }) => RoleAssignment
makeAuthContext({ user, activeTenant }) => AuthContext  // pre testy s auth state
```

**Default tenanty** (pripravené v `fixtures/tenants.ts`):

| ID (deterministic) | Name | Typ | Použitie |
|---|---|---|---|
| `t-acme-hq` | Acme HQ | standard | Default tenant pre Luciu, Annu, Petra, Janu, Roberta |
| `t-acme-east` | Acme East | standard | Secondary tenant pre Luciu, Annu, Marka, Petra, Roberta |
| `t-acme-west` | Acme West | standard | Tertiary tenant pre Annu, Marka |
| `t-acme-sp` | Acme SP | service-provider | Špecial scenario — Service Provider tenant |

**Default users** (pripravené v `fixtures/users.ts`):

| ID | Persona ref | Default tenant | Roles |
|---|---|---|---|
| `u-lucia` | requester_lucia | t-acme-hq | EMPLOYEE (HQ, East) |
| `u-anna` | agent_l1_anna | t-acme-hq | LEVEL_1_ANALYST (HQ, East, West) |
| `u-marek` | agent_l2_marek | t-acme-hq | LEVEL_2_ANALYST + PROBLEM_MANAGER (HQ, East, West) |
| `u-peter` | change_manager_peter | t-acme-hq | CHANGE_MANAGER (HQ, East) |
| `u-jana` | kb_editor_jana | t-acme-hq | KNOWLEDGE_AUTHOR (HQ, East) |
| `u-robert` | cmdb_owner_robert | t-acme-hq | CONFIGURATION_ANALYST (HQ, East) |

### 2.3 Doménové entity

```ts
makeIncident({ status?, priority?, customer?, assignee?, tenant?, attachments? }) => Incident
makeRequest({ status?, requester?, approver?, tenant?, catalogItem? }) => Request
makeProblem({ status?, linkedIncidents?, rootCause?, tenant? }) => Problem
makeChange({ status?, type? /* "normal" | "emergency" */, scheduledWindow?, tenant? }) => Change
makeKBArticle({ status?, language?, visibility?, tenant?, body? }) => KBArticle
makeCI({ name?, type?, attributes?, relationships?, tenant?, sharedOwnership? }) => CI
makeAttachment({ size?, mimeType?, parentTicketId? }) => Attachment
makeServiceCatalogItem({ name?, dynamicFields?, autoApprove? }) => ServiceCatalogItem
makeAuditEvent({ category?, action?, actor?, result?, ... }) => AuditEvent
```

**Príklad — makeIncident default:**

```ts
function makeIncident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: makeUuid(),
    persistent_id: makeRefNum("in", overrides.id ?? 1),
    ref_num: makeRefNum("INC", overrides.id ?? 1042),
    description: "Sample incident description",
    summary: "Sample incident",
    active: 1,
    status: { "@COMMON_NAME": "Open" /* OP */ },
    type: "I",
    priority: 3,
    severity: 3,
    customer: "u-lucia",
    log_agent: "u-anna",
    assignee: "u-anna",
    tenant: "t-acme-hq",
    open_date: makeTimestamp(),
    last_mod_dt: makeTimestamp(),
    ...overrides,
  };
}
```

### 2.4 Aggregate factories (kompozícia)

```ts
makeQueue(items: number, opts?) => Incident[]        // pre workspace queue testy
makeRelationshipGraph(nodes: number, opts?) => CIRelationship[]  // pre CMDB graph testy
makeApprovalChain(steps: number) => ApprovalTask[]   // pre change approval testy
makeCrossTabSessions(tenants: TenantId[]) => Session[]  // pre cross-tab tenant tests
```

**Príklad — `makeQueue(12)` pre `workspace-incident-triage`:**

```ts
const queue = makeQueue(12, {
  tenant: "t-acme-hq",
  assignedGroup: "g-l1",
  categoryDistribution: { hardware: 4, software: 3, network: 3, access: 2 },
  priorityDistribution: { 1: 1, 2: 3, 3: 5, 4: 2, 5: 1 },
});
```

## 3. Per-journey fixture sets

Každý journey má vlastný fixture set (composes z primitív):

```
packages/api-mocks/src/fixtures/
├── journeys/
│   ├── portal-incident-broken-laptop.ts
│   ├── portal-request-software.ts
│   ├── portal-kb-self-help.ts
│   ├── workspace-incident-triage.ts
│   ├── workspace-incident-resolve-with-cmdb.ts
│   ├── workspace-incident-escalate-to-l2.ts
│   ├── workspace-problem-rca.ts
│   ├── workspace-cmdb-impact-analysis.ts
│   ├── workspace-incident-deep-dive.ts
│   ├── workspace-change-cab-prep.ts
│   ├── workspace-change-emergency-approve.ts
│   ├── workspace-change-cross-tenant-conflict.ts
│   ├── workspace-kb-author-new.ts
│   ├── workspace-kb-from-incident.ts
│   ├── workspace-kb-analytics-review.ts
│   ├── workspace-cmdb-ci-detail.ts
│   ├── workspace-cmdb-relationship-impact.ts
│   └── workspace-cmdb-cross-tenant-shared.ts
└── primitives/
    ├── tenants.ts
    ├── users.ts
    ├── incidents.ts
    ├── requests.ts
    ├── problems.ts
    ├── changes.ts
    ├── kb-articles.ts
    ├── cis.ts
    ├── attachments.ts
    └── audit-events.ts
```

Súbor `journeys/<journey-id>.ts` exportuje:

```ts
export const happyPath = { /* MSW responses for happy flow */ };
export const alternateFlows = {
  413_attachment_too_large: { /* ... */ },
  401_session_expired: { /* ... */ },
  // ...
};
```

## 4. Cross-tenant fixture matrix

Špeciálne fixture-y pre multi-tenancy testy (per 05 multi-tenancy-security
L1-L15 + acceptance-criteria §4.2):

| Fixture set | Popis | Použité v |
|---|---|---|
| `crossTenantUsers` | User s rolami v 2–3 tenantoch | C1, C2, C3, C4 v `acceptance-criteria.md`; všetky `@security:tenant-*` vectors |
| `crossTenantIncidents` | Tickety v každom tenante (10 v HQ, 5 v East, 3 v West) | tenant izolácia test, switch test |
| `serviceProviderContext` | User s SP rolou + 5 managed tenants | `@security:cross-tenant-view-sp` (#12), post-MVP per-tenant impersonation tests |
| `crossTenantCI` | CI shared between HQ + East | `workspace-cmdb-cross-tenant-shared` (#18) |
| `crossTenantChangeCalendar` | Changes scheduled v rôznych tenantoch overlapping | `workspace-change-cross-tenant-conflict` (#12) |
| `crossTenantAttachment` | Attachment v T1, request z T2 user | `@security:cross-tenant-attachment` (#18) — 404 expected |

## 5. Time freezing

CI default: **`TZ=UTC`**, base time `2026-05-15T08:00:00Z` (mid-week 08:00).

Per-test override cez fixture:

```ts
test.beforeEach(() => {
  vi.setSystemTime(new Date("2026-05-15T08:00:00Z"));
});
```

Pre journeys s explicitným kontextom času:

| Journey | Frozen time | Dôvod |
|---|---|---|
| `workspace-change-cab-prep` | Monday 08:00 | CAB prep flow |
| `workspace-change-emergency-approve` | 14:30 | Security advisory afternoon |
| `workspace-change-cross-tenant-conflict` | Friday 17:00 (looking at weekend windows) | Weekend window planning |
| `workspace-incident-resolve-with-cmdb` | Wednesday 09:00 | "Patch dnes 03:00" referencia |

## 6. Fixture management — anti-patterns

- **Žiadne fixture súbory > 200 riadkov.** Veľká fixture = neukrytá testovacia logika.
- **Žiadny `JSON.parse(JSON.stringify(...))` deep clone v teste** — použiť factory s overridom.
- **Žiadne fixture súbory v `__tests__/`** (test-local) — všetky fixture v `packages/api-mocks/src/fixtures/`.
- **Žiadne mock data hardcoded v MSW handler** — handler delegate na factory.
- **Žiadne dáta zo skutočnej CA SDM inštancie** v repe (compliance + GDPR).

## 7. Faker / random — kedy je OK

Pre **property-based testing** (state machines via `fast-check@3.x`) áno, ale
**vždy seeded**:

```ts
import { faker } from "@faker-js/faker";
faker.seed(42);  // deterministic per test file
```

Pre štandardné testy: **nie** — použiť explicit primitives.

## 8. Sample fixture — `portal-incident-broken-laptop`

```ts
// fixtures/journeys/portal-incident-broken-laptop.ts
import { makeIncident, makeAttachment } from "../primitives";

export const happyPath = {
  user: "u-lucia",
  activeTenant: "t-acme-hq",
  submitPayload: {
    summary: "Notebook sa náhodne reštartuje",
    description: "Po reštarte sa MacBook správa divno...",
    category: "hardware",
    customer: "u-lucia",
    attachment: makeAttachment({ size: 5_000_000, mimeType: "image/png" }),
  },
  expectedTicket: makeIncident({
    id: 1042,
    customer: "u-lucia",
    tenant: "t-acme-hq",
    status: { "@COMMON_NAME": "Open" },
  }),
};

export const alternateFlows = {
  413_attachment_too_large: {
    ...happyPath,
    submitPayload: {
      ...happyPath.submitPayload,
      attachment: makeAttachment({ size: 80_000_000 }),
    },
    expectedError: { status: 413, message: "Maximum 25 MB." },
  },
  401_session_expired: {
    ...happyPath,
    expectedError: { status: 401, message: "Session expired" },
    expectedDraftSavedInLocalStorage: true,
  },
};
```

## 9. Schema drift defense

Súbor `tools/test-fixture-validator.ts` v CI:

1. Pre každý factory funkcia spustí jeden call s default args.
2. Validuje output proti `zod@3.x` schéme odvodenej z `docs/agents/api-analyst/schemas/<modul>.ts`.
3. Fail → factory neaktuálna voči API analyst output.

Toto je **per PR CI step**, ktorý chytí drift skôr než sa rozšíri.

## Otvorené závislosti

- `[06-tech-stack-selector]` Voľba faktória knižnice — `[resolved-in-round-2]`
  (`@faker-js/faker@9.x` so seed=42 + light-weight custom factories v
  `packages/api-mocks/src/fixtures/primitives/`).
- `[01-api-analyst]` Schema validator — `[resolved-in-round-2]` (`zod@3.x`
  zdielané s `api-client` per 06 r2 libraries §3).
- `[04-architecture]` Tenant kontext fixture — `[resolved-in-round-2]`.
  `Tenant` doménovej entity je dostatočné (per ADR-11: `X-CA-SDM-Tenant` header,
  server-side authority v session; žiadny `TenantContext` composite v MVP).
- `[09-qa]` "Realistický slovník" pre random text content (popis incidentu,
  KB body) — momentálne stub strings. Round 2 → post-conv: doplniť SK + EN
  sample texts (realistic length, žiadne lorem ipsum) pre i18n testy.
  Self-flag.
- `[09-qa]` Backup fixture sady (po sprístupnení reálneho CA SDM) —
  record-and-anonymize prístup pre staging E2E. Self-flag pre post-conv.
