# Wireframe — Portal · Service Catalog browser

**Persona:** `requester_lucia`
**App:** `portal`
**URL:** `/catalog`
**Priorita:** P0

## Účel

Prehľadať dostupné services / požiadavky a vyplniť **dynamicky generovaný
formulár** pre konkrétnu položku. CA SDM Service Catalog má potenciálne
desiatky až stovky položiek — UI musí mať **rýchle hľadanie** a logické
kategórie.

## Low-fi wireframe — list view

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ [LOGO]  Acme HQ ▾   Service Desk         [SK ▾]  [🔔]  [👤 Lucia]       │
├──────────────────────────────────────────────────────────────────────────┤
│  ← Späť na domov                                                         │
│                                                                          │
│   Service Catalog                                                        │
│   Vyber službu, ktorú potrebuješ.                                        │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  🔍  Hľadať službu...    napr. "figma", "VPN", "monitor"           │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│  │ 💻 Hardvér    │ │ 🔧 Softvér    │ │ 🔑 Prístupy   │ │ 📋 Iné       │   │
│  │ 8 položiek   │ │ 24 položiek  │ │ 12 položiek  │ │ 5 položiek   │    │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘    │
│                                                                          │
│  ────────────────────────────────────────────────────────────────────    │
│                                                                          │
│   Najčastejšie žiadané                                                   │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  📐  Figma Professional License                                    │ │
│  │      Ročná licencia pre design tooling.                            │ │
│  │      ~ 2 dni vybavenie · vyžaduje schválenie manažéra              │ │
│  │                                                  [ Požiadať → ]    │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │  🔐  VPN prístup pre nového zamestnanca                            │ │
│  │      Setup VPN klienta na firemnom zariadení.                      │ │
│  │      ~ 1 deň · automatické po HR potvrdení                         │ │
│  │                                                  [ Požiadať → ]    │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │  💾  Externý disk (1 TB)                                           │ │
│  │      Šifrovaný externý disk pre projekty s veľkými dátami.         │ │
│  │      ~ 3-5 dní · vyžaduje schválenie manažéra                      │ │
│  │                                                  [ Požiadať → ]    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Low-fi wireframe — request item form (po kliknutí „Požiadať")

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  ← Späť na catalog                                                       │
│                                                                          │
│   📐  Figma Professional License                                          │
│   Ročná licencia. Schvaľuje manažér. Faktúra cez OPEX.                   │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                                                                    │ │
│  │  Pre koho je licencia? *                                           │ │
│  │  [ ● Pre mňa  ○ Pre kolegu ]                                       │ │
│  │                                                                    │ │
│  │  Trvanie licencie *                                                │ │
│  │  [ ▾ 12 mesiacov ▾ ]                                               │ │
│  │                                                                    │ │
│  │  Projekt / cost center *                                           │ │
│  │  [                                                            ]    │ │
│  │  ⓘ Napr. „Brand 2026" alebo cost center kód                        │ │
│  │                                                                    │ │
│  │  Schvaľovateľ *                                                    │ │
│  │  Tomáš Horváth (tvoj manažér) · auto-detected ⓘ                   │ │
│  │  [ zmeniť ]                                                        │ │
│  │                                                                    │ │
│  │  Komentár pre schvaľovateľa                                        │ │
│  │  [                                                            ]    │ │
│  │                                                                    │ │
│  │  ─────────────────────────────────────────────                     │ │
│  │  💰  Odhadovaná cena: ~ 180 € / ročne                              │ │
│  │  ─────────────────────────────────────────────                     │ │
│  │                                                                    │ │
│  │           [ Zrušiť ]                  [ Odoslať žiadosť → ]        │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

## UI prvky

| Prvok | Typ | Popis |
|---|---|---|
| Search bar | Input s ikonou | Fuzzy search across všetkých služieb (title + description + tagy). |
| Category tiles | Grid 4 columns | Hardvér / Softvér / Prístupy / Iné. Klik filtruje. |
| Featured list | Stack | Najčastejšie žiadané (sortované per tenant). |
| Item card | Link card | Klik → request item form. |
| Item form | Dynamic form | Polia generované zo `Request Item template`. |
| Approver auto-detect | Read-only field | Z user profile manager hierarchy. |
| Cost preview | Info banner | Ak je cena známa (catalog item field). |

## Form rendering

Polia sa renderujú dynamicky z CA SDM `Request Item` template. Podporované
typy polí (predpoklad — potvrdí 01):

- Text input (single-line)
- Textarea (multi-line)
- Number
- Date / DateTime
- Select / Combobox (single)
- Multi-select / Checkbox group
- Radio group
- File upload
- User picker (autocomplete na CA SDM users)
- CI picker (autocomplete na CMDB)

Validation rules zo schémy (`required`, `minLength`, `maxLength`, `pattern`,
`min`, `max`).

## Interakcie

- **Search ako-typing** — debounce 200 ms, výsledky live.
- **Klik na kategóriu** → list filtrovaný + breadcrumb („Catalog → Hardvér").
- **„Požiadať"** → modal alebo nová obrazovka s dynamickým formulárom (UX
  preferuje fullscreen, lebo formulár môže mať 10+ polí).
- **Submit** → status „Pending Approval" + redirect na ticket detail.

## Mobil

- Search fixed top.
- Kategórie ako horizontal scroll chips.
- Item cards single-column.

## Otvorené závislosti

- `[01-api-analyst]` `[GAP-1]` Service Catalog dynamic form schema —
  presná štruktúra Request Item template (REST endpoint + JSON schema).
  Bez toho UX nedokáže navrhnúť form rendering komponent. **Top priorita.**
- `[01-api-analyst]` Approver auto-detect endpoint — vystavuje CA SDM
  manager hierarchy v REST? Alebo to musí vyriešiť BFF cez LDAP?
- `[03-domain-modeller]` Approval flow state machine — multi-level
  approvers, parallel vs. sequential, escalation pri timeoute.
- `[07-design-system]` Card komponent (tile + featured) je opakovateľný
  pattern — tokens pre hover, focus, dark mode.
