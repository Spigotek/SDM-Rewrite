# Wireframe — Portal · Domov / Dashboard žiadateľa

**Persona:** `requester_lucia` (a všetci end users)
**App:** `portal`
**URL:** `/` (po SSO redirect)
**Priorita:** P0

## Účel

Prvá obrazovka po prihlásení. Cieľ: za < 5 sekúnd nech používateľ vie, čo
môže urobiť a čo už urobil. **Nízka informačná hustota**, primárne action
buttons, sekundárny prehľad otvorených ticketov + KB highlights.

## Low-fi wireframe

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ [LOGO]  Acme HQ ▾   Service Desk         [SK ▾]  [🔔 2]  [👤 Lucia]      │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Ahoj, Lucia 👋                                                          │
│   Ako ti môžem pomôcť?                                                   │
│                                                                          │
│   ┌──────────────────────────┐  ┌──────────────────────────┐            │
│   │  🚨  Nahlásiť problém     │  │  🛒  Požiadať o niečo    │            │
│   │   Niečo nefunguje         │  │   Softvér, prístupy, HW  │            │
│   │                           │  │                           │            │
│   │           [Otvoriť →]     │  │           [Otvoriť →]    │            │
│   └──────────────────────────┘  └──────────────────────────┘            │
│                                                                          │
│   ┌──────────────────────────┐                                           │
│   │  📚  Pomocník (KB)        │                                           │
│   │   Možno už mám odpoveď    │                                           │
│   │           [Hľadať →]      │                                           │
│   └──────────────────────────┘                                           │
│                                                                          │
│  ────────────────────────────────────────────────────────────────────    │
│                                                                          │
│   Tvoje aktívne tickety  (3)                          [Vidieť všetky →]  │
│                                                                          │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │ #INC-1042  Notebook sa náhodne reštartuje                        │  │
│   │  ⏳ In Progress  ·  Anna prevzala  ·  Aktualizované pred 12 min   │  │
│   ├──────────────────────────────────────────────────────────────────┤  │
│   │ #REQ-308  Figma Professional License                              │  │
│   │  ⏸ Pending Approval  ·  Čaká na Tomáš (manažér)                  │  │
│   ├──────────────────────────────────────────────────────────────────┤  │
│   │ #INC-1018  Tlačiareň 4. poschodie nefunguje                       │  │
│   │  ✅ Resolved  ·  Pred 2 dňami  ·  „Overené, funguje"  [Zavrieť?]  │  │
│   └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ────────────────────────────────────────────────────────────────────    │
│                                                                          │
│   Možno hľadáš toto                                                      │
│   • Reset hesla pre VPN klienta                                          │
│   • Ako sa pripojiť na korporátnu Wi-Fi z mobilu                         │
│   • Odovzdanie zariadenia pri ukončení pracovného pomeru                 │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## UI prvky

| Prvok | Typ | Popis |
|---|---|---|
| Header bar | Layout | Logo, tenant switcher, jazyk, notifications, user menu. |
| Greeting | Heading | Personalizované meno + otázka („Ako ti môžem pomôcť?"). |
| Action cards | Card grid | 3 primárne akcie: Incident, Request, KB. |
| My tickets | List | Top 3–5 aktívnych tiketov, sort by `lastUpdated DESC`. |
| Ticket row | Link card | Klik → ticket detail. Status badge, last update, prevzal. |
| KB highlights | List | 3–5 článkov; preferenčne na základe nedávnych dotazov. |

## Interakcie

- Klik na action card → routing na príslušnú obrazovku (`/new-incident`,
  `/catalog`, `/kb`).
- Klik na ticket riadok → ticket detail (`/tickets/INC-1042`).
- Klik na KB highlight → KB článok view.
- Hover na status badge → tooltip s presným statusom + ETA (ak je k dispozícii).
- „Zavrieť?" akcia v resolved tickete — confirm dialog: „Potvrdiť uzavretie
  ticketu?" (žiadateľ môže zatvoriť svoj ticket cez self-service confirmation).

## Responzivita

- Desktop: 3 action cards v jednom rade.
- Mobil (≤ 640 px): action cards stacked vertikálne, ticket list bez tabulárneho
  layoutu, KB highlights v native list.

## Dáta (predpoklad — potvrdí 01)

- `GET /caisd-rest/tickets?requester={me}&status=active&sort=updated` →
  active tickets.
- `GET /caisd-rest/kb/recommended?user={me}` (ak existuje), inak
  `GET /caisd-rest/kb?featured=true`.
- Tenant scope cez header (rieši sa transparentne).

## A11y

- Action cards: `<button>` alebo `<a>` s `role="button"`, focus visible.
- Status badges: `aria-label="Status: In Progress, prevzala Anna, posledná
  zmena pred 12 minútami"`.
- Heading hierarchy: `<h1>` greeting, `<h2>` "Tvoje aktívne tickety" atď.

## Otvorené závislosti

- `[01-api-analyst]` Existuje endpoint pre **personalizované KB recommendations**
  (na základe role / nedávnych dotazov / kategórie užívateľa)? Inak fallback
  na statický „featured" zoznam.
- `[03-domain-modeller]` Status mapping CA SDM → user-friendly labels
  („Open" → „Otvorený", „Hold" → „Pozastavené", atď.). Definovať per modul.
- `[07-design-system]` Card komponent s ikonou + heading + body + action
  link je často používaný — vyžaduje token guidance (spacing, hover, dark
  mode).
