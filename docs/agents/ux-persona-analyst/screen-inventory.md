# Screen inventory — SDM-Rewrite

> Súhrn všetkých obrazoviek pre obe aplikácie. Kombinuje **primárne**
> (5 + 5 wireframov, ktoré sú detailne navrhnuté) so **sekundárnymi**
> (existujú v navigácii / sú spomenuté v journeys, ale plné wireframy
> prídu v ďalších iteráciách alebo s Design System agentom).
>
> Tabuľka pomáha:
> - Architecture agentovi pochopiť rozsah routing-u a code-splitting.
> - Tech Stack agentovi odhadnúť počet komponent + form vs. table balance.
> - Design System agentovi inventarizovať opakovateľné patterny.
> - QA agentovi naplánovať test pyramidu.

## Portal (`portal.<org>`)

| # | Obrazovka | Route | Persona | Priorita | Wireframe | Hlavný interakčný pattern |
|---|---|---|---|---|---|---|
| P-01 | Domov / dashboard | `/` | requester_lucia | P0 | `wireframes/portal/01-home-dashboard.md` | Action cards + ticket list |
| P-02 | Nový ticket — Incident | `/new-incident` | requester_lucia | P0 | `wireframes/portal/02-new-ticket.md` | Lineárny formulár |
| P-03 | Service Catalog browser | `/catalog` | requester_lucia | P0 | `wireframes/portal/03-service-catalog.md` | Search + grid + dynamic form |
| P-04 | Detail môjho ticketu | `/tickets/:id` | requester_lucia | P0 | `wireframes/portal/04-ticket-detail.md` | Timeline + composer |
| P-05 | KB search + článok | `/kb`, `/kb/article/:id` | requester_lucia | P0 | `wireframes/portal/05-kb-search.md` | Search + markdown render |
| P-06 | Moje tickety (zoznam) | `/tickets` | requester_lucia | P0 (sek.) | (TBD — pattern je list verzia P-01) | Filtered list |
| P-07 | Notifikácie | `/notifications` (alebo dropdown) | requester_lucia | P1 | TBD | Notification list |
| P-08 | Profil + preferencie | `/profile` | requester_lucia | P1 | TBD | Form |
| P-09 | Login (SSO redirect) | `/login` | všetky | P0 | externe (IdP) | SSO redirect |
| P-10 | Tenant unavailable | `/tenant-error` | všetky | P0 | TBD (jednoduchý error state) | Error message |
| P-11 | Onboarding (first login) | `/onboarding` | requester_lucia | P2 | v1+ | Walkthrough |
| P-12 | Mobilný emergency approve | `/changes/:id/mobile-approve` | change_manager_peter | P1 | `wireframes/workspace/03-change-calendar.md` (mobile section) | Read + approve |

> Pozn.: P-12 je technicky pre `workspace`, ale na mobile zariadeniach sa
> reálny svet nedrží striktnej app divízie (Peter klikne notifikačný link
> a otvorí to v telefóne). Treba sledovať pri Architecture rozhodnutí —
> možná shared codepath.

## Workspace (`workspace.<org>` / `agent.<org>`)

| # | Obrazovka | Route | Persona | Priorita | Wireframe | Hlavný interakčný pattern |
|---|---|---|---|---|---|---|
| W-01 | Queue (inbox) | `/queue` | agent_l1_anna, agent_l2_marek | P0 | `wireframes/workspace/01-queue.md` | Dense table + bulk + filters |
| W-02 | Ticket detail (Incident/Request) | `/tickets/:id` | agent_l1_anna, agent_l2_marek | P0 | `wireframes/workspace/02-ticket-detail.md` | 3-pane + inline edit + composer |
| W-03 | Change calendar + Change detail | `/changes/calendar`, `/changes/:id` | change_manager_peter | P1 | `wireframes/workspace/03-change-calendar.md` | Calendar grid + approve flow |
| W-04 | KB editor (write/publish) | `/kb/editor/:id?` | kb_editor_jana | P1 | `wireframes/workspace/04-kb-editor.md` | WYSIWYG + lifecycle |
| W-05 | CMDB CI detail | `/cmdb/ci/:id` | cmdb_owner_robert, agent_l2_marek | P1 | `wireframes/workspace/05-cmdb-ci-detail.md` | Sticky header + tabs + graph |
| W-06 | Problem detail + RCA | `/problems/:id` | agent_l2_marek | P0 | TBD (variant W-02 s linked incidents) | 3-pane + linked records |
| W-07 | Problem list / queue | `/problems` | agent_l2_marek | P1 | TBD (pattern z W-01) | Dense table |
| W-08 | Change list (table view) | `/changes` | change_manager_peter | P1 | TBD (pattern z W-01 s calendar toggle) | Dense table + view toggle |
| W-09 | KB browse / list (workspace view) | `/kb` | kb_editor_jana, agent_l1_anna | P1 | TBD | List + filter |
| W-10 | KB analytics dashboard | `/kb/analytics` | kb_editor_jana | P2 | TBD | Charts + insights |
| W-11 | CMDB browse / search | `/cmdb` | cmdb_owner_robert | P1 | TBD (pattern: search + result table) | Search + table |
| W-12 | Reports / Saved views | `/reports` | všetky agentom roly | P2 | TBD | Filters + export |
| W-13 | Admin / settings (per tenant) | `/settings` | tenant admin (mimo MVP person) | P2 | TBD | Forms |
| W-14 | Profile + hot-key cheat sheet | `/profile`, `?` overlay | všetci | P0 (sek.) | TBD | Modal / settings page |
| W-15 | Login (SSO redirect) | `/login` | všetci | P0 | externe (IdP) | SSO redirect |
| W-16 | Tenant unavailable | `/tenant-error` | všetci | P0 | TBD | Error message |
| W-17 | Notifications drawer | dropdown / `/notifications` | všetci | P1 | TBD | Side drawer |
| W-18 | CAB meeting view (presenter mode) | `/changes/cab/:date` | change_manager_peter | P2 | TBD | Read-only big-screen layout |
| W-19 | Bulk operations confirm modal | modal cez W-01 | agent_l1_anna | P1 | TBD | Modal + progress bar |
| W-20 | Search (global) | `Cmd+K` overlay | všetci | P1 | TBD | Spotlight-style search |

## Spoločné komponenty (cross-app)

| Komponent | App | Wireframe | Popis |
|---|---|---|---|
| Tenant switcher | obe | `wireframes/shared/tenant-switcher.md` | Dropdown v top bare s zoznamom user-tenantov. |
| Header bar | obe | inline vo všetkých 5+5 wireframes | Logo, tenant, jazyk, notif, user. |
| Status badge | obe | inline | Color-coded chip pre status / priority / risk. |
| Notification bell | obe | TBD samostatný | Counter + drawer. |
| User menu | obe | TBD samostatný | Profile, prefs, sign out. |
| KB search bar | obe | súčasť P-05 a W-09 | Reusable search input. |
| Code block | obe | súčasť P-05 a W-04 | Pre + copy button. |
| Confirm dialog | obe | inline | Modal s 2 actions. |
| Toast / snackbar | obe | inline | Bottom-right success/error/info. |
| Empty state card | obe | inline (W-01 empty queue) | Icon + heading + helper text. |
| Loading skeleton | obe | inline | Shimmer placeholder per layout. |
| Error boundary fallback | obe | TBD | „Niečo sa pokazilo, skús refresh." |

## Pokrytie person × obrazoviek

| Persona | Primárne obrazovky | Sekundárne obrazovky |
|---|---|---|
| `requester_lucia` | P-01 .. P-05 | P-06, P-07, P-08, P-12 |
| `agent_l1_anna` | W-01, W-02, W-09 (KB read), W-14 (?) | W-17, W-19, W-20 |
| `agent_l2_marek` | W-01, W-02, W-06, W-05 (CMDB), W-04 (KB write — od v1) | W-07, W-09, W-20 |
| `change_manager_peter` | W-03, W-08, W-18, P-12 (mobile) | W-17 |
| `kb_editor_jana` | W-04, W-09, W-10 | W-17, W-20 |
| `cmdb_owner_robert` | W-05, W-11 | W-08 (cross-impact), W-17 |

## Priorita legenda

- **P0** — MVP must-have. Bez tejto obrazovky aplikácia nie je použiteľná pre
  primárny flow.
- **P1** — MVP / v1 (rozhoduje sa per persona scope) — funkcionalita, ktorú
  niektorí používatelia očakávajú, ale dokážeme ju doložiť v postupných
  vlnách.
- **P2** — v1+ (po MVP) — nice-to-have, čo bude rozšírenie.

## Otvorené závislosti

- `[04-architecture]` Routing stratégia — má každá obrazovka samostatný
  route, alebo niektoré sú modal-only? Inventory predpokladá routing-friendly
  default (deep-link share-able URL pre väčšinu).
- `[06-tech-stack-selector]` Code-splitting jednotky — wireframe inventory
  naznačuje hranice (calendar, graph viewer, WYSIWYG editor sú „heavy"
  chunks vhodné na lazy load).
- `[07-design-system]` Tabuľka „Spoločné komponenty cross-app" je inventory
  pre Design System — vyžaduje konsolidáciu do component library spec-u.
- `[09-qa-test-strategy]` Priority (P0/P1/P2) sú vstup do test plan
  rozsahu — P0 musia mať e2e coverage, P1 integration, P2 unit-only.
- `[?]` `agent_l1_anna` cross-tenant rola — ukazuje sa, že potrebuje
  prepínanie po dnoch zmeny rotácie. Je to skutočne tak (operations
  realita) alebo len prediagnostic — verifikovať s reálnym L1 ak možnost.
