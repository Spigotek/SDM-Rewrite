# UI-only views — odvodené / agregované

> Tieto pohľady **nie sú** natívne entity v CA SDM REST API. UI ich agreguje
> z viacerých endpointov (alebo BFF, ak sa Architecture pre BFF rozhodne).
> Cieľom tejto sekcie je: identifikovať, kde UI doména rozširuje backend doménu
> o computed views, a stanoviť **freshness contract** (TTL, invalidation).
>
> Naming: všetky tieto typy sú v `model.ts` prefixované `Ui*`.

---

## `UiQueueItem` — položka v workspace queue

**Účel**: rýchle skenovanie zoznamu otvorených ticketov (Incident, Request,
Problem). UI ich zobrazuje v jednej tabuľke s prepínateľnou diskrimináciou.

**Zdrojové entity**: `Incident`/`Request`/`Problem` + denormalizované
`Contact.fullName`, `Group.name`, computed SLA badge.

```ts
type UiQueueItem = {
  // Diskriminátor
  ticketType: "incident" | "request" | "problem";
  // Identifikácia
  id: IncidentId | RequestId | ProblemId;
  ref: string;
  summary: string;
  // Triediteľné stĺpce (denormalizované — single-fetch UI)
  status: string;          // localized status name from BE
  priority: Priority;
  category: string | null;
  // Assignment (denormalizované — UI ukáže meno, nie ID)
  assigneeFullName: string | null;
  assignedGroupName: string | null;
  // SLA badge (computed v BE alebo BFF)
  slaState: "ok" | "at-risk" | "breached" | "paused";
  slaRemainingMs: number | null;
  // Activity recency
  lastActivityAt: string;  // ISO
  lastActivityType: string;
  // Tenant scope (vždy = activeTenant)
  tenantId: TenantId;
};
```

**Freshness contract**:
- TTL: 30s. Po expirovaní sa vyžiada refetch.
- Invalidation triggers: status change na ticket, assign event, nová activity.
- Zdroj: `GET /caisd-rest/in?status_active=true&tenant=...&fields=<minimal>`
  (resp. ekv. pre Request, Problem). Ideálne **single endpoint** ktorý
  podporuje `ticketType=any` filter, inak BFF aggregator.

---

## `UiTicketDetail` — detail tiketu (Incident/Request/Problem)

**Účel**: kompletný view tiketu so všetkými linkami a activity logom. Single
deep fetch (UI nezobrazuje detail kým nemá všetky sekcie).

**Zdrojové entity**: ticket + `affectedEndUser`, `requester`, `assignee`,
`group`, `affectedCi`, `linkedProblems`, `linkedChanges`, `linkedKbArticles`,
`attachments`, `activityLog`.

```ts
type UiTicketDetail<T extends Incident | Request | Problem> = {
  ticket: T;
  affectedEndUser: Contact | null;     // populated SREL
  requester: Contact | null;
  assignee: Contact | null;
  assignedGroup: Group | null;
  affectedCi: Ci | null;               // populated SREL
  linkedProblems: ProblemSummary[];    // light-weight subset
  linkedChanges: ChangeSummary[];
  linkedKbArticles: KbArticleSummary[];
  attachments: Attachment[];
  activityLog: ActivityLog[];          // chronological, paginated
  // Computed
  permissions: TicketPermissions;      // čo smie aktuálny user (transition allowed?)
  sla: SlaSnapshot;                    // pre detail header badge
};
```

**Freshness contract**:
- TTL: 60s pre static parts (ticket, contacts, CI). Activity log: streaming
  alebo poll 10s.
- Invalidation: vlastný update (immediate refetch), external update (long-poll
  / SSE — Architecture decision).
- Zdroj: ideálne **jeden BFF endpoint** ktorý vracia kompletný UiTicketDetail.
  Bez BFF: 4–6 paralelných REST volaní + UI assembly.

`*Summary` typy sú odlahčené — len `id`, `ref`, `summary`, `status`,
`priority`. Plný objekt sa fetchne až pri kliknutí na link (drill-down).

---

## `UiCiNeighborhood` — N-hop graf vzťahov okolo CI

**Účel**: CMDB visualizer-lite — pre incident impact analysis ("čo všetko
ovplyvní výpadok tejto DB?").

**Zdrojové entity**: `Ci` + tranzitívne uzávery cez `CIRelationship`.

```ts
type UiCiNeighborhood = {
  rootCi: Ci;
  // Subgraf
  nodes: CiNode[];                     // všetky CIs do hĺbky N
  edges: CiEdge[];                     // všetky relationships v subgrafe
  // Meta
  depth: number;                       // 1..3 (UI param)
  totalNodes: number;
  truncated: boolean;                  // ak limit prekročený
};

type CiNode = {
  id: CiId;
  name: string;
  class: CiClass;
  status: CiStatus;
  // Visual hint pre layout
  distanceFromRoot: number;
};

type CiEdge = {
  sourceId: CiId;
  targetId: CiId;
  type: RelationshipType;
};
```

**Freshness contract**:
- TTL: 5 min (CMDB sa mení pomaly).
- Invalidation: manuálne tlačidlo "Refresh" (neoplatí sa auto-poll).
- Zdroj: `GET /caisd-rest/co/{id}/related?depth=N` ak existuje, inak
  client-side BFS s limitom (Architecture decision).
- **Performance**: GOAL §5 hovorí o "rádovo desiatky položiek" — depth=2
  by mal stačiť. Pri high-fanout CI (napr. NetworkServer s 50+ klientmi)
  zobraziť aggregated badge ("+47 klientov"), nie zoznam.

---

## `UiKbSearchHit` — KB search výsledok

**Účel**: ranked list KB článkov so snippet-om a relevance score-om.

**Zdrojové entity**: `KbArticle` + search engine output (CA SDM `faq()` /
`search()` legacy SOAP, alebo REST equivalent).

```ts
type UiKbSearchHit = {
  article: KbArticleSummary;           // id, title, docTypeId, status, hits, buResult
  // Search-specific
  relevanceScore: number;              // 0..1
  snippet: string;                     // HTML s <mark> highlight, do 200 znakov
  matchedFields: ("title" | "summary" | "body" | "category")[];
  // Visibility hint
  isStale: boolean;                    // expiresAt prešiel ale stále PUBLISHED — analytik vidí, portál user nie
};

type UiKbSearchResponse = {
  hits: UiKbSearchHit[];
  totalCount: number;
  facets: {
    docType: Record<KbDocType, number>;
    category: Record<string, number>;  // categoryId -> count
  };
  query: {
    q: string;
    filters: KbSearchFilters;
  };
  tookMs: number;
};
```

**Freshness contract**:
- Žiadny cache na strane UI okrem facetov (5 min). Search je live.
- Pre rovnakú query string sa cache môže udržať 30s (stačí ak user páge-uje).

---

## `UiTenantSwitcher` — entry pre switcher

**Účel**: obal pre UI komponentu prepínača tenantov v top navigation.

```ts
type UiTenantSwitcherEntry = {
  tenant: Tenant;
  // Permission preview
  roleCount: number;                   // koľko rolí má user v tomto tenante
  primaryRole: RoleCode;               // "najsilnejšia" rola podľa policy
  // UI hint
  isDefault: boolean;
  isActive: boolean;                   // aktuálne zvolený
  // Recent activity (pre sortovanie / odporúčania)
  lastVisitedAt: string | null;        // ISO, persistované v user preferences
};
```

**Freshness contract**:
- TTL: session-level (refetch pri login alebo manual refresh).
- Invalidation: admin pridelí novú rolu (notification → refetch).

---

## `UiUserProfile` — kompletný session-level user state

**Účel**: jediný prefetch pri login, nie roztrieštené /me /tenants /roles
volania.

```ts
type UiUserProfile = {
  user: User;
  contacts: { primaryContact: Contact };
  tenants: UiTenantSwitcherEntry[];
  activeTenantId: TenantId;
  preferences: {
    locale: "sk" | "en";
    theme: "light" | "dark" | "system";
    queueDefaultFilter: QueueFilter;
  };
};
```

**Freshness contract**:
- Cache: session.
- Invalidation: explicit (settings change) alebo logout.

---

## `UiSlaSnapshot` — SLA agregát pre badge

```ts
type UiSlaSnapshot = {
  state: "ok" | "at-risk" | "breached" | "paused" | "stopped";
  // Pre countdown UI
  remainingMs: number | null;          // null pre "paused"/"stopped"
  // Konfigurácia
  threshold: { atRiskMs: number };     // pri ktorom remainingMs sa flipne na "at-risk"
  // Audit
  pausedReasons: string[];             // napr. ["awaiting_user"]
};
```

SLA computation logic je **server-side** (BE alebo BFF). UI iba renderuje
snapshot. Dôvod: SLA pravidlá závisia od policy + business hours per tenant —
duplicitná FE logika by sa rozišla s BE.

---

## `UiQueueFilter` — filter state pre queue

```ts
type UiQueueFilter = {
  ticketTypes: ("incident" | "request" | "problem")[];
  statuses: string[];
  priorities: Priority[];
  assigneeIds: UserId[] | "me" | "any";
  groupIds: GroupId[] | "myGroups";
  slaStates: ("ok" | "at-risk" | "breached")[];
  searchQuery: string | null;
  sortBy: "priority" | "openedAt" | "lastActivity" | "slaRemaining";
  sortDir: "asc" | "desc";
};
```

UI persistuje user-favorite filtre v `UiUserProfile.preferences`.

---

## Mimo MVP (post-MVP UI views)

Iba pomenovať, nedokumentovať:

- `UiChangeCalendar` — gantt-like view pre Change scheduling.
- `UiCabDashboard` — agregát všetkých `Change.APPR_PENDING` priradených
  prihlásenému CAB approveroci.
- `UiBulkOperationStatus` — progress per-ticket pri bulk update v queue.
- `UiKbAnalytics` — drilldown rating, hits, accepted_hits per autor.

## Otvorené závislosti

- `[01-api-analyst]` `UiQueueItem` predpokladá single endpoint cez všetky
  ticket-typy. Ak CA SDM REST nemá unified endpoint, BFF aggregator bude
  nutný. Potvrď.
- `[01-api-analyst]` Activity log streaming — long-poll, SSE, webhooks?
  Vplyv na `UiTicketDetail` freshness.
- `[01-api-analyst]` SLA computation — vystavuje BE snapshot priamo (jeden
  call), alebo musí UI agregovať? Aktuálny model predpokladá BE snapshot.
- `[04-architecture]` BFF rozhodnutie — ak BFF, väčšina týchto UI views je
  serverside aggregator. Ak direct REST, UI musí robiť per-view zložitejšiu
  orchestráciu (a freshness logic). Aktuálne návrh píšem agnosticky.
- `[02-ux-persona-analyst]` Potvrď zoznam MVP-required views: aktuálne sú
  v MVP `UiQueueItem`, `UiTicketDetail`, `UiKbSearchHit`, `UiTenantSwitcher`,
  `UiUserProfile`, `UiSlaSnapshot`, `UiQueueFilter`. `UiCiNeighborhood` —
  potvrď, či ho potrebujeme v MVP alebo až v1 (CMDB read v MVP, Visualizer
  v v1).
- `[06-tech-stack-selector]` Search snippet `<mark>` HTML rendering —
  framework-špecifický (React `dangerouslySetInnerHTML` vs. sanitization).
  Ovplyvní implementáciu `UiKbSearchHit.snippet`.
- `[09-qa-test-strategy]` Freshness contracts (TTL, invalidation triggers)
  sú test-able invariants. Prosím zahrň do test plánu.
