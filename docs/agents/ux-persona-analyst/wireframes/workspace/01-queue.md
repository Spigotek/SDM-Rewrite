# Wireframe — Workspace · Queue (agent inbox)

**Persona:** `agent_l1_anna`, `agent_l2_marek`
**App:** `workspace`
**URL:** `/queue` (default po prihlásení)
**Priorita:** P0

## Účel

Hlavná pracovná plocha agenta. **Vysoká informačná hustota**, klávesnicovo
prvotriedne, sticky filtre, zachovanie scroll pri otváraní detailov v split
view. Riadky dense (28–32 px), 8–12 stĺpcov.

## Low-fi wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [LOGO] Acme HQ ▾  ❘ Queue · Incident · Problem · Change · KB · CMDB              [🔍] [⌘K] [🔔3] [👤Anna]  │
├────────────────────────────┬─────────────────────────────────────────────────────────────────────────────┤
│  QUEUES                    │   FILTERS:  [My team ▾] [New + Open ▾] [Priority ≥ Medium ▾]   24 výsledkov  │
│  ──────────                │   GROUP BY: [None ▾]   SORT: [Priority desc ▾]   COLS: [Default ▾]          │
│ • My open  (6)             │  ┌──────────────────────────────────────────────────────────────────────┐  │
│ • My team  (24)            │  │ ☐ │ ID         │ Pri │ Status │ Title                  │ Reqstr │ Age │  │
│ • Unassigned (12)          │  ├──────────────────────────────────────────────────────────────────────┤  │
│ • Escalated to me (3)      │  │ ☐ │ #INC-1042  │ 🔴  │ New    │ Notebook reštart       │ Lucia  │ 1h  │  │
│ • Watching (5)             │  │ ☐ │ #INC-1041  │ 🟠  │ New    │ Outlook crash          │ Pavol  │ 2h  │  │
│                            │  │ ☐ │ #INC-1038  │ 🟠  │ Open   │ VPN nestable           │ Eva    │ 3h  │  │
│  SAVED VIEWS               │  │ ☐ │ #INC-1037  │ 🟡  │ New    │ Tlačiareň 4p           │ Ján    │ 4h  │  │
│  ──────────                │  │ ☐ │ #INC-1035  │ 🟡  │ Hold   │ MS Teams audio         │ Anna   │ 6h  │  │
│ • Hardvér L1               │  │ ☐ │ #INC-1031  │ 🟢  │ Open   │ Wallpaper firmy        │ Mária  │ 8h  │  │
│ • SLA breach risk          │  │   │            │     │        │                        │        │     │  │
│                            │  │ ▶ ☐ │ #INC-1042 (selected)                                           │  │
│  + New saved view          │  │   │  Notebook sa náhodne reštartuje                                 │  │
│                            │  │   │  Lucia Novák · pred 1 hodinou · Hardvér                          │  │
│                            │  │   │  ✏ Action bar: [Take] [Reply] [Resolve] [Escalate]              │  │
│                            │  │   │  ──────────────────────────────────────────────                 │  │
│                            │  │   │  Detail open ↘ split view (viď detail wireframe)                │  │
│                            │  └──────────────────────────────────────────────────────────────────────┘  │
│                            │   Bulk: [Take] [Assign to ▾] [Close ▾]    (vypne sa pri 0 selected)        │
└────────────────────────────┴─────────────────────────────────────────────────────────────────────────────┘
```

## Layout

- **Left sidebar** (collapsible): queue list, saved views, „+ New saved view".
- **Main area**: filter bar + table + bulk action bar.
- **Selection** v tabuľke otvára row v split view → ticket detail (viď
  `02-ticket-detail.md`). Queue ostane vľavo, scroll position zachovaný.

## Default columns (workspace queue)

| Kód | Šírka | Popis |
|---|---|---|
| `_select` | 28 px | Checkbox pre bulk akcie |
| `id` | 100 px | `#INC-1042` |
| `priority` | 40 px | farebný kruh (🔴 🟠 🟡 🟢) |
| `status` | 90 px | New / Open / Hold / Resolved |
| `title` | flex | summary, ellipsize |
| `requester` | 120 px | meno, hover → contact card |
| `age` | 60 px | „2h" / „3d" |
| `assignee` | 100 px | meno alebo „Unassigned" (off by default) |
| `tenant` | 80 px | iba ak queue zahŕňa multiple tenants |

Stĺpce sú konfigurovateľné v `Cols ▾` menu, persisted v localStorage.

## Klávesové skratky

| Skratka | Akcia |
|---|---|
| `j` / `↓` | Next row |
| `k` / `↑` | Previous row |
| `Enter` | Open detail v split view |
| `Esc` | Zavrieť detail |
| `t` | Take (pridelit sebe) |
| `r` | Reply (focus na composer v detaile) |
| `c` | Close / Resolve modal |
| `e` | Escalate modal |
| `a` | Assign modal |
| `/` | Focus search v filter bar |
| `g` `q` | Go to queue (sequence) |
| `g` `m` | Go to my open |
| `?` | Help overlay s mapou skratiek |

## Bulk actions

- Checkbox v hlavičke → select all (with confirm pri > 50).
- Bulk action bar viditeľný iba pri ≥ 1 selected, sticky bottom.
- Akcie: Take, Assign to, Close, Tag, Move to queue.
- Bulk akcia s 50+ ticketmi → modal s progress bar (Promise.all batch).
  V0 (MVP): max 10 selected, v1: rozšírenie.

## Filtre

- Quick filters chips: queue, status, priority, tenant.
- Advanced filter modal (klávesa `f`) s plnou query syntaxou (CA SDM
  `where_clause` ekvivalent).
- Saved view: pomenovaná kombinácia filter + sort + cols. Zdieľateľné
  v rámci tímu (v1).

## Empty states

```text
┌───────────────────────────────────────────────┐
│         🎉  Žiadne tickety v queue              │
│                                               │
│   Všetko zatiaľ pod kontrolou. Užiš si chvíľu, │
│   pozri si learning materials alebo si daj     │
│   kávu.                                        │
│                                               │
│   [ Pozri všetky tenant queues → ]            │
└───────────────────────────────────────────────┘
```

```text
┌───────────────────────────────────────────────┐
│         🔍  Žiadne tickety pre tieto filtre    │
│   Skús uvoľniť „Priority ≥ Medium" alebo      │
│   prepnúť na „All open".                      │
│                                               │
│   [ Reset filters ]                           │
└───────────────────────────────────────────────┘
```

## Edge cases

- **Tenant prepnutie pri otvorenom detail** — detail sa zatvorí, queue
  prenahrá, scroll reset, toast „Prepol si tenant — zoznam aktualizovaný".
- **Refresh queue** — manuálny `Cmd+R` alebo silent polling 60 s. Pri novom
  ticket badge „3 nové" vedľa queue name + click refresh.
- **Long titles** — ellipsize s tooltipom plný text.
- **Stuck loading** (> 5 s) — indeterminate progress bar + cancel button.

## A11y

- Tabuľka: `<table>` s `<thead>` a `<tbody>`, `aria-rowcount`, `aria-colcount`.
- Riadky: `tabindex="0"`, `aria-selected`.
- Action bar buttons: `aria-disabled` pri 0 selected.
- Klávesové skratky: dokumentované v `?` overlay (povinné WCAG).

## Otvorené závislosti

- `[01-api-analyst]` Saved query / view endpoint v CA SDM REST (alebo iba
  client-side localStorage v MVP)?
- `[03-domain-modeller]` Status hodnoty per modul (Incident má iné než
  Change). Potrebné konzistentné labels.
- `[06-tech-stack-selector]` Tabuľková knižnica — GOAL hovorí desiatky
  riadkov, ale workspace má rozumne čakať 100+ riadkov v queue. Pri
  voľbe knižnice (HTML table / TanStack Table / iné) zvážiť keyboard
  navigation podporu out-of-the-box.
- `[07-design-system]` Tokens pre row hover/selected/focused states —
  density 28–32 px riadky vyžadujú jemné kontrasty.
