# ADR-12 — Runtime config

**Status**: accepted
**Dátum**: 2026-05-15
**Autor**: 04-architecture agent (runId 20260508-192438, round 1)

## Kontext

GOAL §5 + §11:
- "API endpoint — konfigurovateľný: produkčný backend nie je počas vývoja
  dostupný. Endpoint sa preto rieši cez build-time `.env` premennú ako
  fallback **a runtime `config.json` načítaný pri štarte aplikácie**
  (umožňuje meniť endpoint bez rebuildu — kritické pre on-prem deployment)."
- "Referenčná CA SDM inštancia bude až po nasadení."

Inými slovami: build-time hardcoding API endpointu **nie je acceptable**.
Customer urobí build raz, deploy do svojho on-prem prostredia, kde API
URL je customer-specific. Re-build per customer = unmaintainable.

Ďalšie veci, ktoré chceme v runtime configu:
- `features` flags (kbAnalytics, bulkOperations — moduly post-MVP).
- `i18n.defaultLocale` (per customer preferencia: SK / EN default).
- `branding` (productName, primary color — Design System / DevOps konfiguráciu).
- `ssoLoginPath` (corp IdP location).

Náš deployment model:
- **Static SPA build** v `apps/portal/dist/` a `apps/workspace/dist/`.
  Customer hostuje na vlastnom Nginx / IIS / iné.
- **BFF binary / container** — customer beží proces, configure cez env vars
  alebo config file.

## Rozhodnutie

**Two-tier runtime config**:

### Tier 1: BFF `/config` endpoint (primary)

BFF má endpoint `GET /config` ktorý vracia JSON:
```json
{
  "apiBaseUrl": "https://api.acme.example",
  "ssoLoginPath": "/auth/login",
  "features": {
    "kbAnalytics": false,
    "bulkOperations": false,
    "crossTenantViewer": false
  },
  "i18n": {
    "defaultLocale": "sk",
    "available": ["sk", "en"]
  },
  "branding": {
    "productName": "Acme Service Desk",
    "primaryColor": "#0066cc",
    "logoUrl": "/branding/logo.svg"
  },
  "version": {
    "appBuild": "2026.05.15.123",
    "configRevision": 7
  }
}
```

Zdroj BFF configu:
- Súbor `config.json` v BFF working dir (alebo `--config-path` flag).
- Customer ho upraví bez restartu BFF (BFF má file watcher alebo
  lazy re-read s 30 s TTL).
- Žiadne secrets v `config.json` (IdP credentials, CA SDM credentials,
  Redis URL idú do env vars).

SPA bootstrap (App Bootstrap v `portal.md` §2.1 a `workspace.md` §2.1):
1. `fetch('/config')` — same-origin (BFF a SPA hosted pod rovnakou doménou
   alebo cez reverse proxy s shared origin).
2. Naplnenie `ConfigContext` pred prvým route render.

### Tier 2: Inline `window.__SDM_CONFIG__` (fallback)

Pre prípady, kde:
- Dev mode bez BFF (DevOps mock backend, MSW).
- Customer chce SPA bez BFF (post-MVP scenár, žiadny v MVP).

SPA `index.html` má placeholder:
```html
<script>
  window.__SDM_CONFIG__ = window.__SDM_CONFIG__ || null;
</script>
```

App Bootstrap logika:
```ts
const config = window.__SDM_CONFIG__
  ?? await fetch('/config').then(r => r.json());
```

Ak Customer chce override bez BFF, môže do `index.html` post-build vložiť:
```html
<script>
  window.__SDM_CONFIG__ = { apiBaseUrl: "...", ... };
</script>
```

V dev: Vite plugin alebo env transformation injektuje `window.__SDM_CONFIG__`
do `index.html`.

### Tier 0: Build-time fallback

Build-time `.env` (`VITE_API_BASE_URL`, atď.) sa použije len ako **default**
keď ani Tier 1 ani Tier 2 nedoručia hodnotu (development convenience).
Build-time hodnoty sa NIKDY nepoužívajú v produkcii — explicitne assert
v code:

```ts
if (import.meta.env.MODE === 'production' && !config.apiBaseUrl) {
  throw new Error('Runtime config not loaded; aborting.');
}
```

## Dôsledky

**Pozitívne**:
1. **Žiadny rebuild per customer** — jeden build artefakt, customer-specific
   `config.json`.
2. **Hot config update** — customer mení `config.json`, BFF refresh-ne, nový
   tab dostane novú hodnotu. Žiadny restart.
3. **Feature flags out-of-the-box** — `features.kbAnalytics` toggle bez
   redeploy.
4. **Per-environment configurability** — dev, staging, prod majú vlastné
   `config.json`, build artefakt rovnaký.
5. **Branding** — primary color, logo, product name customer-specific bez
   custom build per customer.

**Negatívne**:
1. **Extra round-trip pri bootstrape** — `/config` request blokuje first
   render. Mitigácia: SPA `index.html` má `<link rel="preconnect">` na BFF,
   `<link rel="preload">` na `/config`. Latencia BFF → /config je < 50 ms
   v normálnom prevádzke. Acceptable pre TTI cieľ.
2. **BFF dependency pre štart** — ak BFF down, SPA sa nenaštartuje. Mitigácia:
   `index.html` má fallback UI "Service Desk je momentálne nedostupný — skús
   neskôr". Hosted statically, žiadny BFF call.
3. **Config schema versioning** — ak meníme schema, FE musí gracefully
   handle starší config (TBD). MVP: schema fixed; v1 evaluate.

## Alternatívy

### A) Build-time `.env` only

**Prečo zamietnuté**:
- Per-customer rebuild. GOAL §11 výslovne hovorí "Endpoint sa preto rieši
  cez ... runtime config.json načítaný pri štarte (kritické pre on-prem)".

### B) Config v cookie (set BFF-om)

**Prečo zamietnuté**:
- Cookie size limit (4 kB) — branding s logoUrl, features mapy by stiesnili.
- Cookie sa nedá inkrementálne updatovať (post-restart cookie môže byť
  stale).

### C) Config inline v `index.html` only (žiadny BFF endpoint)

**Prečo zamietnuté ako primary**:
- Customer musí post-build modifikovať `index.html` — fragile, error-prone.
- Hot update vyžaduje regenerovať `index.html` per change.
- Tier 2 ho podporuje ako fallback, ale nie primary.

### D) Config v IndexedDB / localStorage (cache + refresh)

**Prečo zamietnuté pre primary**:
- Initial bootstrap stále potrebuje fresh fetch.
- Stale cache môže ukázať starý features state.

## Otvorené závislosti

| # | Flag | Smer | Popis |
|---|---|---|---|
| 1 | `config-schema-versioning` | → 08-devex-devops | Verzia `config.json` (header field `schemaVersion`) — kontrakt medzi BFF a FE. |
| 2 | `secrets-handling` | → 05-security, 08-devex-devops | Žiadne secrets v `config.json` — env vars / Vault / iný secret store. Security agent finalizuje. |
| 3 | `feature-flag-flow` | → 04-architecture (post-MVP) | Per-user / per-tenant feature flags (post-MVP). MVP: global flags v `config.json`. |
| 4 | `config-file-watcher` | → 06-tech-stack, 08-devex-devops | BFF implementation — `chokidar` / native `fs.watch` / poll 30 s. |
| 5 | `branding-asset-source` | → 07-design-system, 08-devex-devops | Logo/colors per customer — kde žijú assety (BFF served vs. external CDN). |
