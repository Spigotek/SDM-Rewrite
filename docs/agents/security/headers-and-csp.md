# Security headers a CSP predpis

> Cieľ: konkrétny set HTTP response headers a Content-Security-Policy value
> pre Portal SPA, Workspace SPA a BFF endpointy. Reverse proxy / BFF musí
> tieto headers ustanoviť uniformne.
>
> Cross-ref: `auth-flow.md` (cookies), `owasp-mitigations.md` (A02/A03/A05),
> `threat-model.md`.

## 0. Aplikovanie

Všetky headers sa nastavujú v **reverse proxy** (Nginx / Envoy / Traefik —
podľa rozhodnutia DevOps) a/alebo v **BFF** stredware (Helmet / equivalent).
Reverse proxy je preferovaný layer, BFF je fallback ak proxy nie je v scope.

| Header / Cookie | Portal SPA response | Workspace SPA response | BFF API response |
|---|---|---|---|
| `Content-Security-Policy` | viď §1 | viď §1 | `default-src 'none'` (JSON only) |
| `Strict-Transport-Security` | yes | yes | yes |
| `X-Content-Type-Options` | yes | yes | yes |
| `X-Frame-Options` | yes | yes | yes |
| `Referrer-Policy` | yes | yes | yes |
| `Permissions-Policy` | yes | yes | yes |
| `Cross-Origin-Opener-Policy` | yes | yes | yes |
| `Cross-Origin-Embedder-Policy` | optional | optional | n/a |
| `Cross-Origin-Resource-Policy` | yes | yes | yes |
| `Cache-Control` | varies | varies | `no-store` for /auth/*, /me, /api/* |
| `Server` | stripped | stripped | stripped |
| `X-Powered-By` | stripped | stripped | stripped |

## 1. Content-Security-Policy

### 1.1 Konkrétny CSP value — `portal`

```
Content-Security-Policy:
  default-src 'none';
  script-src 'self' 'nonce-{NONCE}';
  style-src 'self' 'nonce-{NONCE}';
  img-src 'self' data: blob:;
  font-src 'self';
  connect-src 'self' https://bff.example.org https://sentry.example.org;
  frame-src 'none';
  frame-ancestors 'none';
  form-action 'self';
  base-uri 'self';
  manifest-src 'self';
  worker-src 'self';
  object-src 'none';
  media-src 'self';
  upgrade-insecure-requests;
  report-uri https://bff.example.org/csp-report;
  report-to csp-endpoint;
```

Hlavičke odpovedá tiež **Reporting-Endpoints**:
```
Reporting-Endpoints: csp-endpoint="https://bff.example.org/csp-report"
```

### 1.2 Konkrétny CSP value — `workspace`

Identický ako portal s rozšírením `connect-src` o ďalšie BFF endpointy ak by ich bolo viac:

```
Content-Security-Policy:
  default-src 'none';
  script-src 'self' 'nonce-{NONCE}';
  style-src 'self' 'nonce-{NONCE}';
  img-src 'self' data: blob:;
  font-src 'self';
  connect-src 'self' https://bff.example.org wss://bff.example.org https://sentry.example.org;
  frame-src 'none';
  frame-ancestors 'none';
  form-action 'self';
  base-uri 'self';
  manifest-src 'self';
  worker-src 'self';
  object-src 'none';
  media-src 'self';
  upgrade-insecure-requests;
  report-uri https://bff.example.org/csp-report;
  report-to csp-endpoint;
```

> `wss://` je pre prípadný WebSocket push (notifications / live updates).
> Ak Architecture rozhodne polling-only, `wss://` sa vypustí.

### 1.3 Justifikácia per direktíva

| Direktíva | Hodnota | Prečo |
|---|---|---|
| `default-src 'none'` | – | Default-deny baseline. Každá ďalšia direktíva explicit allow. |
| `script-src 'self' 'nonce-{NONCE}'` | own origin + per-request nonce | Eliminuje XSS injection. Nonce regenerovaný per response (HTML template). Žiadne `'unsafe-inline'`, žiadne `'unsafe-eval'`. |
| `style-src 'self' 'nonce-{NONCE}'` | own origin + nonce | CSS-in-JS knižnice vyžadujú nonce. Bez `'unsafe-inline'`. |
| `img-src 'self' data: blob:` | own + inline data + blob | `data:` pre SVG icony, `blob:` pre attachment preview. |
| `font-src 'self'` | own only | Self-hosted fonts (žiadny Google Fonts CDN — supply chain risk). |
| `connect-src 'self' https://bff.<org>` | BFF + Sentry | Fetch endpointy. Same-origin alebo trusted BFF. |
| `frame-src 'none'` | – | Žiadne embedded iframe (chat widgets, video, ...). |
| `frame-ancestors 'none'` | – | Anti-clickjacking. Žiadna iná stránka nemôže embeddovať SPA. |
| `form-action 'self'` | own only | Form submit len na vlastný origin (auth flow ide cez fetch, nie form submit). |
| `base-uri 'self'` | – | `<base href>` injection mitigation. |
| `manifest-src 'self'` | – | PWA manifest. |
| `worker-src 'self'` | – | Service Worker pre PWA. |
| `object-src 'none'` | – | No Flash, no Java applet, no `<embed>`. |
| `media-src 'self'` | – | `<video>`, `<audio>` len z own origin (attachment downloads). |
| `upgrade-insecure-requests` | – | Forcing HTTPS subresources. |
| `report-uri` / `report-to` | BFF endpoint | CSP violation reporting; analyzuje sa v SIEM. |

### 1.4 Nonce strategy

- BFF (alebo reverse proxy) generuje nonce **per HTML response**: cryptographically random ≥128 bits, base64-encoded.
- HTML template má `<script nonce="{NONCE}">`. Pre SPA build (Vite / equivalent) je nonce injection cez post-build step alebo proxy middleware.
- React 18+ tree neobsahuje `<script>` tags (bundle je v `<head>`), takže nonce je primárne pre bootstrap script + analytics if any.

> ⚠️ Niektoré CSS-in-JS knižnice (emotion, styled-components) vkladajú `<style>`
> tagy at runtime. Vyžadujú nonce alebo `'unsafe-inline'`. Preferovaný approach:
> static CSS extraction (Vite native pre `.module.css` / equivalent) namiesto
> runtime injection.

### 1.5 CSP rollout — Report-Only first

Pre prvé 2 týždne v staging / pilot:

```
Content-Security-Policy-Report-Only: <same as production>
```

Monitor `/csp-report` endpoint, opraviť false positives, switch na enforcing.

## 2. Strict-Transport-Security (HSTS)

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

| Atribút | Hodnota | Prečo |
|---|---|---|
| `max-age=63072000` | 2 roky | Required for HSTS preload list. |
| `includeSubDomains` | – | All subdomains forced HTTPS (portal, workspace, bff). |
| `preload` | – | Submit to https://hstspreload.org once stable. |

> ⚠️ `includeSubDomains` + `preload` má vysoký commitment — nemožno rýchlo
> revert. Pred submission overiť, že **všetky** subdomains pod root domain
> sú HTTPS-only.

## 3. X-Content-Type-Options

```
X-Content-Type-Options: nosniff
```

Disables MIME sniffing. Eliminuje attack vector kde browser interpretuje upload-ed file ako script.

## 4. X-Frame-Options

```
X-Frame-Options: DENY
```

Backstop pre staršie browsers, ktoré nepodporujú `frame-ancestors`. Redundant s CSP `frame-ancestors 'none'`, ale low cost.

## 5. Referrer-Policy

```
Referrer-Policy: strict-origin-when-cross-origin
```

Send full URL na same-origin, len origin (no path) na cross-origin HTTPS, nič na HTTPS→HTTP downgrade. Vyvážuje analytics utility a privacy.

Alternatíva pre sensitive admin pages: `no-referrer`.

## 6. Permissions-Policy

```
Permissions-Policy:
  accelerometer=(),
  ambient-light-sensor=(),
  autoplay=(),
  battery=(),
  camera=(),
  cross-origin-isolated=(),
  display-capture=(),
  encrypted-media=(),
  fullscreen=(self),
  geolocation=(),
  gyroscope=(),
  hid=(),
  identity-credentials-get=(),
  idle-detection=(),
  keyboard-map=(),
  magnetometer=(),
  microphone=(),
  midi=(),
  navigation-override=(),
  payment=(),
  picture-in-picture=(),
  publickey-credentials-create=(self),
  publickey-credentials-get=(self),
  screen-wake-lock=(),
  serial=(),
  speaker-selection=(),
  storage-access=(),
  usb=(),
  web-share=(self),
  window-management=(),
  xr-spatial-tracking=()
```

Disable všetky senzitívne API. `publickey-credentials-*=(self)` ponecháva WebAuthn pre prípadnú step-up integráciu. `web-share=(self)` pre share API (mobile portal). `fullscreen=(self)` pre KB editor / CMDB graph view full-screen mode.

## 7. Cross-Origin headers

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp   # optional, vyžaduje COEP pre subresources
```

- **COOP `same-origin`** — izoluje browsing context group. Defends proti Spectre-style attacks a `window.opener` leakage.
- **CORP `same-origin`** — zabraňuje cross-origin loadu (image hot-linking, embedding). Pre attachment endpoint BFF nastaví `Cross-Origin-Resource-Policy: same-origin`.
- **COEP `require-corp`** — opt-in pre SharedArrayBuffer / WebAssembly threads. Vyžaduje CORP/CORS-validated all subresources. **Optional** pre MVP, povinný len ak by sme používali WASM workers.

## 8. Cache-Control

| Endpoint type | Cache-Control |
|---|---|
| Static SPA assets (`*.js`, `*.css`, fonts) | `public, max-age=31536000, immutable` (fingerprinted filenames) |
| SPA HTML entry (`index.html`) | `no-cache, no-store, must-revalidate` |
| BFF `/auth/*`, `/me` | `no-store` |
| BFF `/api/*` | `private, no-cache` (default; per-endpoint override allowed for read-mostly with explicit Vary) |
| Attachment download | `private, max-age=300, no-store` (no-store ak sensitive) |
| Health endpoint | `no-store` |

> Sensitive API responses **nikdy** v shared cache. `private, no-cache` je default.
> `no-store` pre `/auth/*` a `/me` (zabraňuje cache odoslanému HTML s session metadata).

## 9. Server / X-Powered-By strip

```
# Nginx
server_tokens off;
more_clear_headers Server;
more_clear_headers X-Powered-By;
```

Reverse proxy strip-ne `Server:` header s verziou, BFF strip-ne `X-Powered-By: Express` (alebo equivalent).

## 10. CORS — kontrakt

SPA a BFF su za rovnakou root domain (`portal.<org>`, `workspace.<org>`, `bff.<org>`).
Pre cross-subdomain calls **CORS je potrebný**.

### 10.1 BFF CORS config

```
Access-Control-Allow-Origin: https://portal.example.org
Access-Control-Allow-Origin: https://workspace.example.org   # vary by origin
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, X-CSRF-Token, X-Correlation-Id
Access-Control-Max-Age: 600
Vary: Origin
```

**Invariants:**

- Origin whitelist — **explicit string equality**, nikdy `*`, nikdy regex.
- `Access-Control-Allow-Credentials: true` len pre whitelisted origins (default-deny).
- Preflight OPTIONS responses cache 600 s.

### 10.2 Same-origin alternatíva

Ak DevOps zvolí deployment **pod jednou root doménou** (`example.org/portal/`, `example.org/workspace/`, `example.org/api/`), CORS nie je potrebný. To je odporúčaný setup pre on-prem (jednoduchší TLS cert, žiadne CORS headache). Ovplyvní cookie scope (`Path=/portal`, `Path=/workspace`) — ale za cenu, že BFF cookie funguje len pod jedným path-om. Preferovaný approach: **subdomain + CORS** alebo **same-origin so split path** — Architecture decision.

## 11. CSP-report endpoint

BFF expose:

```
POST /csp-report
Content-Type: application/csp-report
```

Body je JSON s `{ csp-report: { document-uri, violated-directive, blocked-uri, ... } }`.

BFF:
1. Schema-validate body (drop malformed).
2. Rate limit per IP (10/min) — anti-flood.
3. Forward to SIEM with category `csp_violation`.
4. Return 204.

> ⚠️ CSP reports sú **untrusted input**. Treat ako log entry, nikdy nepoužiť ako auth signal.

## 12. CSP violations dashboard — alert thresholds

V SIEM definovať alerts:

| Pattern | Threshold | Action |
|---|---|---|
| `blocked-uri` = `inline` v `script-src` violation | > 5 / hour | Investigate XSS attempt / dev mistake |
| Nový `blocked-uri` domain (not in whitelist) | first occurrence | Notify security team |
| Sudden spike of any CSP violation | > 100 / hour | Likely deployed regression — page on-call |

## 13. Headers test — kontrolný zoznam

Pred go-live audit cez:

- [ ] `curl -I https://portal.example.org/` — verify each header present.
- [ ] https://securityheaders.com — target grade A or A+.
- [ ] https://observatory.mozilla.org — target grade A+.
- [ ] https://csp-evaluator.withgoogle.com — verify CSP nemá `unsafe-*`.
- [ ] DevTools Network tab — verify Cache-Control per endpoint type.
- [ ] Cookie inspector — verify `__Host-` prefix, HttpOnly, Secure, SameSite.

## 14. Sample Nginx config snippet (referenčný)

```nginx
server {
    listen 443 ssl http2;
    server_name portal.example.org;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20:!aNULL:!MD5:!DSS';
    ssl_prefer_server_ciphers on;

    server_tokens off;

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Cross-Origin-Opener-Policy "same-origin" always;
    add_header Cross-Origin-Resource-Policy "same-origin" always;
    add_header Permissions-Policy "accelerometer=(), camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=(self), publickey-credentials-create=(self), publickey-credentials-get=(self), web-share=(self)" always;

    # CSP — nonce-based
    set $csp_nonce $request_id;   # or generate per response
    add_header Content-Security-Policy "default-src 'none'; script-src 'self' 'nonce-$csp_nonce'; style-src 'self' 'nonce-$csp_nonce'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://bff.example.org https://sentry.example.org; frame-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; manifest-src 'self'; worker-src 'self'; object-src 'none'; media-src 'self'; upgrade-insecure-requests; report-uri https://bff.example.org/csp-report" always;

    # static SPA assets
    location ~* \.(js|css|woff2?|svg|png|webp|avif)$ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # SPA entry
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;
    }

    location / {
        try_files $uri /index.html;
    }
}
```

## Otvorené závislosti

- `[04-architecture]` Voľba reverse proxy (Nginx / Envoy / Traefik / cloud LB) ovplyvní syntax configu. Kontrakt headers je proxy-agnostic.
- `[04-architecture]` Same-origin (split path) vs. subdomain deployment — ovplyvní CORS, cookie scope a CSP `connect-src`. Default: subdomain. Treba potvrdiť.
- `[06-tech-stack-selector]` CSS-in-JS knižnica vs. static CSS — ovplyvňuje style-src nonce strategy. Predpoklad: static-extracted CSS, žiadne runtime style injection.
- `[06-tech-stack-selector]` SPA build tool (Vite / Webpack / iné) — voľba ovplyvní nonce injection mechanizmus.
- `[08-devex-devops]` CSP report endpoint deployment + SIEM forwarding — DevOps response.
- `[08-devex-devops]` HSTS preload submission timing — po stabilizácii staging.
- `[?]` `web-share` API použijeme alebo nie pre mobile portal? — UX rozhodnutie.
- `[?]` WebSocket push pre live updates (`wss://` v CSP) — Architecture rozhodne ak je polling-only dostatočné, môže sa odstrániť.
