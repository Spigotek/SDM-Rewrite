# Microcopy — voice & tone, chybové hlášky, CTA

## Changelog (round 2)

- Pridaná sekcia `## 403 / RBAC errors` — info-safe formulácie pre permission
  denied scenarios (rieši 05 r1 flag "hranica info disclosure pri 403").
- Otvorené závislosti aktualizované — `[05-security]` 403 boundary uzavretý,
  `[06-tech-stack-selector]` i18n a date formatting uzavreté.

> Pravidlá pre **písaný obsah v UI** — labels, buttons, error messages,
> empty states, toasts, tooltips. Cieľ: konzistentný hlas naprieč
> `portal` aj `workspace`, ale s **odlišnou registroviou** per app
> (portal = friendly + jednoduchá slovenčina; workspace = precízny + IT
> jazyk pre profesionálov).
>
> i18n: **SK + EN** (per GOAL §5). Všetky strings sú externalizované cez
> i18n knižnicu — výber 06. Tento dokument poskytuje **referenčné copy**
> + štýlové pravidlá.

## 1. Voice & tone — princípy

### 1.1 Voice (konzistentný naprieč app)

| Princíp | Áno | Nie |
|---|---|---|
| **Konkrétne** | "Ticket #INC-1042 odoslaný" | "Operation completed successfully" |
| **Aktívny rod** | "Anna prevzala tvoj ticket" | "Tvoj ticket bol prevzatý" |
| **Druhá osoba** | "Tvoje aktívne tickety" | "Aktívne tickety používateľa" |
| **Nájdi-rieš-pomôž** | "Skús reset filter" | "Try again" |
| **Bez slangu** | "Ako ti môžem pomôcť?" | "Čo poho?" |
| **Bez urážok pri chybe** | "Veľký súbor (80 MB). Skús kompresiu." | "Súbor nesprávny" |

### 1.2 Tone (líši sa per app)

| App | Tone | Príklad |
|---|---|---|
| `portal` | Priateľský, ľudský, jednoduchý jazyk (CEFR B1-B2). Emoji selektívne (greeting, success). | "Ahoj, Lucia 👋", "Helpdesk to dostane okamžite." |
| `workspace` | Profesionálny, stručný, IT-správny. Žiadne emoji v UI labels (povolené v status badges 🔴🟠). Predpokladá poznanie ITIL terminológie. | "Take", "Escalate to L2", "SLA breach risk 23 min" |

### 1.3 Dvojjazyčnosť (SK / EN)

- **Default jazyk** = `lang` v user profile (SSO claim alebo manual override).
- **Mixed content** — KB článok v EN keď user je SK profile: badge "Iba v
  angličtine" / "EN only", `lang="en"` na container.
- **Žiadne hybrid strings** — nikdy "Resolve ticket" mixed v SK UI; vždy
  "Vyriešiť" alebo úplne EN.

## 2. Common labels (SK + EN reference)

### 2.1 Akcie (verbs)

| Kontext | SK | EN |
|---|---|---|
| Submit form | Odoslať | Submit |
| Save | Uložiť | Save |
| Save draft | Uložiť koncept | Save draft |
| Cancel | Zrušiť | Cancel |
| Confirm | Potvrdiť | Confirm |
| Delete | Odstrániť | Delete |
| Archive | Archivovať | Archive |
| Restore | Obnoviť | Restore |
| Edit | Upraviť | Edit |
| Create | Vytvoriť | Create |
| Add | Pridať | Add |
| Remove | Odobrať | Remove |
| Open | Otvoriť | Open |
| Close | Zavrieť | Close |
| Resolve | Vyriešiť | Resolve |
| Reopen | Otvoriť znova | Reopen |
| Approve | Schváliť | Approve |
| Reject | Zamietnuť | Reject |
| Escalate | Eskalovať | Escalate |
| Take (ticket) | Prevziať | Take |
| Watch | Sledovať | Watch |
| Unwatch | Prestať sledovať | Unwatch |
| Search | Hľadať | Search |
| Filter | Filtrovať | Filter |
| Reset filters | Resetovať filtre | Reset filters |
| Refresh | Obnoviť | Refresh |
| Retry | Skúsiť znova | Retry |
| Send | Poslať | Send |
| Reply | Odpovedať | Reply |
| Copy | Skopírovať | Copy |
| Sign out | Odhlásiť sa | Sign out |
| Sign in | Prihlásiť sa | Sign in |
| Switch tenant | Prepnúť tenant | Switch tenant |

### 2.2 Status labels (z 03 domain-modeller mapping)

Ticket statusy — workspace + portal majú **rovnaké visible labels**.

| Status code | SK | EN |
|---|---|---|
| `new` | Nový | New |
| `open` | Otvorený | Open |
| `in_progress` | V riešení | In Progress |
| `hold` | Pozastavený | On Hold |
| `pending_approval` | Čaká na schválenie | Pending Approval |
| `resolved` | Vyriešený | Resolved |
| `closed` | Zatvorený | Closed |
| `reopened` | Znova otvorený | Reopened |
| `cancelled` | Zrušený | Cancelled |

Priority:

| Priority | SK | EN |
|---|---|---|
| `critical` | Kritická | Critical |
| `high` | Vysoká | High |
| `medium` | Stredná | Medium |
| `low` | Nízka | Low |

### 2.3 Meta labels

| Kontext | SK | EN |
|---|---|---|
| Required | Povinné | Required |
| Optional | Voliteľné | Optional |
| Updated | Aktualizované | Updated |
| Created | Vytvorené | Created |
| Modified | Zmenené | Modified |
| Loading | Načítavam | Loading |
| Saving | Ukladám | Saving |
| Saved | Uložené | Saved |
| Sending | Posielam | Sending |
| Sent | Odoslané | Sent |
| Just now | Pred chvíľou | Just now |
| 5 min ago | Pred 5 minútami | 5 min ago |
| Yesterday | Včera | Yesterday |
| Today | Dnes | Today |

## 3. Error messages — patterns

### 3.1 Štruktúra error message

```
[Čo sa stalo?] [Prečo?] [Čo s tým?]
```

Najmenej **dve** zo troch. Vždy v aktívnom rode, používateľ je adresát.

### 3.2 Štandardné chyby

| Kód / Situácia | SK | EN |
|---|---|---|
| 401 / Session expired | "Tvoja relácia vypršala. Prihlás sa znova." | "Your session has expired. Please sign in again." |
| 403 / Permission denied | "Nemáš prístup k tomuto ticketu v tenante {tenant}. Skontroluj rolu s administrátorom." | "You don't have access to this ticket in tenant {tenant}. Check your role with admin." |
| 404 / Not found | "Hľadaný ticket #{id} sa nenašiel. Možno bol zmazaný alebo si zlú URL." | "Ticket #{id} not found. It may have been deleted or the URL is wrong." |
| 409 / Conflict | "Niekto iný práve zmenil tento ticket. Obnov stránku a skús znova." | "Someone else just modified this ticket. Refresh and try again." |
| 413 / File too large | "Súbor je príliš veľký ({size}). Maximum je {max}. Skús kompresiu alebo menší súbor." | "File too large ({size}). Maximum is {max}. Try compression or a smaller file." |
| 500 / Server error | "Helpdesk teraz nedostáva odpoveď zo servera. Skús to o chvíľu. Ak to nepomôže, [otvor priority ticket]." | "Our server isn't responding. Try again shortly. If problem persists, [open priority ticket]." |
| Network offline | "Nemáš pripojenie. Tvoj rozpísaný text sme uložili — vrátime sa, len čo budeš online." | "You're offline. Your draft is saved — we'll resume when you're back." |
| Validation: required | "Toto pole je povinné." | "This field is required." |
| Validation: too short | "Vyplň aspoň {min} znakov." | "Enter at least {min} characters." |
| Validation: too long | "Maximum {max} znakov ({current})." | "Maximum {max} characters ({current})." |
| Validation: email | "Email musí obsahovať @ a doménu." | "Email must contain @ and a domain." |
| Validation: invalid format | "Formát nie je správny. Príklad: {example}." | "Wrong format. Example: {example}." |

### 3.3 Anti-patterny

| Antipattern | Prečo zlé | Lepšia verzia |
|---|---|---|
| "Error 500" | Neporozumie obyčajný používateľ. | "Helpdesk teraz nedostáva odpoveď zo servera." |
| "Invalid input" | Nepovedané, ktoré pole. | "Email musí obsahovať @ a doménu." |
| "Try again" | Neporozumie, čo, ako, kedy. | "Skús to o chvíľu. Ak to nepomôže, [otvor priority ticket]." |
| "Are you sure?" (without context) | Nejasné, čo sa stane. | "Naozaj odstrániť ticket #INC-1042? Túto akciu nemožno vrátiť späť." |
| "Operation failed" | Žiadny actionable info. | "Komentár sa neodoslal — nemáš pripojenie. Skúsime znova, len čo budeš online." |
| "Permission denied" | Nepomáha. | "Nemáš prístup k tomuto ticketu v tenante Acme East. Skontroluj rolu s administrátorom." |
| Caps lock everywhere | Cried voice. | Sentence case. |

## 4. Empty states

| Situácia | SK | EN |
|---|---|---|
| Queue empty (workspace) | "🎉 Žiadne tickety v queue. Všetko zatiaľ pod kontrolou. Užiš si chvíľu, pozri si learning materials alebo si daj kávu." | "🎉 Queue is empty. Take a break, browse learning materials, or grab a coffee." |
| Queue filtered empty | "🔍 Žiadne tickety pre tieto filtre. Skús uvoľniť priority alebo prepnúť na 'All open'." + [Reset filters] | "🔍 No tickets match these filters. Try relaxing priority or switch to 'All open'." + [Reset filters] |
| KB search 0 results | "Nič som nenašiel. Skús inú formuláciu, alebo [otvor ticket s týmto popisom →]" | "Nothing found. Try different wording, or [open a ticket with this description →]" |
| Portal — žiadne tickety | "Zatiaľ žiadne tickety. Keď niečo budeš potrebovať, [nahláška problému] alebo [požiadaj o niečo]." | "No tickets yet. When you need something, [report a problem] or [request something]." |
| CMDB CI bez vzťahov | "Tento CI nemá žiadne zaznamenané vzťahy. Pridaj vzťah — pre impact analysis je to dôležité." | "This CI has no recorded relationships. Add one — it's important for impact analysis." |
| Notifications empty | "Žiadne nové notifikácie. Tu sa budú zobrazovať aktualizácie tvojich ticketov." | "No new notifications. Updates on your tickets will appear here." |
| Calendar nothing scheduled | "Žiadne zmeny v tomto týždni. Pokojnejší týždeň pre tím." | "No changes scheduled this week. Calm week for the team." |

## 5. Success / confirmation toasts

| Akcia | SK toast | EN toast |
|---|---|---|
| Ticket submitted | "✅ Ticket #{id} odoslaný. Helpdesk to dostane okamžite." | "✅ Ticket #{id} submitted. Helpdesk will pick it up shortly." |
| Comment posted | "Komentár pridaný." | "Comment posted." |
| Ticket taken | "Prevzala si #{id}." | "You took #{id}." |
| Ticket resolved | "✅ #{id} označený ako vyriešený." | "✅ #{id} marked as resolved." |
| Ticket reopened | "#{id} znova otvorený." | "#{id} reopened." |
| Change approved | "Schválil(a) si #{id}." | "You approved #{id}." |
| Change rejected | "Zamietol(a) si #{id}." | "You rejected #{id}." |
| KB article published | "Článok publikovaný. Ostatní ho už vidia v Self-service portáli." | "Article published. It's now visible in the Self-service portal." |
| Code copied | "Skopírované do schránky." | "Copied to clipboard." |
| Filter saved | "Filter '{name}' uložený. Nájdeš ho v Saved views." | "Filter '{name}' saved. Find it in Saved views." |
| Tenant switched | "Prepol si do {tenant}. Niektoré dáta sa znovu načítajú." | "Switched to {tenant}. Some data is reloading." |
| Draft auto-saved | "Uložené pred chvíľou" (subtle, nie toast — inline) | "Saved just now" |

## 6. Confirmation dialogs

Štruktúra:

- **Title** — krátka otázka (5–8 slov).
- **Description** — čo sa stane + dôsledky.
- **Cancel button** — neutral.
- **Confirm button** — match the action (variant = destructive ak nieje undoable).

### Príklady

| Akcia | Title (SK) | Description (SK) | Confirm label |
|---|---|---|---|
| Cancel form s rozpísanými dátami | Zahodiť rozpísaný ticket? | Stratíš text a prílohy, ktoré si pridala. Túto akciu nemožno vrátiť späť. | Zahodiť |
| Tenant switch s pending | Prepnúť tenant? | Máš otvorený nezapísaný formulár "Nahlásiť problém". Prepnutie ho uzavrie. | Prepnúť |
| Reject change | Zamietnuť CHG-503? | Schvaľovateľom pôjde notifikácia o zamietnutí. Musíš pridať komentár prečo. | Zamietnuť |
| Bulk close 8 tickets | Zatvoriť 8 ticketov? | Status sa zmení na "Closed" pre všetky. Toto neviem vrátiť ak ich už nemáš v rukách. | Zatvoriť |
| Sign out | Naozaj sa odhlásiť? | Otvorený rozpísaný text sa stratí. | Odhlásiť |
| Reopen resolved ticket | Otvoriť ticket znova? | Vrátiš sa do statusu "Open". Anna dostane notifikáciu. | Otvoriť znova |

## 7. Form helper text

| Pole | Helper SK | Helper EN |
|---|---|---|
| Email | "Korporátny email — pre notifikácie." | "Company email — for notifications." |
| Phone | "Voliteľné. Pre prípad urgentnej komunikácie." | "Optional. For urgent communication." |
| Password | "Aspoň 12 znakov, kombinuj písmená, čísla a znaky." | "At least 12 characters, mix letters, numbers, symbols." |
| Ticket summary | "Krátka veta — detail napíš nižšie." | "Short sentence — write details below." |
| Ticket description | "Pomôž nám pomôcť ti rýchlejšie — čo presne sa deje, kedy začalo, čo si už skúsila." | "Help us help you faster — what's happening, when did it start, what have you tried." |
| Change rollback plan | "Krok-za-krokom čo robíme, ak zmena zlyhá. Bez rollback plánu zmena nemôže byť schválená." | "Step-by-step recovery if the change fails. Approvals are blocked without a rollback plan." |

## 8. Buttons — verbs not nouns

| Áno | Nie |
|---|---|
| "Odoslať ticket" | "Ticket" |
| "Schváliť zmenu" | "Schválenie" |
| "Hľadať v KB" | "KB Search" |
| "Vytvoriť nový" | "Nový" |

**Výnimka.** Toolbar icon buttons s `aria-label` (verb) môžu mať noun-icon
vizuálne (📎 attach, 🔍 search). Verb je v `aria-label`.

## 9. Pluralisation (SK má 3 formy, EN 2)

| Count | SK | EN |
|---|---|---|
| 0 | žiadnych ticketov | no tickets |
| 1 | 1 ticket | 1 ticket |
| 2-4 | 2 tickety / 3 tickety / 4 tickety | 2 tickets / 3 tickets / 4 tickets |
| 5+ | 5 ticketov / 24 ticketov | 5 tickets / 24 tickets |

i18n knižnica (06 vyberie) musí podporovať `Intl.PluralRules` alebo
ICU MessageFormat pre SK 3-formy.

## 10. Time relative formatting

| Diff | SK | EN |
|---|---|---|
| < 1 min | "Pred chvíľou" | "Just now" |
| 1-59 min | "Pred 5 minútami" | "5 min ago" |
| 1-23 hod | "Pred 3 hodinami" | "3h ago" |
| 1-2 dni | "Včera o 14:32" / "Pred 2 dňami" | "Yesterday at 14:32" / "2d ago" |
| 3-7 dní | "Pred 4 dňami" | "4d ago" |
| > 7 dní | Absolute date "14. máj 2026" | "14 May 2026" |

Tooltip s presným timestampom vždy k dispozícii pri hover.

## 11. KB / Service Catalog descriptions

Sú user-generated (KB editor), ale pre **catalog items** definujeme template:

```
[Čo to je]. [Kto to schvaľuje a kedy je doručené].

Príklad:
"Ročná licencia pre design tooling.
~ 2 dni vybavenie · vyžaduje schválenie manažéra"
```

## 12. Accessibility-specific microcopy

| Kontext | SK | EN |
|---|---|---|
| Skip link | "Preskočiť na hlavný obsah" | "Skip to main content" |
| `aria-label` — Notifications bell s count | "Notifikácie, {n} neprečítaných" | "Notifications, {n} unread" |
| `aria-label` — Status badge expanded | "Status: V riešení, prevzala Anna pred 12 minútami" | "Status: In Progress, taken by Anna 12 minutes ago" |
| `aria-label` — File upload progress | "Nahrávam {filename}, {percent} percent" | "Uploading {filename}, {percent} percent" |
| `aria-label` — Required field marker | "povinné" | "required" |
| `aria-live` — Saved | "Uložené pred chvíľou" | "Saved just now" |

## 13. 403 / RBAC errors — info-safe formulácie

> **Hranica info disclosure** (riešený 05 r1 flag). Pravidlo: **user-helpful**
> (povedz mu, čo má robiť) bez **info-disclosure** (nemenuj rolu, permission
> key, ani user/group ktorý má prístup). Detail security kontextu v
> [`security/rbac.md`](../security/rbac.md) §9 + threat-model.md.

### 13.1 Princípy

| Princíp | Áno | Nie |
|---|---|---|
| **Povedz, čo robiť** | "Skontroluj rolu s administrátorom." | "Skontaktuj sa s helpdeskom." (bez akcie) |
| **Menuj tenant** | "Nemáš prístup k ticketu #INC-1042 v tenante Acme East." | "Access denied." |
| **NEmenuj rolu / permission** | "Skontroluj rolu s administrátorom tenanta." | "Vyžaduje sa rola Change Manager." |
| **NEmenuj kto má prístup** | "Tento ticket je v inom tenante, do ktorého nemáš prístup." | "Tento ticket vidí len rola agent_l2 v Acme East." |
| **Aktívny rod** | "Nemáš prístup..." | "Prístup je odmietnutý..." |
| **NEpriznaj existenciu objektu mimo scope** | "Hľadaný ticket #INC-9999 sa nenašiel." (rovnaký text ako 404) | "Tento ticket existuje, ale nemáš naň prístup." |

**Najdôležitejšie pravidlo**: pri 403 na **read** access objektu mimo scope
(cross-tenant ticket, KB článok ktorý user nemá vidieť) odpovedáme **rovnakým
textom ako 404 not-found**. Zámerný overlap — bráni enumeračnému útoku
("guessing" valid IDs).

### 13.2 Vzorové formulácie per scenár

| Scenár | SK (user-helpful + info-safe) | EN |
|---|---|---|
| **Mutation 403** — user vidí akciu (cached permission), ale BFF odmietol | "Túto akciu teraz nemôžeš vykonať. Skús prepnúť tenant alebo skontroluj rolu s administrátorom tenanta {tenant}." | "You can't perform this action right now. Try switching tenant or check your role with admin in {tenant}." |
| **Mutation 403** — tenant context mismatch (objekt patrí inému tenantu) | "Tento záznam patrí inému tenantu. Prepni tenant a skús znova." | "This record belongs to a different tenant. Switch tenant and try again." |
| **Route 403** — user navigoval na chránenú obrazovku | "Túto stránku nevidíš v tenante {tenant}. Skontroluj rolu s administrátorom alebo prepni tenant, kde máš prístup." + tenant switcher prominently | "This page isn't available in tenant {tenant}. Check your role with admin or switch to a tenant where you have access." + tenant switcher prominently |
| **Read 403** — neoprávnený detail (cross-tenant) | (rovnaký text ako 404) "Hľadaný záznam sa nenašiel. Možno bol zmazaný alebo si zlú URL." | (same as 404) "Record not found. It may have been deleted or the URL is wrong." |
| **Mutation 403 ihneď po tenant switch** — stale permission cache | "Práve si prepol tenant — niektoré akcie sa zmenili. Skús znova." | "You just switched tenants — some actions changed. Try again." |
| **Stale role** (CA SDM admin zmenila rolu počas session) | "Tvoja rola sa zmenila. Prihlás sa znova, prosím." → auto-redirect na /login po 5 s | "Your role changed. Please sign in again." → auto-redirect to /login in 5s |
| **Cross-tenant publish attempt** (kb_editor publish "all tenants" without sp_admin) | "Publikovať môžeš len do tenanta {tenant}. Pre cross-tenant publish kontaktuj administrátora služby." | "You can publish only to tenant {tenant}. For cross-tenant publish, contact service admin." |
| **Bulk action 403 na podmnožinu rows** | "{n} ticketov z {total} sa nepodarilo {action} — nemáš oprávnenie. Ostatné prebehli úspešne." | "{n} of {total} tickets couldn't be {action} — no permission. Others succeeded." |
| **Step-up auth required** (high-risk action) | "Táto akcia vyžaduje overenie. Potvrď ju ešte raz pre bezpečnosť." | "This action requires verification. Confirm again for security." |

### 13.3 Microcopy pre `Can` komponent fallback

`Can` komponent (per [`components.md`](./components.md) §Can) renderuje
deti len ak má user permission. Pri deny: **default `fallback={null}`** —
element zmizne úplne. Ak je `fallback` explicitly poskytnutý:

| Use case | Vzor fallback (SK) | Vzor fallback (EN) |
|---|---|---|
| Tooltip "nemáš oprávnenie" pri hover (rare — väčšinou skrývame) | "Vyžaduje rolu s vyšším oprávnením. Skontroluj s administrátorom tenanta." | "Requires higher permission. Check with tenant admin." |
| Disabled button so visible feedback | (Button v `disabled` state + `aria-describedby` linkujúci na hidden helper) "Túto akciu nemôžeš vykonať v aktuálnom tenante." | "You can't perform this action in the current tenant." |

**Pozor**: `Can` fallback **nikdy nemenuje konkrétnu permission key** (`"requires
incident.escalate"` = info disclosure). Maximum špecifickosti: "vyššie oprávnenie".

### 13.4 Admin-friendly skratka

Pre tenant administrátorov a sp_admin role pridáme do error message
"Kontaktujte správcu tenanta {tenant}." — admin vie kontaktovať priamo,
hluchý user nepotrebuje vedieť detaily.

Cieľová úroveň informácie:

```
Nemáš prístup k tomuto ticketu v tenante Acme East.
Kontaktujte správcu tenanta Acme East.
```

NIE:

```
Nemáš permission 'incident.update.assignee' (rola requester v tenante Acme East).
Túto rolu má agent_l1, agent_l2, change_manager.
```

### 13.5 Anti-patterny pri 403 microcopy

| Antipattern | Prečo zlé | Lepšia verzia |
|---|---|---|
| "Vyžaduje rolu agent_l2" | Info disclosure roly. | "Skontroluj rolu s administrátorom." |
| "Permission 'incident.delete' chýba" | Disclosure permission key (útok vie targetovať). | "Túto akciu nemôžeš vykonať." |
| "Tento ticket vidia len role X a Y" | Disclosure access matrix. | "Tento záznam sa nenašiel." (rovnaký text ako 404) |
| "Access denied" | Nezrozumiteľný, nie actionable. | "Túto stránku nevidíš v tenante X. Skontroluj rolu s administrátorom." |
| "Forbidden" (raw HTTP status text) | Tech jargon na portal Lucia. | (rovnako ako vyššie) |
| Zobraziť technicky `403` ako error code v UI | Nepomáha; vyzerá ako leak. | Skry status code; ukáž user-helpful copy + (optional) "Error ID: {requestId}" pre support trace. |

### 13.6 Audit logging contract

Každý 403 (route alebo mutation) loguje BFF s `actor`, `tenant`, `requested
permission`, `denied reason`. UI **nezdieľa** requestId default-ne; iba pri
"Show error details" expand (pre support flow). Detail audit-and-compliance
viď [`security/audit-and-compliance.md`](../security/audit-and-compliance.md)
(ak existuje) alebo 05 OWASP §logging.

## 14. Tone calibration per persona

| Persona | App | Tone | Príklad copy |
|---|---|---|---|
| `requester_lucia` | portal | Priateľský, jednoduchý SK | "Ahoj, Lucia 👋 Ako ti môžem pomôcť?" |
| `agent_l1_anna` | workspace | Profesionálny, efektívny | "Take", "Reply", "Resolve" |
| `agent_l2_marek` | workspace | Profesionálny, technický | "Link to Problem", "Create KB from this" |
| `change_manager_peter` | workspace + mobile | Precízny, risk-aware | "Conflicts: ✅ none in HQ", "Rollback plan: ✅ provided" |
| `kb_editor_jana` | workspace | Editorial, helpful | "Draft auto-saved", "Submit for review" |
| `cmdb_owner_robert` | workspace | Senior, data-rich | "Stale data — last sync 14h ago" |

## 15. Style nits

- **Slovenská diakritika** — povinná (`ľ ĺ č ď ť ž`). Žiadne `regulacie` /
  `helpdesk`.
- **Anglické technicizmy** — keď SK ekvivalent zhoršuje pochopenie, ostáva
  EN s lowercase: "queue" je OK, "fronta" by bola horšia v workspace; "ticket"
  je OK (legacy term v IT support).
- **Číslovanie ticketov** — vždy s hash a typom: `#INC-1042`, `#CHG-503`,
  `#REQ-308`. NIKDY len číslo.
- **Citácie** — slovenské "…" alebo «…», nie ".."
- **Pomlčka** — em-dash `—`, nie `--`. Bez medzier okolo em-dash v EN, **s**
  medzerami v SK.
- **Pre slovesné dvojtvary** — používaj generic male / female keď neznáme.
  Príklad: "Anna prevzala" (vieme), "Niekto prevzal" (generic). Vyhni sa
  "prevzal(a)" len v statickom UI; v dynamic použijeme template
  `{name} {took-verb}` s gender-aware verb z user profilu (06 + i18n).

## Otvorené závislosti

- `[06-tech-stack-selector]` i18n knižnica — **[resolved-in-round-2]**
  react-i18next 15 + i18next-icu confirmed (ICU MessageFormat pre SK 3-form
  plurals).
- `[06-tech-stack-selector]` Locale-aware date formatting —
  **[resolved-in-round-2]** date-fns 3.x (modular) + natívny `Intl` API
  confirmed (06 `libraries.md` §17).
- `[05-security]` Error messages pri 403 / RBAC — **[resolved-in-round-2]**
  kontrakt definovaný v sekcii `## 13. 403 / RBAC errors` vyššie. Pravidlo:
  user-helpful + info-safe, žiadny disclosure roly/permission/access matrix,
  read-403 = 404 text overlap (anti-enumeration).
- `[03-domain-modeller]` Mapovanie CA SDM status codes na SK / EN labels —
  **pretrváva** (vstup pre 03 v post-conv stage). Per modul (Incident, Request,
  Problem, Change) majú odlišné states.
- `[09-qa-test-strategy]` Linting microcopy — `vale.sh` pravidlá na CI —
  **pretrváva** (QA + DevOps Phase C). Anti-pattern detection (Caps lock,
  "click here", "operation failed", 403 info disclosure patterns).
- `[?]` Gender-aware verb formy (`prevzala` vs. `prevzal`) — **pretrváva**.
  Potrebujeme `gender` field v user profile alebo SSO claim. Default
  fallback: generic male ("prevzal") + zobrazenie meno-priezvisko z profilu.
