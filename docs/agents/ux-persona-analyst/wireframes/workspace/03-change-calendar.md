# Wireframe — Workspace · Change Calendar a Change detail

**Persona:** `change_manager_peter`
**App:** `workspace`
**URL:** `/changes/calendar`, `/changes/:id`
**Priorita:** P1 (MVP read + basic approve, advanced features v1)

## Účel

Change Manager vidí naplánované zmeny v kalendárnom view, identifikuje
konflikty (časové prekryvy, rovnaké CI, freeze periods). Approve flow s
plným kontextom — impact, rollback, approvers status.

## Low-fi wireframe — Change calendar (week view)

```text
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│ [LOGO] Acme HQ ▾  ❘ Change Calendar                          [⌘K] [🔔] [👤Peter]            │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│  VIEW: [Day][Week][Month]  TENANTS: [All my tenants ▾]  RISK: [≥ Low ▾]                    │
│  [< 12 May - 18 May 2026 >]                                            [+ New Change]      │
│  ──────────────────────────────────────────────────────────────────────────────────────    │
│        │  Mon 12 │  Tue 13 │  Wed 14 │  Thu 15 │  Fri 16 │  Sat 17       │  Sun 18         │
│  ──────┼─────────┼─────────┼─────────┼─────────┼─────────┼───────────────┼──────────       │
│  00-04 │         │         │         │         │         │ 🟥 CHG-503    │                  │
│        │         │         │         │         │         │ Apache patch  │                  │
│  ──────┼─────────┼─────────┼─────────┼─────────┼─────────┼───────────────┼──────────       │
│  04-08 │         │         │ 🟧 #441 │         │         │ ⚠ overlap     │                  │
│        │         │         │ DB tune │         │         │ #503, #504    │                  │
│  ──────┼─────────┼─────────┼─────────┼─────────┼─────────┼───────────────┼──────────       │
│  08-12 │         │ 🟨 #438 │         │         │         │               │                  │
│        │         │ AD sync │         │         │         │               │                  │
│  ──────┼─────────┼─────────┼─────────┼─────────┼─────────┼───────────────┼──────────       │
│  12-16 │         │         │         │ 🟧 #445 │         │               │ 🚫 FREEZE       │
│        │         │         │         │ FW upgr │         │               │ holiday         │
│  ──────┼─────────┼─────────┼─────────┼─────────┼─────────┼───────────────┼──────────       │
│  16-20 │ 🟨 #432 │         │         │         │ 🟩 #452 │               │                  │
│        │ Cert ren│         │         │         │ KB upd  │               │                  │
│  ──────┼─────────┼─────────┼─────────┼─────────┼─────────┼───────────────┼──────────       │
│  20-24 │         │         │         │         │         │ 🟥 #504 East  │                  │
│        │         │         │         │         │         │ Storage swap  │                  │
│  ──────────────────────────────────────────────────────────────────────────────────────    │
│  Legend: 🟩 low  🟨 medium  🟧 high  🟥 emergency   ⚠ conflict   🚫 freeze period           │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Low-fi wireframe — Change detail s approvals

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  ← Späť na calendar                                                                    │
│                                                                                        │
│  CHG-503  Apache Log4j security patch                                                  │
│  🟥 Emergency · Awaiting CAB approval                                                  │
│                                                                                        │
│  ┌─────────────────────────────────────────┬─────────────────────────────────────┐   │
│  │  Window:    Sat 17 May, 02:00 - 06:00   │  Risk:     High                     │   │
│  │  Duration:  4 hours (incl. rollback)     │  Type:     Security patch           │   │
│  │  Tenant:    Acme HQ                     │  CAB-class: Emergency               │   │
│  │  Implementor: Marek Krajči               │  Status:   2 of 4 approvers signed │   │
│  └─────────────────────────────────────────┴─────────────────────────────────────┘   │
│                                                                                        │
│  ──────────────────────────────────────────────────────────────────────────────       │
│  TABS:  [Detail][Impact][Rollback][Approvals][Tasks][Comments]                         │
│  ──────────────────────────────────────────────────────────────────────────────       │
│                                                                                        │
│  IMPACT (3 tab active)                                                                │
│                                                                                        │
│  Affected CIs (12)                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐         │
│  │ • srv-prod-app-01    web frontend         downtime 30 min               │         │
│  │ • srv-prod-app-02    web frontend         downtime 30 min               │         │
│  │ • srv-prod-app-03    backend API          downtime 1 h                   │         │
│  │ • ... (9 more, click to expand)                                          │         │
│  └─────────────────────────────────────────────────────────────────────────┘         │
│  → Open CI graph                                                                       │
│                                                                                        │
│  Affected Services (business-facing)                                                  │
│  • Customer portal (estimated 200 users at this time)                                 │
│  • Admin console (no users at this time)                                              │
│                                                                                        │
│  ⚠ Conflicts                                                                          │
│  • Conflicting with CHG-504 in Acme East tenant (storage swap, same window)           │
│      → View cross-tenant detail                                                        │
│                                                                                        │
│  ──────────────────────────────────────────────────────────────────────────────       │
│  APPROVALS (4 tab)                                                                    │
│                                                                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐         │
│  │ ✅ Peter Novák (CAB Chair)         Approved · 14 May 14:32              │         │
│  │ ✅ Jana Kováčová (Security)        Approved · 14 May 15:01              │         │
│  │ ⏳ Lukáš Hric (Operations)         Pending                              │         │
│  │ ⏳ Tomáš Veselý (Business owner)   Pending                              │         │
│  └─────────────────────────────────────────────────────────────────────────┘         │
│                                                                                        │
│  → Send reminder to pending approvers                                                  │
│                                                                                        │
│  ──────────────────────────────────────────────────────────────────────────────       │
│  ACTION BAR                                                                            │
│                                                                                        │
│  [✅ Approve]  [❌ Reject]  [📝 Request changes]  [💬 Comment]  [📅 Reschedule]        │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

## UI prvky — calendar

| Prvok | Typ | Popis |
|---|---|---|
| View toggle | Tab group | Day / Week / Month. |
| Tenant selector | Multi-select | „All my tenants" alebo subset. Zobrazené iba ak Peter má rolu vo viac. |
| Risk filter | Combobox | Skryje low-risk zmeny pri preview. |
| Date navigation | Buttons | < / > / Today / Pick date. |
| Calendar grid | Custom | Time × Days, change blocks colored by risk. |
| Conflict marker | Overlay | Dva alebo viac changes prekrývajú → red border + ⚠. |
| Freeze marker | Overlay | Predefined freeze periods (holidays, end-of-month). |
| Block hover | Tooltip | Quick info: title, implementor, duration, impact count. |
| Block click | Drill-in | Otvoriť change detail (right side panel alebo nová obrazovka). |

## UI prvky — change detail

- Breadcrumb header s status badge.
- Two-column meta panel.
- Tabs: Detail, Impact, Rollback, Approvals, Tasks, Comments.
- Action bar sticky bottom.

## Interakcie

- **Drag-resize blocks** (v1+) — Change Manager presúva blok myšou na nový
  čas; UI okamžite ukáže nové konflikty.
- **Approve / Reject** — modal s required comment pre Reject.
- **Request changes** — modal s text field, posiela späť implementorovi.
- **Reminder** — pošle e-mail / notifikáciu pending approvers (rate-limited
  na 1× za 24 h per approver).
- **Cross-tenant view** — toggle „All my tenants"; visible len pre roly,
  ktoré majú viac tenantov; konflikty cez tenant boundaries marked.

## Mobile (Peter — emergency approve flow)

```text
┌─────────────────────────────────┐
│ 🔔 Emergency CAB approval        │
│ CHG-503 Apache Log4j patch      │
├─────────────────────────────────┤
│ Risk: 🟥 High                    │
│ Window: Sat 02:00-06:00         │
│ 12 affected CIs                 │
│                                 │
│ Rollback plan: ✅ provided       │
│ Conflicts:    ✅ none in HQ      │
│                                 │
│ [ View full detail ]            │
│                                 │
│ ┌─────────────────────────────┐ │
│ │   ✅ Approve (req. 2FA)      │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │   ❌ Reject                  │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

Mobile flow je súčasť `workspace` (responsive), nie separátna app. Buttons
≥ 44 px touch target.

## Edge cases

- **Conflict with cross-tenant change** Peter vidí len svoj tenant — UI
  ukáže badge „Conflict with external tenant" bez detailu (compliance),
  s návrhom kontaktovať tenant admin-a.
- **Freeze period block change** — pri pokuse vytvoriť/presunúť change do
  freeze window, UI hard-block s explanation „Tento týždeň je freeze period
  (Vianoce). Vyžaduje výnimku od CAB Chair."
- **Rollback plán prázdny pri Approve** — UI block + warning toast.

## Otvorené závislosti

- `[01-api-analyst]` Change calendar API — vystavuje CA SDM scheduled
  windows v REST? Inak BFF agreguje z Change records.
- `[01-api-analyst]` `[GAP-3]` Cross-tenant change visibility —
  zopakovanie z journeys: má CA SDM rolu „global change manager"?
- `[03-domain-modeller]` Change types (standard / normal / emergency)
  + state machine + transitions.
- `[03-domain-modeller]` Approval flow — sequential vs. parallel,
  multi-level, escalation.
- `[05-security]` Mobile approve s 2FA — step-up auth flow detail.
- `[07-design-system]` Calendar grid — opakovaný pattern, tokens pre
  risk colors (semantic palette).
