# Outputs — UX / Persona Analyst

Cieľový adresár: `docs/agents/ux/`

| Cesta | Účel | Min. obsah |
|---|---|---|
| `personas.md` | 6 person s detailom | jeden H2 per persona, sekcie: profil, ciele, frustrácie, scenáre, app |
| `journeys.md` | Top-3 user journey per persona | mermaid `journey` alebo swimlane diagram per scenár |
| `wireframes/portal/<screen>.md` | 5 wireframov pre portál | low-fi ASCII/mermaid + anotácie |
| `wireframes/workspace/<screen>.md` | 5 wireframov pre workspace | low-fi + anotácie |
| `risks.md` | UX riziká a otvorené otázky pre nadväzujúcich agentov | tabuľka: riziko, dopad, návrh mitigácie |
| `screen-inventory.md` | Súhrn všetkých obrazoviek per app (vrátane sekundárnych) | tabuľka: app, screen, persona, priorita |

## Povinné obrazovky

### Portal (5)
1. Domov / dashboard žiadateľa (otvorené tickety, KB highlights)
2. Vytvorenie nového ticketu (Incident alebo Request — formulár)
3. Service Catalog browser
4. Detail môjho ticketu (timeline, status, komunikácia)
5. KB search + článok

### Workspace (5)
1. Queue / inbox agenta (filtre, bulk actions)
2. Detail Incident / Request s pravým panelom (CI, žiadateľ, history)
3. Change calendar / Change detail s approvals
4. KB editor (write + publish)
5. CMDB CI detail (atribúty + vzťahy + impact)

### Spoločný prvok (povinný v oboch app)

- **Tenant switcher** v hlavnej navigácii — ukáže zoznam tenantov, kde má
  prihlásený používateľ rolu, a umožní prepnutie. Wireframe pridaj do
  `wireframes/shared/tenant-switcher.md` a ako overlay/komponent na
  všetkých 5+5 obrazovkách.

## Povinná záverečná sekcia v každom artefakte

Každý markdown artefakt zo zoznamu vyššie **musí končiť** sekciou
`## Otvorené závislosti` podľa kontraktu v `.agents/README.md`. PM ju parsuje
v refinement loope a podľa nej rozhoduje o opätovnej invokácii. Ak žiadne
flagy nemáš, napíš `Žiadne. Artefakt je samonosný.`.

## Validácia (PM)

- `personas.md` má aspoň 6 H2.
- `journeys.md` obsahuje aspoň 18 journey scenárov (6 person × 3).
- `wireframes/portal/` aj `wireframes/workspace/` obsahujú minimálne 5 .md súborov.
