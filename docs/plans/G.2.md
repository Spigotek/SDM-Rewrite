# G.2 — i18n provider + sk/en catalogs

> **Status**: ✅ DONE
> **Branch**: `chunk/G.2-i18n` (merged + deleted)
> **PR**: #21 (squash-merged 2026-05-25)
> **Cieľ**: naplniť `packages/i18n/` stub kompletným i18n adaptérom nad
> `i18next + react-i18next + i18next-icu`. Vytvoriť SK + EN catalogs pre shared
> labels (akcie, statusy, errors) + per-app catalogs (portal, workspace).
> Aktualizovať existujúce hardcoded SK strings v `apps/{portal,workspace}/src/shell/`
> aby išli cez `useTranslation()`.

## Pivot vs ROADMAP

ROADMAP `G.2` bullet: _"i18n provider + catalogs (sk/en) — Inputs: docs/agents/design-system/microcopy.md, architecture/decision-records/07-i18n.md. Output: packages/i18n/{src,catalogs}/\*."_

`packages/i18n/src/index.ts` momentálne exportuje len `PACKAGE_NAME`. Shell
komponenty (`login-page.tsx`, `idle-modal.tsx`, `tenant-switcher.tsx`)
majú hardcoded SK strings ("Prihlásiť sa", "Tvoja relácia vyprší o…").
G.2 zaviazať cez i18n bez breaking change.

## Inputs

- **`docs/agents/architecture/decision-records/07-i18n.md`** — autoritatívny contract pre `@sdm/i18n` package: `I18n` interface, `I18nProvider`, `useTranslation`, `Trans`, `dynamic()` helper, ICU MessageFormat, per-app catalog chunking.
- **`docs/agents/design-system/microcopy.md`** — reference copy: §2.1 (akcie SK/EN), §2.2 (status labels), §2.3 (meta labels), §3 (errors), §4 (empty states), §5 (toasts), §6 (confirms), §9 (pluralizácia SK 3-form), §10 (relative time), §13 (403/RBAC info-safe formulations).
- **`docs/agents/design-system/library-recommendation.md` §i18n** — confirmed `react-i18next@15 + i18next@23 + i18next-icu + @formatjs/intl-messageformat`.
- **`packages/i18n/src/index.ts`** — current stub.
- **`apps/portal/src/shell/{login-page,idle-modal,tenant-switcher,top-bar,session-context}.tsx`** — hardcoded SK strings na migráciu.
- **`apps/workspace/src/shell/*`** — identicky.
- **`packages/auth/src/session.ts`** — môže mať i18n-relevant default strings (overiť pri implementácii).

## Outputs

```
packages/i18n/
├── package.json                          # +deps: i18next@23, react-i18next@15, i18next-icu, @formatjs/intl-messageformat
├── src/
│   ├── index.ts                          # re-exports: I18nProvider, useTranslation, Trans, useLocale, dynamic
│   ├── provider.tsx                      # I18nProvider component + bootstrap helper
│   ├── hooks.ts                          # useTranslation, useLocale, useDynamic
│   ├── dynamic.ts                        # dynamic(value: string | {sk,en}): string helper
│   ├── format.ts                         # formatDate, formatNumber, formatRelative (using Intl + date-fns)
│   ├── types.ts                          # Locale, I18n interface (per ADR-07)
│   ├── load.ts                           # lazy loader for per-route catalogs
│   └── default-locale.ts                 # locale detection (storage > nav.language > "sk" fallback)
├── catalogs/
│   ├── shared/
│   │   ├── sk.json                       # status, actions, errors, validation, time (per microcopy.md §2-3+§9-10)
│   │   └── en.json
│   ├── portal/
│   │   ├── sk.json                       # portal-only (greeting, "Nahlásiť problém", catalog labels)
│   │   └── en.json
│   └── workspace/
│       ├── sk.json                       # workspace-only (queue actions, composer tabs, ITIL terms)
│       └── en.json
├── scripts/
│   └── check-parity.ts                   # CI gate: SK ↔ EN key parity (per ADR-07 §3 negatives mitigation)
└── vitest.config.ts

packages/i18n/tests/
├── provider.test.tsx                     # render + locale switch + dynamic value
├── plurals.test.ts                       # ICU SK 3-form: =0, one, few, other
└── format.test.ts                        # date / number / relative format SK + EN

apps/portal/src/main.tsx                  # wrap App with I18nProvider; load shared+portal catalogs on bootstrap
apps/workspace/src/main.tsx               # same with shared+workspace
apps/portal/src/shell/login-page.tsx      # t("auth.login.title") instead of hardcoded "Prihlásiť sa"
apps/portal/src/shell/idle-modal.tsx      # t("session.idle.title") instead of hardcoded
apps/portal/src/shell/top-bar.tsx         # t("nav.logout") etc.
apps/workspace/src/shell/*                # identicky

apps/portal/src/shell/language-switcher.tsx   # NEW: dropdown SK/EN in UserMenu (writes to localStorage)
apps/workspace/src/shell/language-switcher.tsx # NEW

apps/portal/index.html                    # +<html lang="sk"> (default; updates on locale change)
apps/workspace/index.html                 # same

tools/i18n-check/                         # OR scripts/i18n-check.ts — CI gate per ADR-07
└── README.md

.github/workflows/ci.yml                  # +pnpm i18n:check step

docs/ROADMAP.md                           # G.2 → ✅ DONE
docs/plans/G.2.md                         # tento súbor → Status DONE
```

## Done-when

- [x] `@sdm/i18n` exports: `I18nProvider`, `useTranslation`, `Trans`, `useLocale`, `dynamic`, `formatDate`, `formatNumber`, `formatRelative` (per ADR-07).
- [x] ICU MessageFormat funguje pre SK 3-form plurals (`{count, plural, =0 {žiadnych} one {1} few {# tickety} other {# ticketov}}`) — overené v `plurals.test.ts` (6 testov: SK =0/one/few/other + EN =0/one+other).
- [x] Shared catalog (`shared/{sk,en}.json`) má **52 keys** pokrývajúcich `microcopy.md §2.1` (akcie) + §2.2 (status) + §2.3 (priority) + §3 (errors) + §3 (validation) + §6 (idle session) + §9 (plurals) + §10 (time).
- [x] Portal (`portal/{sk,en}.json`) má **16 keys**, workspace (`workspace/{sk,en}.json`) má **20 keys** pre app-specific strings (shell, nav, catalog/queue, actions, composer, SLA).
- [x] **Žiadne hardcoded SK strings** v `apps/{portal,workspace}/src/shell/` — verified `grep -rE '"[A-ZČĎĹĽŇŔŠŤŽ][a-záčďéíĺľňóôŕšťúýž]+"' apps/*/src/shell/` → empty.
- [x] LanguageSwitcher v topbar funguje — `<select>` SK/EN, on-change volá `changeLocale()` ktoré lazy-loadne druhý catalog, prepíše `i18next.language`, sync-ne `<html lang>`, persistne do `localStorage.sdm.locale`.
- [x] Locale persistence: `detectLocale()` číta `localStorage.sdm.locale` → fallback `navigator.language` → fallback `"sk"`. `bootstrapI18n()` await-uje natiahnutie catalog-u pred `createRoot().render()` (FOUC-safe).
- [x] `<html lang="sk|en">` attribute sa updatuje pri bootstrap + pri `languageChanged` evente (cez `useEffect` v provideri).
- [x] CI gate `pnpm i18n:check` (pure-Node stdlib script v `tools/i18n-check/src/cli.js`) overí key parity recursive walkom, exit 1 na mismatch. Negative test verified.
- [x] `pnpm -r typecheck/lint/test/build` green (15 i18n testov + 39 design-system + 90 auth + 212 BFF + ...).
- [x] Bundle delta: portal index 91.5 → 120.1 KB gzip = **+28.6 KB gzip** (i18next + react-i18next + ICU + intl-messageformat). Per-locale catalogs chunked.
- [x] ROADMAP toggle: G.2 → ✅ DONE.

## Stratégia

### Fáza A — Adapter implementácia

1. Install deps: `i18next@23`, `react-i18next@15`, `i18next-icu`, `@formatjs/intl-messageformat`, `date-fns@3` (modular, pre `formatRelative`).
2. `packages/i18n/src/provider.tsx` — wrap `I18nextProvider` z react-i18next; init `i18next` s ICU postprocessor, default locale z `default-locale.ts`.
3. `hooks.ts` — `useTranslation()` re-export z react-i18next; `useLocale()` returns current locale + setter; `useDynamic()` wraps `dynamic()` helper.
4. `dynamic.ts` — helper pre CA SDM backend-provided labels (per ADR-07 §Rozhodnutie):
   ```ts
   export function dynamic(value: string | { sk?: string; en?: string }, locale: Locale): string {
     if (typeof value === "string") return value;
     return value[locale] ?? value.en ?? value.sk ?? "";
   }
   ```
5. `format.ts` — `formatDate(date, opts)` używa `Intl.DateTimeFormat`; `formatRelative` używa `date-fns/formatDistanceToNowStrict` s SK locale.
6. `load.ts` — lazy import per-route: `import("./catalogs/portal/sk.json")` etc. via Vite's dynamic import (chunk-split natívne).

### Fáza B — Catalogs

1. Cieľová **40+ key parity** medzi SK a EN.
2. **`shared/sk.json`** prikladám prvý draft (subset zo §microcopy.md):
   ```json
   {
     "actions": {
       "submit": "Odoslať",
       "save": "Uložiť",
       "cancel": "Zrušiť",
       "delete": "Odstrániť",
       "approve": "Schváliť",
       "reject": "Zamietnuť",
       "signIn": "Prihlásiť sa",
       "signOut": "Odhlásiť sa"
     },
     "status": {
       "new": "Nový",
       "open": "Otvorený",
       "inProgress": "V riešení",
       "resolved": "Vyriešený",
       "closed": "Zatvorený"
     },
     "errors": {
       "sessionExpired": "Tvoja relácia vypršala. Prihlás sa znova.",
       "permissionDenied": "Nemáš prístup k tomuto záznamu v tenante {tenant}. Skontroluj rolu s administrátorom.",
       "notFound": "Hľadaný záznam sa nenašiel. Možno bol zmazaný alebo si zlú URL.",
       "serverError": "Server teraz neodpovedá. Skús to o chvíľu.",
       "networkOffline": "Nemáš pripojenie."
     },
     "plurals": {
       "tickets": "{count, plural, =0 {žiadne tickety} one {1 ticket} few {# tickety} other {# ticketov}}"
     },
     "time": {
       "justNow": "Pred chvíľou",
       "minutesAgo": "Pred {count, plural, one {# minútou} few {# minútami} other {# minútami}}",
       "hoursAgo": "Pred {count, plural, one {# hodinou} few {# hodinami} other {# hodinami}}"
     }
   }
   ```
3. EN catalog mirror keys 1:1.
4. Portal-specific: `greeting`, `reportProblem`, `requestSomething`, `myTickets`, `catalogTiles.*`.
5. Workspace-specific: `queue.*`, `composer.tabs.*`, `actions.take`, `actions.escalate`, `actions.watch`, etc.

### Fáza C — Migrácia shell + LanguageSwitcher + CI gate + PR

1. Migruj `apps/portal/src/shell/login-page.tsx`:
   ```tsx
   const { t } = useTranslation("shared");
   <h1>{t("actions.signIn")}</h1>;
   ```
2. Identicky `idle-modal.tsx`, `tenant-switcher.tsx`, `top-bar.tsx`, `session-context.tsx`.
3. `LanguageSwitcher` komponent v UserMenu (portal + workspace) — dropdown 2 options (Slovenčina / English), writes to `localStorage.locale`, calls `i18n.changeLanguage()`.
4. `<html lang="sk|en">` update — buď cez `useEffect(() => document.documentElement.lang = locale, [locale])` v provider, alebo cez i18next event listener.
5. `scripts/i18n-check.ts` (alebo `tools/i18n-check/`):
   ```ts
   // Recursively diff keys between sk.json + en.json per catalog. Exit 1 on mismatch.
   import * as fs from "node:fs";
   // ...
   ```
6. Pridaj do `.github/workflows/ci.yml`:
   ```yaml
   - run: pnpm i18n:check
   ```
7. `pnpm -r typecheck/lint/test/build` green; PR per memory.

## Open questions / risks — recommended resolutions

- **Catalog format**: JSON (per ADR-07), NIE YAML. Jednoduchšie tooling, nice diff. Žiadne CSV / GETTEXT.
- **Pluralization**: ICU MessageFormat cez `i18next-icu`. NOT natívne `Intl.PluralRules` (i18next vyžaduje ICU adapter pre rich syntax `{count, plural, =0 {} one {} few {} other {}}`).
- **Locale fallback chain**: `sk → en → key-as-fallback` per react-i18next default. EN má vždy 100% coverage; SK by mal tiež, ale fallback chráni pred deploy s missing key.
- **Catalog chunking**: shared sa loaduje vždy; per-app (portal/workspace) sa loaduje cez bootstrap (nie route-level — apps sú samostatné SPA, žiadne cross-app navigation). Treba **EAGER load aspoň jeden locale** kým bootstrap dokončí — inak prvá frame UI bude raw key.
- **FOUC pri locale switch**: react-i18next vie suspend-uje pri lazy load druhého locale. Wrap I18nProvider v `<Suspense fallback={null}>` aby switch nebol jarring.
- **Date format**: SK convention `14. máj 2026` (dot, space-month-space-year); EN convention `14 May 2026`. `Intl.DateTimeFormat("sk-SK", { dateStyle: "long" })` vracia správny SK format.
- **Persona names** (per ADR-07 §Komplikácie): "Lucia, Anna, ..." sú dev artifacts, **nie** v i18n catalogs. Ostávajú hardcoded v Storybook / dev tools.
- **Backend dynamic values** (CA SDM status sym): G.2 zaviazať cez `dynamic()` helper kde BFF vie posielať `{sk, en}` shape; **dnes** BFF vracia raw EN string (per F.1-F.4 captures), takže `dynamic(value)` len passthrough. Future migration story.
- **`i18n-check` v CI**: musí byť **blocking** (exit code 1 pri mismatch). Otherwise SK ↔ EN drift sa nahromadí.

## Notes pre subagenta

- Subagent dispatchovaný cez Agent tool s `subagent_type: "general-purpose"`. Self-contained brief obsahuje aj:
  - **Don't translate all of microcopy.md upfront**: scope je shared + portal + workspace shellové strings (~70 keys total). Feature module strings (incident, request, kb, cmdb, change) idú do Phase H per chunk — NIE súčasť G.2.
  - **Test ICU plurals**: SK má 3 forms (one=1, few=2-4, other=5+). Pluralizácia v `i18next-icu` musí byť overená v `plurals.test.ts`.
  - **Don't break MSW**: existujúce MSW handlers (api-mocks) môžu vracať statické SK/EN strings — to je acceptable, NIE súčasť i18n migration.
  - **i18n-check script**: jednoduchý Node script, recurse JSON, diff key sets. Žiadny fancy parser.
- Subagent **NESMIE**:
  - Pridať `@sdm/i18n` ako runtime dep na `@sdm/design-system` (G.1) — komponenty ostávajú locale-agnostic, **app vrstva** wrapsne ich cez `useTranslation`.
  - Migrovať feature module strings (incident form labels, queue column headers) — to ide do Phase H per chunk.
  - Mergovať vlastný PR (parent agent zavŕši).
