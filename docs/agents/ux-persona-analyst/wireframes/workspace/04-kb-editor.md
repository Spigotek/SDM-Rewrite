# Wireframe — Workspace · KB Editor (write + publish)

**Persona:** `kb_editor_jana`, sekundárne `agent_l2_marek`
**App:** `workspace`
**URL:** `/kb/editor/:id?` (new alebo existujúci draft)
**Priorita:** P1 (read v MVP, write/publish v1)

> **Pozn.:** GOAL.md uvádza KB editor ako v1 (po MVP). Tento wireframe slúži
> Design System / Architecture agentom ako early input, aby sa pri MVP read-only
> obrazovkách nezablokovala budúca write-cesta.

## Účel

Knowledge Engineer / autor píše a publikuje článok cez WYSIWYG editor.
**Drag-drop screenshoty**, code blocks, cross-references, taxonomy, visibility
scope per tenant, draft → review → publish flow.

## Low-fi wireframe

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [LOGO] Acme HQ ▾  ❘ Knowledge Editor                          [⌘K] [🔔] [👤Jana]       │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│  ← Späť do KB                                          DRAFT  •  Auto-saved 14:32      │
│                                                                                        │
│  ┌────────────────────────────────────────┐  ┌─────────────────────────────────────┐ │
│  │   TITLE                                 │  │  SETTINGS                           │ │
│  │   ┌─────────────────────────────────┐  │  │                                     │ │
│  │   │ Reset VPN klienta                │  │  │  Status      [Draft ▾]              │ │
│  │   └─────────────────────────────────┘  │  │  Category    [Connectivity ▾]        │ │
│  │                                         │  │  Tags        [vpn] [reset]           │ │
│  │   FORMATTING TOOLBAR                    │  │              [+ Add tag]              │ │
│  │   [B] [I] [U] [H1▾] [• list] [1. list]  │  │                                     │ │
│  │   [link] [code] [quote] [📎] [📷]        │  │  Visibility  ◯ Internal only         │ │
│  │   ────────────────────────────────────  │  │              ● Self-service portal   │ │
│  │                                         │  │              ◯ Public (no login)     │ │
│  │   BODY (WYSIWYG with markdown)          │  │                                     │ │
│  │                                         │  │  Tenant scope                       │ │
│  │   ## Kedy použiť                        │  │   ☑ Acme HQ (current)                │ │
│  │                                         │  │   ☐ Acme East                        │ │
│  │   - VPN klient sa nepripája na home     │  │   ☐ Acme West                        │ │
│  │     office                              │  │                                     │ │
│  │   - Po dlhšej prestávke prestal         │  │  Language    [SK ▾] [+ EN translation]│ │
│  │     fungovať                            │  │                                     │ │
│  │                                         │  │  ─────────────────────────────       │ │
│  │   ## Postup                             │  │  RELATED                            │ │
│  │                                         │  │  • Pripojenie na firemnú VPN...     │ │
│  │   1. Zatvor VPN klienta z system tray   │  │  • Známe problémy VPN klienta v5    │ │
│  │      [drag screenshot here]              │  │  + Add link                         │ │
│  │                                         │  │                                     │ │
│  │   2. Otvor Terminal alebo PowerShell.   │  │  ─────────────────────────────       │ │
│  │                                         │  │  SOURCE                             │ │
│  │   3. Spusť reset príkaz:                │  │  Created from: #INC-2105             │ │
│  │      ```                                 │  │  Author: Jana Kováčová               │ │
│  │      $ vpn-cli --reset-config           │  │  Reviewer: Tomáš Novák               │ │
│  │      ```                                 │  │                                     │ │
│  │                                         │  │                                     │ │
│  │   4. Otvor VPN klienta a prihlás sa.    │  │                                     │ │
│  │                                         │  │                                     │ │
│  │   [pretiahnuť screenshot tu, alebo     │  │                                     │ │
│  │    paste z clipboardu]                  │  │                                     │ │
│  │                                         │  │                                     │ │
│  └────────────────────────────────────────┘  └─────────────────────────────────────┘ │
│                                                                                        │
│  ──────────────────────────────────────────────────────────────────────────────       │
│  [ Preview ↗ ]   [ Save draft ]                          [ Submit for review →]       │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

## Layout

- **Left** (flex 70%): title + WYSIWYG editor + formatting toolbar.
- **Right** (320 px): settings, related, source, analytics teaser.
- Sticky bottom bar with primary action.

## Editor capabilities

| Feature | Popis |
|---|---|
| Markdown shortcuts | `##` → H2, `**bold**` → bold, atď. |
| WYSIWYG visual | Toolbar buttons fungujú real-time. |
| Drag-drop image | Drop kdekoľvek do body, upload progress, vloží markdown image. |
| Paste image | Cmd+V image z clipboardu (printscreen tooling). |
| Code block | Backtick triple, syntax highlight (auto-detect language). |
| Inline link | Cmd+K otvorí link picker (URL alebo internal record search). |
| Internal record link | Type `#` → autocomplete na ticket / KB / CI / Change records. |
| Embedded callouts | `> [!note]`, `> [!warning]`, semantic blocks. |
| Auto-save | Každých 5 s do server-side draft (per-user). |
| Version history | Sidebar (collapsible) — list version, diff view. |

## Workflow stavy

```text
Draft ───► Review ───► Approved ───► Published
   ▲          │            │              │
   └──────────┘            ▼              ▼
   reject              Reviewer       Public
   (with notes)        edits          read in
                                      portal
```

## Action bar

| Tlačidlo | Stav | Funkcia |
|---|---|---|
| Preview ↗ | always | Otvor preview v novej karte (renderuje sa ako v portáli). |
| Save draft | always | Manuálny save (auto-save je background). |
| Submit for review | draft | Posiela do review queue, reviewer sa auto-assignuje (per kategória / per tenant). |
| Approve & Publish | reviewer | Reviewer Tlačidlo (Jana keď reviewuje cudzí draft). |
| Request changes | reviewer | Posielat späť autorovi s comment. |
| Archive | published | Soft-delete, ostáva v audit, zmizne z search. |

## Source linking

- Pri vytváraní z ticketu (Marek klikol „Create KB from this") sa source
  ticket linkuje automaticky.
- Linkovanie je obojsmerné: v ticket detaile sa objaví „Knowledge created
  from this ticket: [KB-92]".

## Visibility scope

- **Internal only** — viditeľné len v `workspace` (interný KB pre L1/L2).
- **Self-service portal** — viditeľné v `portal` aj `workspace`.
- **Public (no login)** — viditeľné aj na anonymnom portáli (v1+, ak vôbec).

Tenant scope je nezávislé od visibility — článok môže byť „Internal only"
ale viditeľný cez 3 tenanty.

## Edge cases

- **Concurrent edits** — dvaja autori otvoria ten istý draft. UI ukáže
  warning „Tomáš tiež edituje tento článok. Posledné zmeny prepíšu predošlé."
  Plus optimistic locking na backend (`If-Match` ETag).
- **Image upload zlyhá** — inline error pri obrázku, retry button.
- **Submit bez kategórie / tagu** — soft validation: warning „Bez kategórie
  článok nebude kategorizovaný v search. Pokračovať?".
- **Cross-tenant publish** — pri označení 2+ tenant scope, UI musí
  validovať, že autor má rolu v každom z nich.

## Analytics teaser (vpravo, len pri published)

```text
┌─────────────────────────────┐
│  ANALYTICS (last 30 days)   │
│                             │
│  Views          1,247       │
│  Helpful       82 % 👍       │
│  Search hits      42        │
│                             │
│  → Full analytics           │
└─────────────────────────────┘
```

## A11y

- Editor: `role="textbox"` + `aria-multiline="true"` + `aria-label="Article body"`.
- Toolbar: `role="toolbar"` s logickou skupinou tlačidiel.
- Drag-drop image: alternative file picker button (a11y backup).
- Live region pre auto-save: „Saved 14:32" v `role="status"`.

## Otvorené závislosti

- `[01-api-analyst]` `[GAP-4]` KB write API — má CA SDM REST endpoint pre
  CRUD na KB articles? Aké sú field requirements? Visibility scope?
- `[01-api-analyst]` Image / attachment upload pre KB články — cesta v
  REST API a max size.
- `[03-domain-modeller]` KB lifecycle states a permissions — kto môže
  publish / archive / approve.
- `[05-security]` Public visibility (anonymný prístup) — bezpečnostné
  implikácie a auth bypass cesty.
- `[07-design-system]` WYSIWYG editor — preferencie ohľadom underlying
  knižnice (TipTap / ProseMirror / Lexical) by mal odporučiť Tech Stack.
