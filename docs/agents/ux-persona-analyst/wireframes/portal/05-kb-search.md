# Wireframe — Portal · Knowledge Base — search a článok

**Persona:** `requester_lucia`
**App:** `portal`
**URL:** `/kb` (search), `/kb/article/:id` (detail)
**Priorita:** P0

## Účel

Žiadateľ hľadá riešenie skôr, než otvorí ticket. Search je **primary action**,
nie len doplnok. Článok je **mobile-friendly**, dá sa „lajknúť / dislajknúť"
(helpfulness signal pre KB editor).

## Low-fi wireframe — search

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ [LOGO]  Acme HQ ▾   Service Desk         [SK ▾]  [🔔]  [👤 Lucia]       │
├──────────────────────────────────────────────────────────────────────────┤
│  ← Späť na domov                                                         │
│                                                                          │
│   Pomocník                                                               │
│   Možno už mám odpoveď.                                                  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  🔍   VPN nefunguje doma                                          │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│   Hľadám v 142 článkoch...                                              │
│                                                                          │
│  ────────────────────────────────────────────────────────────────────    │
│                                                                          │
│   12 výsledkov                                                           │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  🔧 Reset VPN klienta                                              │ │
│  │  „...keď sa VPN nepripája doma, prvý krok je reset klienta..."    │ │
│  │  Connectivity · 124 ľuďom pomohol · 3 min čítania                 │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │  📡 Pripojenie na firemnú VPN z home office                        │ │
│  │  „Návod krok-za-krokom pre macOS, Windows aj Linux..."             │ │
│  │  Connectivity · 89 ľuďom pomohol · 5 min čítania                  │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │  ⚙ Ako overiť, či mám aktuálnu verziu VPN klienta                  │ │
│  │  „Otvor VPN klienta → About → version musí byť 5.x..."             │ │
│  │  Connectivity · 42 ľuďom pomohol · 1 min čítania                  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ────────────────────────────────────────────────────────────────────    │
│                                                                          │
│  Nenašla si, čo si hľadala?                                              │
│  [ Otvoriť ticket s týmto popisom →  ]                                   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Low-fi wireframe — článok detail

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  ← Späť na výsledky                                                      │
│                                                                          │
│   Reset VPN klienta                                                      │
│   Connectivity · Aktualizované 12. máj 2026 · 3 min čítania              │
│                                                                          │
│  ────────────────────────────────────────────────────────────────────    │
│                                                                          │
│   Kedy použiť tento článok                                               │
│                                                                          │
│   • VPN klient sa nepripája na home office                               │
│   • Po dlhšej prestávke (víkend, dovolenka) prestal fungovať             │
│   • Hláška „Could not establish secure connection"                       │
│                                                                          │
│  ────────────────────────────────────────────────────────────────────    │
│                                                                          │
│   Postup                                                                 │
│                                                                          │
│   1.  Zatvor VPN klienta z system tray (right-click → Quit).             │
│       [📷 screenshot-quit.png]                                            │
│                                                                          │
│   2.  Otvor Terminal (macOS) alebo PowerShell (Windows).                 │
│                                                                          │
│   3.  Spusť reset príkaz:                                                │
│       ┌──────────────────────────────────────────────┐                  │
│       │  $ vpn-cli --reset-config                    │  📋 kopírovať    │
│       └──────────────────────────────────────────────┘                  │
│                                                                          │
│   4.  Otvor VPN klienta znovu a prihlás sa.                              │
│                                                                          │
│   5.  Ak stále nefunguje, otvor ticket s popisom „VPN reset nepomohol".  │
│       [📩 Otvoriť ticket → ]                                              │
│                                                                          │
│  ────────────────────────────────────────────────────────────────────    │
│                                                                          │
│   Pomohol ti tento článok?                                               │
│   [ 👍 Áno ]   [ 👎 Nie ]      Komentár (voliteľné):  [           ]      │
│                                                                          │
│   Súvisiace články                                                       │
│   • Pripojenie na firemnú VPN z home office                              │
│   • Známe problémy VPN klienta verzie 5.0                                │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## UI prvky

| Prvok | Typ | Popis |
|---|---|---|
| Search bar | Input + ikona | Auto-focus na load. Debounce 300 ms. |
| Result count | Heading | „12 výsledkov" / „Nič som nenašiel". |
| Result card | Link card | Title + snippet (highlighted match) + meta. |
| Article body | Markdown render | Steps, code blocks, screenshots, callouts. |
| Code block | Pre + copy button | Klik → clipboard. Toast „Skopírované". |
| Helpfulness | 2 buttons + textarea | „Áno / Nie" + voliteľný komentár. |
| Related articles | List | Top 3 podľa rovnakých tagov. |
| Fallback CTA | Link | „Otvoriť ticket" — pred-vyplní kategóriu z tagu. |

## Search interakcie

- **Search live** — debounce 300 ms.
- **Empty state** — pri 0 výsledkoch UI musí ukázať „Nič som nenašiel" + CTA
  „Otvoriť ticket s týmto popisom →" (search query → ticket summary).
- **Autocomplete** (v1+, nie MVP) — návrhy z populárnych dotazov.
- **Highlight match** — match-ed slová v snippete tučne.

## Helpfulness signál

- Klik na 👍 — POST `/caisd-rest/kb/{id}/feedback` `{rating: positive}`,
  toast „Vďaka, pomôže to ostatným."
- Klik na 👎 — rozšíri sa textarea „Čo by si očakávala?" + submit. Toast
  „Vďaka za feedback, pošleme to autorovi."
- Anonymne na frontend — ale autentifikované na backende (audit kto kedy).

## Related articles

- 3 odporučené články z rovnakých kategórií / tagov.
- Klik → KB detail (preserves search query history → späť funguje).

## Edge cases

- **Článok existuje len v EN, profil je SK** — UI ukáže článok s badge
  „Iba v angličtine" namiesto skrývať / chybou.
- **Článok je v inom tenante (zdieľaný)** — visible badge „Zo zdieľanej KB",
  bez možnosti editácie cez portal.
- **Code block dlhší než viewport** — horizontal scroll inside block, copy
  button vždy viditeľný.

## Mobil

- Search bar fixed top.
- Article body single-column, code blocks majú native horizontal scroll.
- Helpfulness buttons full-width tap targets (≥ 44 px).

## Otvorené závislosti

- `[01-api-analyst]` Search endpoint — full-text search v CA SDM (`/caisd-rest/kb/search`)
  alebo musí to riešiť BFF cez DatabaseInstance views? Performance?
- `[01-api-analyst]` `[GAP-4]` KB feedback endpoint — vystavuje CA SDM
  REST endpoint pre helpfulness ratings? Inak BFF custom store.
- `[03-domain-modeller]` KB visibility scope (per tenant, shared, public)
  — state machine + UI implications.
- `[07-design-system]` Code block s copy button — opakovaný pattern,
  potrebuje token + a11y guidance.
