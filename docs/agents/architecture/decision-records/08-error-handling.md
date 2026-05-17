# ADR-08 — Error boundary a globálne error handling

**Status**: accepted
**Dátum**: 2026-05-15
**Autor**: 04-architecture agent (runId 20260508-192438, round 1)

## Kontext

UX (`risks.md` R-017): "search miss vs. permissions" — UI musí rozlíšiť, či
backend vracia prázdny výsledok kvôli permission deny, alebo skutočne nič
nenašiel. CA SDM používa **flat 401** pre všetky permission failures
(auth.md §5).

api-analyst (`gaps.md` #6): attachment permissions — FE musí ošetriť 401 pri
prístupe nepovolených súborov.

Failures mode-y:
1. **Network failure** — fetch reject, no response.
2. **Auth expired** — BFF session prevalí, response 401 s code `AUTH_EXPIRED`.
3. **Auth forbidden** — user nemá rolu / permission, response 403 (alebo
   401 z CA SDM, BFF mapuje na `AUTH_FORBIDDEN`).
4. **Tenant forbidden** — entita patrí inému tenantu, BFF vráti `TENANT_FORBIDDEN`.
5. **Validation** — FE poslal zlý payload, BFF / CA SDM vráti 400 s detail.
6. **Not found** — entita neexistuje, 404.
7. **Conflict** — concurrent edit, 409.
8. **Backend unavailable** — CA SDM down / timeout, BFF vráti 502/503.
9. **Render error** — JS exception v komponente.
10. **Unhandled promise rejection** — async chyby mimo TanStack Query.

Každý vyžaduje iný UX response.

## Rozhodnutie

**Layered error handling** s explicitnou taxonómiou:

### Layer 1: `AppError` taxonómia (zdieľaná FE + BFF)

```ts
// @sdm/api-types/error.ts
type AppErrorCode =
  | "AUTH_EXPIRED"          // session expired → redirect /login
  | "AUTH_FORBIDDEN"        // user nemá permission → toast + disable action
  | "TENANT_FORBIDDEN"      // entita patrí inému tenantu → navigate /
  | "VALIDATION"            // form payload zlý → inline field errors
  | "NOT_FOUND"             // entita neexistuje → 404 page
  | "CONFLICT"              // concurrent edit → conflict resolve UI
  | "BACKEND_UNAVAILABLE"   // CA SDM down → retry s exponential backoff
  | "NETWORK"               // fetch zlyhal → "offline" indicator
  | "UNKNOWN";              // catch-all → toast + Sentry

interface AppError {
  code: AppErrorCode;
  message: string;          // i18n key alebo human-friendly
  details?: unknown;        // dev mode only
  fieldErrors?: Record<string, string>;  // pre VALIDATION
  correlationId: string;
}
```

### Layer 2: API client (server errors)

`@sdm/api-client` zachytáva HTTP errors a hodí typed `AppError`:

```ts
async function apiCall(path, opts): Promise<T> {
  const res = await fetch(path, opts);
  if (!res.ok) {
    const body = await res.json();
    throw new AppErrorException(body.error);   // AppError
  }
  return res.json();
}
```

TanStack Query `useQuery` / `useMutation` zachytí `error: AppError` typed.

### Layer 3: Per-feature error handling

V hooks / pages:

```ts
const { data, error } = useTicketDetail(id);
if (error?.code === "TENANT_FORBIDDEN") navigate("/");
if (error?.code === "NOT_FOUND") return <NotFoundPage />;
if (error?.code === "AUTH_EXPIRED") /* useEffect auto-redirect */;
```

Generic error UI:
- `<ErrorState code="..." onRetry={...}>` v Design System.
- Spustí toast pre `BACKEND_UNAVAILABLE`, `NETWORK`, `CONFLICT`.

### Layer 4: Error boundary (render errors)

- Per-app boundary v `App Shell` (najvyššia úroveň).
- Per-route boundary (volitelne v feature moduloch — napr. KB editor má
  svoj boundary, lebo WYSIWYG knižnica môže hodiť unhandled).
- Fallback: "Niečo sa pokazilo. [Refresh stránku] [Nahlásiť]". "Nahlásiť"
  spustí Sentry feedback dialog (ADR-09).

### Layer 5: Unhandled rejections

`window.addEventListener("unhandledrejection", ...)` → Sentry capture
+ toast "Stalo sa niečo neočakávané. Stránka pokračuje v práci.".

### Layer 6: BFF mapping

BFF API module → Error shaper komponent (`components/bff.md` §2.3) mapuje
CA SDM responses na `AppError`. Tu sa rieši disambiguácia flat 401.

## Dôsledky

**Pozitívne**:
1. **Konzistentný error shape** — FE má jednu typed štruktúru, žiadne
   `if (error.statusCode === 401 || error.message.includes("...")` parsovanie.
2. **Centralizovaná i18n error stringov** — kľúče v `@sdm/i18n` per code.
3. **Per-code UX response** — UX agent risks (R-017 best practice — search
   miss vs. permission) realizovateľný.
4. **Audit trail** — `correlationId` v každom error logu prepája FE Sentry
   eventy s BFF JSON logmi.
5. **Žiadny user data leak** — `details` ide do `Sentry` (dev mode only
   v UI). Žiadne PII v production toast.

**Negatívne**:
1. **BFF musí mapping správne** — nesprávny mapping (napr. 404 mapped na
   `BACKEND_UNAVAILABLE`) zmätie FE. Mitigácia: unit testy v BFF Error shaper
   per CA SDM response shape.
2. **Validation field errors** — vyžaduje BFF poznať schema. Mitigácia:
   pre Service Catalog forms je schema známa (ADR-06); pre ostatné polia
   CA SDM error message sa zobrazí ako toast.

## Alternatívy

### A) Per-feature ad-hoc error handling

**Prečo zamietnuté**:
- Každý feature reinvent-uje wheel. Inkonzistentné UX (toast vs. inline
  vs. modal).

### B) Throw raw HTTP errors

**Prečo zamietnuté**:
- FE musí parsovať status + body shape per endpoint. CA SDM má rôzne XML/JSON
  error shapes podľa typu chyby. Nepoužiteľné.

### C) Global try/catch wrapping každej akcie

**Prečo zamietnuté**:
- Boilerplate. TanStack Query `error` channel + boundary je čistejšie.

## Otvorené závislosti

| # | Flag | Smer | Popis |
|---|---|---|---|
| 1 | `error-i18n-keys` | → 07-design-system, 10-documentation-author | Konkrétne user-facing texty per code. Design System dodá UI komponentu, Documentation Author finálne stringy. |
| 2 | `ca-sdm-error-shapes` | → 01-api-analyst | Plný katalóg CA SDM error response shapes — momentálne v `auth.md` §5 a `endpoints.md` per-endpoint, ale nie systematicky. |
| 3 | `validation-mapping` | → 01-api-analyst | Per-field validation errors — CA SDM vracia v ktorom formáte? `fieldErrors` mapping. |
| 4 | `conflict-resolution-ux` | → 02-ux-persona | UI pre `CONFLICT` (concurrent edit) — diff view, "keep mine" vs. "keep theirs". Žiaden wireframe to nepokrýva. |
