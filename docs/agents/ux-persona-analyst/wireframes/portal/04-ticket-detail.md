# Wireframe — Portal · Detail môjho ticketu

**Persona:** `requester_lucia`
**App:** `portal`
**URL:** `/tickets/:id`
**Priorita:** P0

## Účel

Žiadateľ vidí, **čo sa s ticketom deje** — status, kto ho má v rukách,
aktualizácie, môže pridať komentár alebo upresnenie.

## Low-fi wireframe

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ [LOGO]  Acme HQ ▾   Service Desk         [SK ▾]  [🔔]  [👤 Lucia]       │
├──────────────────────────────────────────────────────────────────────────┤
│  ← Moje tickety                                                          │
│                                                                          │
│   Notebook sa náhodne reštartuje                       #INC-1042         │
│                                                                          │
│   ┌─────────────────────────────────────────┬─────────────────────────┐ │
│   │  Status:    ⏳ In Progress              │  Otvorené: 14. máj 09:12 │ │
│   │  Pridelené: 👤 Anna Kováčová (L1)       │  Posl. update: pred 12 m │ │
│   │  Kategória: Hardvér                     │  Súrnosť: Medium         │ │
│   └─────────────────────────────────────────┴─────────────────────────┘ │
│                                                                          │
│  ────────────────────────────────────────────────────────────────────    │
│                                                                          │
│   Komunikácia                                                            │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  👤 Anna Kováčová · pred 12 minútami                                │ │
│  │  Ahoj Lucia, prevzala som ticket. Rezervovala som ti náhradný       │ │
│  │  notebook (model XPS-15), môžeš si ho vyzdvihnúť po 14:00 v IT      │ │
│  │  podpore (3. poschodie). Pôvodný odovzdaj na opravu.                │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │  👤 Lucia (ty) · pred 1 hodinou                                     │ │
│  │  Stalo sa to už 3-krát ráno. Black screen, potom logo, potom login. │ │
│  │  Posielám screenshot z BSOD.                                        │ │
│  │  📎 screenshot-error.png  (180 KB)                                  │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │  ⓘ  Ticket vytvorený · pred 1 hodinou                               │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Pridať komentár                                                   │ │
│  │  ┌──────────────────────────────────────────────────────────────┐  │ │
│  │  │ Napíš odpoveď alebo upresnenie...                            │  │ │
│  │  │                                                              │  │ │
│  │  └──────────────────────────────────────────────────────────────┘  │ │
│  │  📎 Pridať prílohu          [Zrušiť]  [Odoslať komentár →]         │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Stavy ticketu (visual variants)

```text
⏳ In Progress    — yellow badge, Anna prevzala
⏸ Pending Approval — orange badge, čaká na manažéra
✅ Resolved       — green badge, ponuka „Potvrdiť uzavretie / Reopen"
❌ Closed         — gray badge, read-only mode
```

## Resolved state — dodatočná sekcia

```text
┌────────────────────────────────────────────────────────────────────┐
│  ✅  Vyriešené pred 2 dňami                                         │
│                                                                    │
│  Riešenie od Anny:                                                 │
│  > Vymenený SSD disk, notebook funguje. Otestované 30 minút.       │
│                                                                    │
│  Funguje to? [ Áno, zatvoriť ]   [ Nie, otvoriť znova ]            │
└────────────────────────────────────────────────────────────────────┘
```

## UI prvky

| Prvok | Typ | Popis |
|---|---|---|
| Header | Title + ID | Veľký title (`summary`) + ticket ID. |
| Status box | Info grid | Status, assignee, kategória, časy. |
| Timeline | Comment list | Chronologické (najnovšie prvé), s ikonou autora a typu. |
| Comment composer | Textarea + button | Submit pridá public komentár (`tlog` v CA SDM). |
| Attachment preview | Inline | Obrázok thumbnail, PDF link, video player. |
| Resolution panel | Card | Iba pri `Resolved` state — confirm / reopen. |

## Interakcie

- **Komentár submit** → POST `/caisd-rest/tickets/{id}/log_comment`,
  optimistic UI render.
- **Reopen** → confirm dialog, prechod ticket-u do `Reopened` state, push
  notification assignee.
- **Confirm closure** → ticket sa presunie do `Closed`, ďalej read-only.
- **Refresh policy** — silent polling každých 30 s + manual refresh button.
  Pri zmene statusu toast „Status zmenený na X".
- **Šírenie do Slacku / e-mailu** — share link button (copy URL). Link je
  permission-gated (vyžaduje SSO + rolu v tenante).

## Edge cases

- **Ticket prevzal niekto, kto nie je v aktívnom tenante Lucie** — UI ukáže
  „Pridelené: Externý tím (Acme East)" namiesto mena (compliance).
- **Ticket je v inom tenante** než aktívny (Lucia klikla na link zo Slacku
  do iného tenantu) — UI ukáže „Tento ticket je v inom tenante (Acme East).
  Prepnúť?" + redirect cez tenant switcher.
- **Komentár dlhý 5000+ znakov** — soft warning „Dlhé komentáre môžu byť
  skrátené v notifikačných e-mailoch".

## A11y

- Timeline: `role="feed"` + `aria-busy` pri loading.
- Status badges majú `aria-label` so semantickým popisom.
- Komentár composer: `aria-multiline="true"`, `aria-required="false"`
  (komentár nie je povinný).
- Reopen / Close akcie: `aria-describedby` s confirmation textom.

## Otvorené závislosti

- `[01-api-analyst]` Komentár API — `tlog` (Time Log) je v CA SDM
  legacy SOAP. Existuje REST ekvivalent? Inak fallback cez SOAP (potrebné
  pre BFF rozhodnutie).
- `[01-api-analyst]` Real-time updates — má CA SDM webhook / SSE / push
  event endpoint? Inak polling (30 s).
- `[03-domain-modeller]` Reopen state machine — z `Resolved` späť do
  `Open` alebo nový `Reopened`?
- `[05-security]` Permission gating shared linkov — pri kliknutí mimo
  tenant scope kam redirect?
