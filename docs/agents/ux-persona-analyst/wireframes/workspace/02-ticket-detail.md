# Wireframe — Workspace · Ticket detail (Incident / Request)

**Persona:** `agent_l1_anna`, `agent_l2_marek`
**App:** `workspace`
**URL:** `/tickets/:id` (alebo split view nad `/queue`)
**Priorita:** P0

## Účel

Hlavná obrazovka pre prácu s ticketom. **Three-pane layout** — queue (vľavo,
collapsible), ticket detail (centre), kontext panel (vpravo, requester +
CI + history + KB). Inline editovateľné polia, klávesnicovo prvotriedne.

## Low-fi wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ [LOGO] Acme HQ ▾  ❘ Queue · Incident · Problem · Change · KB · CMDB        [⌘K] [🔔] [👤Anna]│
├─────────────────────┬────────────────────────────────────────────────────┬──────────────────┤
│ QUEUE (collapsible) │  #INC-1042                          [⊠ close]       │  CONTEXT          │
│ ────────────────    │  Notebook sa náhodne reštartuje                      │  ─────────        │
│ • #INC-1042 ◀ act   │                                                      │  REQUESTER        │
│ • #INC-1041         │  ┌──────────────────────────────────────────────┐    │  Lucia Novák      │
│ • #INC-1038         │  │ Status:  ⏳ In Progress ▾                     │    │  Marketing · HQ   │
│ • #INC-1037         │  │ Priority: 🔴 High ▾                            │    │  ext. 4287        │
│ • #INC-1035         │  │ Assignee: 👤 Anna Kováčová ▾                   │    │  Locality: Praha  │
│                     │  │ Category: Hardvér ▾                            │    │                   │
│                     │  │ Tenant:   Acme HQ                              │    │  📞 Volať          │
│                     │  └──────────────────────────────────────────────┘    │  💬 Slack          │
│                     │                                                      │                   │
│                     │  ┌──────────────────────────────────────────────┐    │  ─────────        │
│                     │  │ ACTION BAR                                     │    │  CI               │
│                     │  │ [Reply] [Close ▾] [Escalate] [Take] [Watch] [⋮]│    │  Laptop "L-1042"  │
│                     │  └──────────────────────────────────────────────┘    │  Dell XPS-15      │
│                     │                                                      │  Last patch: today │
│                     │  TIMELINE  ·  [All] [Public] [Internal] [System]    │  ⚠ 8 incidents     │
│                     │  ┌──────────────────────────────────────────────┐    │  same patch        │
│                     │  │ 👤 Anna · 12 min ago · public                  │    │  → View CI         │
│                     │  │ Prevzala som ticket. Rezervovala náhradný...   │    │                   │
│                     │  │ ──────────────────────────────────────────     │    │  ─────────        │
│                     │  │ 👤 Lucia · 1h ago · public                     │    │  HISTORY          │
│                     │  │ Stalo sa to už 3-krát ráno. Black screen...    │    │  Lucia má 4       │
│                     │  │ 📎 screenshot-error.png                         │    │  ďalšie tickety   │
│                     │  │ ──────────────────────────────────────────     │    │  za posledný mes. │
│                     │  │ ⓘ System · 1h ago                               │    │  → View history    │
│                     │  │ Created by Lucia from portal                    │    │                   │
│                     │  └──────────────────────────────────────────────┘    │  ─────────        │
│                     │                                                      │  KB SUGGESTIONS    │
│                     │  ┌──────────────────────────────────────────────┐    │  • Outlook crash   │
│                     │  │ COMPOSER                                       │    │    after patch     │
│                     │  │ [Public reply] [Internal note] [Resolution]    │    │  • Hardware reset  │
│                     │  │ ┌──────────────────────────────────────────┐ │    │    procedure       │
│                     │  │ │                                          │ │    │  • Black screen FAQ│
│                     │  │ └──────────────────────────────────────────┘ │    │  → Insert KB link  │
│                     │  │ 📎 KB-link  📎 attach  /  templates: [Hello] │    │                   │
│                     │  │                              [Save & Send →]  │    │  ─────────        │
│                     │  └──────────────────────────────────────────────┘    │  RELATED          │
│                     │                                                      │  Incidents (3)    │
│                     │  LINKED RECORDS                                      │  Problems (1)     │
│                     │  • Problem #PRB-44 (Outlook patch)                   │  Changes (0)      │
│                     │  • + Add link                                        │  → View related    │
└─────────────────────┴────────────────────────────────────────────────────┴──────────────────┘
```

## Layout zóny

| Zóna | Šírka | Obsah |
|---|---|---|
| Left — queue | 220 px (collapsible 0) | Krátky zoznam ticket-ov v queue, indikátor aktívneho. |
| Center — detail | flex | Status bar, action bar, timeline, composer, linked records. |
| Right — context | 320 px (collapsible 0) | Requester, CI, history, KB suggestions, related records. |

## Status bar — inline edit

Každé pole je inline-editable cez klávesovú skratku alebo klik:

- Klik na hodnotu → dropdown (status, priority, assignee, category).
- Klávesová skratka: `s p` (priority), `s a` (assignee), `s c` (category).
- Submit cez click outside / Enter / Esc cancel.
- Optimistic UI: zmena okamžite, rollback pri 4xx s toast „Zmena
  zlyhala (Permission denied)".

## Action bar

| Tlačidlo | Skratka | Akcia |
|---|---|---|
| Reply | `r` | Focus composer v Public mode. |
| Close ▾ | `c` | Modal s required resolution code + comment. |
| Escalate | `e` | Modal s assignment_group select + note. |
| Take | `t` | Set assignee=me, status → Open. |
| Watch | `w` | Add to watch list (notifications bez ownership). |
| ⋮ | `m` | More: Print, Export, Merge, Link to Problem, Create KB. |

## Timeline filter

Tabs:

- **All** — verejné komentáre, internal notes, system events.
- **Public** — len verejné (čo vidí žiadateľ).
- **Internal** — interné poznámky pre tím.
- **System** — automatické udalosti (status changes, assignment, attachments).

Default: **All** s vizuálne odlíšenými typmi (farba ľavého border-u: blue
public, yellow internal, gray system).

## Composer

Tabs:

- **Public reply** — žiadateľ to vidí, ide e-mail notifikácia.
- **Internal note** — len pre tím.
- **Resolution** — uzatvára ticket; prepne do `Resolved` state.

Akcie:

- KB-link inserter — search KB, klik vloží odkaz + krátky popis.
- Templates — predpripravené odpovede (per persona / per tenant).
- Attach — drag-drop alebo file picker.
- `Cmd+Enter` submit.

## Right context panel

### Requester card

- Meno, lokalita, kontakt, klikaľný telefón a Slack.
- Hover → ďalšie info (manager, dept, jazyk).

### CI card (z CMDB)

- Pridelené CI ticket-u (ak je).
- Posledný patch, model, owner.
- Warning badge ak existujú ďalšie incidenty s tým istým CI / patch-om.

### History card

- Počet ticketov requester-a za N dní.
- Klik → history view (popout).

### KB suggestions

- Top 3 články podľa fuzzy match summary + category.
- „Insert KB link" pridá do composer-a.

### Related records

- Linked Problems, Changes, Incidents.
- „Add link" → search + select.

## Edge cases

- **Ticket je read-only** (closed > 30 dní, archived) — composer disabled,
  všetky inline edits disabled, banner „Ticket je archivovaný".
- **Konflikt pri save** (niekto iný zmenil status) — UI ukáže warning
  „Anna pred chvíľou zmenila status na X. Reload?" + reload button.
- **Tenant change pri otvorenom ticket** — ticket sa zatvorí, viď queue
  edge case.
- **Permission downgrade** počas otvoreného ticket — composer disabled
  s tooltipom.

## A11y

- Sekcie majú `<section>` s `aria-label`.
- Inline-edit polia: `<button>` s `aria-haspopup="listbox"`.
- Composer textarea: `aria-multiline`, `aria-required="false"`.
- Klávesové skratky dostupné cez `?` overlay.

## Otvorené závislosti

- `[01-api-analyst]` Inline edit endpoint — PATCH na `/caisd-rest/tickets/{id}`
  s partial update. Validácie (status transitions, RBAC).
- `[01-api-analyst]` KB suggestion endpoint — vyžaduje fuzzy / semantic
  search? Ak CA SDM nemá, BFF vyrieši alebo MVP fallback statickým
  category-based.
- `[03-domain-modeller]` State machine pre Incident → potrebné pre
  validáciu status dropdown options (z X možno len Y, Z).
- `[03-domain-modeller]` Resolution codes (uzavretie ticketu) — zoznam
  povolených hodnôt per tenant.
- `[05-security]` Internal notes vs. public reply RBAC — kto vidí internal?
  Implications pre composer UI.
- `[07-design-system]` 3-pane layout je density-heavy — design tokens
  pre spacing, typography scale.
