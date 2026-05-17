# Wireframe — Portal · Nový ticket (Incident formulár)

**Persona:** `requester_lucia`
**App:** `portal`
**URL:** `/new-incident`
**Priorita:** P0

## Účel

Žiadateľ otvorí ticket za < 60 sekúnd. Formulár je **lineárny, single-column**,
maximálne 5 polí. Žiadne CA SDM-specific terminológie (`affected service`,
`urgency_x_impact_matrix`) — len bežný jazyk.

## Low-fi wireframe

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ [LOGO]  Acme HQ ▾   Service Desk         [SK ▾]  [🔔]  [👤 Lucia]       │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ← Späť na domov                                                        │
│                                                                          │
│   Nahlásiť problém                                                       │
│   Povedz mi v krátkosti, čo sa deje. Helpdesk to dostane okamžite.       │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                                                                    │ │
│  │  1. Čoho sa to týka? *                                             │ │
│  │  ┌──────────────────────────────────────────────────────────────┐  │ │
│  │  │ ▾  Vyber kategóriu                                           │  │ │
│  │  └──────────────────────────────────────────────────────────────┘  │ │
│  │     • Hardvér (notebook, monitor, periférie)                       │ │
│  │     • Softvér                                                      │ │
│  │     • Sieť / VPN / Wi-Fi                                           │ │
│  │     • Účet / Heslo / Prístup                                       │ │
│  │     • Iné                                                          │ │
│  │                                                                    │ │
│  │  2. Stručný popis *                                                │ │
│  │  ┌──────────────────────────────────────────────────────────────┐  │ │
│  │  │ Notebook sa náhodne reštartuje                               │  │ │
│  │  └──────────────────────────────────────────────────────────────┘  │ │
│  │  ⓘ Krátka veta — detail napíš nižšie.                              │ │
│  │                                                                    │ │
│  │  3. Detail                                                         │ │
│  │  ┌──────────────────────────────────────────────────────────────┐  │ │
│  │  │ Od dnes rána sa mi notebook reštartuje pri otváraní Outlooku.│  │ │
│  │  │ Stalo sa to už 3-krát. Black screen, potom logo, potom login.│  │ │
│  │  │                                                              │  │ │
│  │  └──────────────────────────────────────────────────────────────┘  │ │
│  │                                                                    │ │
│  │  4. Prílohy                                                        │ │
│  │  ┌──────────────────────────────────────────────────────────────┐  │ │
│  │  │  📎  Pretiahni súbory sem alebo [vyber zo zariadenia]        │  │ │
│  │  │      Max 25 MB · obrázky, PDF, video                         │  │ │
│  │  └──────────────────────────────────────────────────────────────┘  │ │
│  │  • screenshot-error.png  (180 KB)  [✕ odstrániť]                  │ │
│  │                                                                    │ │
│  │  5. Súrnosť                                                        │ │
│  │   ○ Nemôžem pracovať                                               │ │
│  │   ● Pracujem, ale s problémami                                     │ │
│  │   ○ Drobnosť, nie je to akútne                                     │ │
│  │                                                                    │ │
│  │   ─────────────────────────────────────────────────────            │ │
│  │   Tvoj kontakt: lucia.novak@acme.sk · ext. 4287   ⓘ z profilu     │ │
│  │                                                                    │ │
│  │   [ Zrušiť ]                            [ Odoslať ticket → ]       │ │
│  │                                                                    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## UI prvky

| # | Prvok | Typ | Validácia |
|---|---|---|---|
| 1 | Kategória | Select / Combobox | Required. |
| 2 | Stručný popis | Text input (max 120 znakov) | Required, > 5 znakov. |
| 3 | Detail | Textarea (auto-resize) | Optional (urgent prípady). |
| 4 | Prílohy | Drag-drop + button | Max 25 MB total, types: img/pdf/video/log. |
| 5 | Súrnosť | Radio group (3 levels) | Required, default: middle. |

## Po odoslaní (success obrazovka)

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   ✅  Ticket #INC-1042 odoslaný                                           │
│                                                                          │
│   Helpdesk to dostane okamžite. Pošleme ti notifikáciu, keď niekto       │
│   prevezme ticket alebo bude mať otázku.                                 │
│                                                                          │
│   Status: New                                                            │
│   ETA prevzatia: do 2 hodín (typický čas pre stredne urgentné)           │
│                                                                          │
│   [ Zobraziť detail ticketu →  ]   [ Vrátiť sa na domov ]                │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Interakcie

- **Auto-save draft** — pri zmene poľa sa draft ukladá do `localStorage`
  každých 5 s. Pri obnovení obrazovky banner: „Obnoviť draft z 14:32?".
- **Submit** — zablokovaný, kým nie sú vyplnené required polia. Hover na
  disabled button → tooltip „Vyplň kategóriu a popis".
- **Validation** — inline pod každým poľom (`Required` → `"Toto pole je
  povinné"`). Žiadny modal alert.
- **File upload progress** — bar pod upload zónou. Pri zlyhaní (413, virus
  scan fail) inline error pri konkrétnom súbore.
- **Cancel** — confirm dialog ak je formulár čiastočne vyplnený („Stratíš
  rozpracovaný draft. Pokračovať?").

## Mapping na CA SDM

| UI pole | CA SDM atribút |
|---|---|
| Kategória | `category` (mapping: Hardvér → `Hardware`, Sieť → `Connectivity`, …) |
| Stručný popis | `summary` |
| Detail | `description` |
| Prílohy | Attachments API (`/caisd-rest/attmnt`) |
| Súrnosť | `urgency` (1=Nemôžem, 2=Drobnosti — invertovaná škála CA SDM) |
| Kontakt | `affected_contact` z profilu (read-only, predvyplnený) |
| Tenant | implicitne z aktívneho tenant kontextu |
| Type | implicitne `Incident` |

## A11y

- Required polia: `aria-required="true"` + viditeľná hviezdička.
- Inline errors: `role="alert"` + spojené s poľom cez `aria-describedby`.
- Radio group: `role="radiogroup"` + `aria-labelledby` na groupe.
- Submit button počas API requestu: `aria-busy="true"` + viditeľný spinner.

## Edge cases

- **Pridanie 80 MB videa** → 413 backend error. UI zobrazí tooltip a ponukne
  „Skús kompresiu / krátky GIF / textový popis".
- **Strata pripojenia pri submite** → retry na pop-upe „Bez pripojenia.
  Skúsiť znova?".
- **Tenant prepnutie počas vyplňovania** → confirm dialog (viď
  `wireframes/shared/tenant-switcher.md`).

## Otvorené závislosti

- `[01-api-analyst]` Mapping kategórií Portal → CA SDM `category` —
  potrebujem zoznam validných hodnôt z CA SDM (per tenant možná konfigurácia).
- `[03-domain-modeller]` Urgency → CA SDM urgency mapping a state machine
  („New" → „Open" trigger).
- `[05-security]` Attachment scan policy — virus scan je sync (block submit)
  alebo async (povoliť submit, scan na backend, prípadne neskôr odstrániť)?
  Ovplyvňuje UX submitu.
