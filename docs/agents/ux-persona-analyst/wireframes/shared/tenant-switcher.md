# Wireframe — Tenant Switcher (shared, portal + workspace)

**Persony:** všetky, ktoré majú rolu vo viac než jednom tenante
**Aplikácia:** `portal` aj `workspace` (povinný komponent v hlavnej navigácii)
**Priorita:** P0 — bez tenant context UI nemôže fungovať

## Účel

Používateľ vidí **iba tých tenantov**, v ktorých má rolu (zoznam pochádza
z CA SDM rolí, nie z hardcoded zoznamu). Aktívny tenant je viditeľný **vždy**
v hornej lište. Prepnutie tenantu je **single click + confirm pri pending
state** (otvorený formulár, otvorený ticket detail).

## Low-fi wireframe

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  [LOGO]   Acme HQ ▾   ❘  Service Desk            [SK ▾]  [🔔]  [👤 Lucia]│
└────┬─────────────────────────────────────────────────────────────────────┘
     │
     │ click → expand
     ▼
┌──────────────────────────────────┐
│  Vyber tenant                   ✕│
│ ─────────────────────────────────│
│  🔍 Hľadať tenant...             │
│ ─────────────────────────────────│
│  ● Acme HQ            (current)  │  ← zelený dot, bold
│    org_id: hq                    │
│ ─────────────────────────────────│
│  ○ Acme East s.r.o.              │
│    org_id: east                  │
│  ○ Acme West GmbH                │
│    org_id: west                  │
│ ─────────────────────────────────│
│  Tvoja rola sa môže líšiť        │
│  v každom tenante.               │
└──────────────────────────────────┘
```

## Visual stavy v top lište

```text
[ Acme HQ ▾ ]              ← jeden tenant, normálne
[ Acme HQ ▾ ⚠ pending ]    ← otvorený nezapísaný formulár
[ Acme East ▾ 🔴 ]         ← high-risk tenant (production), vizuálne odlíšiť
```

## UI prvky

| Prvok | Typ | Popis |
|---|---|---|
| `tenant-display` | Button | Aktuálny tenant + caret. Klik otvorí dropdown. |
| `tenant-search` | Input | Filter tenantov v zozname (zobrazené iba pri >5 tenantoch). |
| `tenant-list` | List | Tenanty zoradené alfabeticky; aktívny prvý. |
| `tenant-row` | Button | Klik prepne tenant. Hover state, focused state. |
| `tenant-badge` | Indikátor | Farebný dot pre súčasný; odlišný pre prod/sandbox/dev (per-tenant config). |
| `confirm-modal` | Modal | Spúšťa sa pri pending state (otvorený formulár). |

## Interakcie

1. **Otvorenie zoznamu** — klik / klávesa `T`. Dropdown sa otvorí pod tenant
   display, focus na search inpute.
2. **Klávesnicová navigácia** — `↑/↓` v zozname, `Enter` potvrdiť, `Esc` zavrieť.
3. **Single tenant** — komponent zobrazuje názov bez caret, klik nič nerobí
   (žiadny dropdown). Tooltip „Máš rolu len v jednom tenante."
4. **Prepnutie pri otvorenom formulári / ticket detaile**:

   ```text
   ┌─────────────────────────────────────┐
   │  ⚠  Prepnúť tenant?                  │
   │ ─────────────────────────────────────│
   │  Máš otvorený nezapísaný formulár    │
   │  „Nahlásiť problém". Prepnutie ho     │
   │  uzavrie.                             │
   │                                       │
   │     [Zachovať tenant]  [Prepnúť →]   │
   └─────────────────────────────────────┘
   ```

5. **Po prepnutí**:
   - Toast: „Prepol si do `<tenant name>`. Niektoré dáta sa znovu načítajú."
   - Aktívna obrazovka sa **resetuje** na default queue / domov (per app).
   - Window title sa zmení (`Acme East — Service Desk Workspace`).

## Dáta

- **Zdroj zoznamu**: GET `/caisd-rest/users/{me}/tenants` — endpoint potvrdí
  API analyst. Predpoklad: vracia `{tenants: [{id, name, role, env}]}`.
- **Aktívny tenant**: client-side state + injected do každého API requestu
  ako `X-Tenant-Id` header (alebo iné — Architecture rozhodne).
- **Cache**: zoznam tenantov sa cache-uje na session (rola sa počas session
  nemení).

## A11y

- `aria-haspopup="listbox"`, `aria-expanded` toggle.
- Aktívny tenant: `aria-current="true"` v zozname.
- Skratka `T` pre otvorenie — dokumentovaná v help overlay.
- Vysoký kontrast medzi farebnými badges (red prod, yellow staging, blue dev).

## Edge cases

- **Používateľ stratí rolu v aktívnom tenante** počas session (admin ju
  odobral) → pri ďalšom requeste prichádza 403; UI musí redirect na
  „Tenant unavailable" stránku s ponukou prepnúť na iný tenant.
- **Tenant je suspended / read-only** — komponent ukáže badge „Read-only"
  vedľa názvu, action buttons v UI sú disabled s tooltipom.
- **0 tenantov** (ojedinelé, ale možné — používateľ je v procese
  on-boardingu) → portál a workspace ukážu „Nemáš pridelený tenant.
  Kontaktuj administrátora." Žiadny prístup do modulov.

## Otvorené závislosti

- `[01-api-analyst]` Endpoint pre zoznam tenantov používateľa — formát,
  cesta, auth requirements.
- `[04-architecture]` Stratégia tenant prenášania (HTTP header `X-Tenant-Id`
  vs. cookie vs. route prefix) — wireframe predpokladá header. Ak sa zvolí
  route prefix (`/{tenant}/...`), tenant switcher musí robiť **route push**,
  nie state set.
- `[05-security]` Audit log pre tenant prepnutia — má sa to logovať?
  (Compliance: áno; UX: implicit, neviditeľné pre používateľa.)
- `[07-design-system]` Farebné badges pre tenant env (prod/staging/dev) —
  potreba tokens v palete (semantic + neutral).
