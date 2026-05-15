# Runtime config — `config.json` kontrakt

## Changelog (round 2)

- **Tenant header zmenený z `X-CA-SDM-Tenant` na `X-CA-SDM-Tenant`** (04 r2 ADR-11 finálne).
- Pridané pole **`auth.bffOrigin`** v `AuthConfig` schema — URL BFF servera
  (dev `http://localhost:5174`, prod `https://sdm.example.org/bff`).
- Pridaný príklad č. **4 Production on-prem (BFF mode)** — finálny target po 04 r2 ADR-01.
- `apiBasePath` default zmenený z `/caisd-rest` na **`/api`** (BFF endpoint) — FE
  volá BFF, nie CA SDM priamo.
- Otvorené závislosti — uzavreté `[04-architecture]` BFF + multi-tenancy, `[05-security]` auth mode default.

> CA SDM 17.4 je **on-prem** produkt. Endpoint, IdP, tenant defaults a feature
> flagy sa **musia dať meniť bez rebuildu** — typický deployment cyklus on-prem
> je „zmeň config, reštartuj nginx", nie „rebuild + redeploy".
>
> Riešenie: `apps/<app>/public/config.json` — static JSON priložený k buildu,
> ale **prepísateľný** v target prostredí (typicky cez bind mount alebo nginx
> alias). Aplikácia ho načíta `fetch('/config.json')` **pred** prvým API volaním.
>
> Build-time `.env` premenné (`VITE_*`) slúžia ako **fallback** pre dev a
> mock-only mode.

## Kontrakt — schéma `config.json`

```ts
// packages/api-client/src/config.types.ts
export interface RuntimeConfig {
  apiBaseUrl: string;                     // BFF root URL, napr. "https://sdm.example.org"
  apiBasePath: string;                    // path prefix, default "/api" (BFF endpoint)
  auth: AuthConfig;
  tenants: TenantsConfig;
  features: FeatureFlags;
  observability: ObservabilityConfig;
  meta: ConfigMeta;
}

export interface AuthConfig {
  mode: "sso-oidc" | "sso-saml" | "rest-access-key";
  bffOrigin: string;                      // URL BFF servera (04 r2 ADR-01); dev "http://localhost:5174", prod "https://sdm.example.org/bff"
  issuer?: string;                        // OIDC issuer URL, len pre sso-oidc
  clientId?: string;                      // OIDC client ID, len pre sso-oidc
  redirectPath?: string;                  // OIDC callback path, default "/auth/callback"
  scopes?: string[];                      // default ["openid", "profile", "email"]
  samlSpEntityId?: string;                // len pre sso-saml
  samlIdpUrl?: string;                    // len pre sso-saml
  restAccessKeyEndpoint?: string;         // len pre rest-access-key (dev mock), default "/caisd-rest/rest_access"
  tokenStorageKey?: string;               // localStorage key, default "sdm-token"
  tokenLifetimeSeconds?: number;          // default 3600
}

export interface TenantsConfig {
  defaultMode: "user-profile" | "subdomain" | "explicit-select";
  // user-profile: použiť default tenant z /me response (BFF aggregator).
  // subdomain: extract z hostname (acme.portal.example → tenant "acme").
  // explicit-select: pri prvom prihlásení nechať usera zvoliť.
  tenantContextHeader: string;            // 04 r2 ADR-11: "X-CA-SDM-Tenant"
  allowSwitching: boolean;                // default true
}

export interface FeatureFlags {
  kbEditor: boolean;                      // KB write+publish (v1)
  cmdbVisualizer: boolean;                // CMDB graph view (v1)
  bulkOperations: boolean;                // queue bulk actions (v1)
  changeCalendar: boolean;                // advanced calendar (v1)
  reportingWidgets: boolean;              // dashboard widgets (v1)
}

export interface ObservabilityConfig {
  sentryDsn?: string;
  sentryEnvironment?: string;             // "production" | "staging" | "development"
  sentrySampleRate?: number;              // 0.0..1.0, default 0.2
  rumEnabled?: boolean;                   // Real user monitoring
}

export interface ConfigMeta {
  appVersion: string;                     // semver, injektnutý buildom z package.json
  buildId: string;                        // git short SHA, injektnutý buildom
  deployedAt: string;                     // ISO timestamp, vyplnené deploy skriptom
}
```

## Príklady

### 1. Mock-only dev (default v lokálnom `pnpm dev`)

`apps/portal/public/config.json`:

```json
{
  "apiBaseUrl": "http://localhost:5173",
  "apiBasePath": "/api",
  "auth": {
    "mode": "rest-access-key",
    "bffOrigin": "http://localhost:5174",
    "restAccessKeyEndpoint": "/caisd-rest/rest_access"
  },
  "tenants": {
    "defaultMode": "user-profile",
    "tenantContextHeader": "X-CA-SDM-Tenant",
    "allowSwitching": true
  },
  "features": {
    "kbEditor": false,
    "cmdbVisualizer": false,
    "bulkOperations": false,
    "changeCalendar": false,
    "reportingWidgets": false
  },
  "observability": {
    "sentryDsn": "",
    "rumEnabled": false
  },
  "meta": {
    "appVersion": "0.1.0-dev",
    "buildId": "local",
    "deployedAt": "2026-05-15T00:00:00Z"
  }
}
```

### 2. Production on-prem (OIDC SSO + BFF)

```json
{
  "apiBaseUrl": "https://sdm.example.org",
  "apiBasePath": "/api",
  "auth": {
    "mode": "sso-oidc",
    "bffOrigin": "https://sdm.example.org/bff",
    "issuer": "https://idp.example.org/realms/corp",
    "clientId": "sdm-portal",
    "redirectPath": "/auth/callback",
    "scopes": ["openid", "profile", "email"],
    "tokenLifetimeSeconds": 3600
  },
  "tenants": {
    "defaultMode": "user-profile",
    "tenantContextHeader": "X-CA-SDM-Tenant",
    "allowSwitching": true
  },
  "features": {
    "kbEditor": false,
    "cmdbVisualizer": false,
    "bulkOperations": false,
    "changeCalendar": false,
    "reportingWidgets": false
  },
  "observability": {
    "sentryDsn": "https://example@sentry.example.org/123",
    "sentryEnvironment": "production",
    "sentrySampleRate": 0.1,
    "rumEnabled": true
  },
  "meta": {
    "appVersion": "1.0.0",
    "buildId": "a1b2c3d",
    "deployedAt": "2026-06-01T08:00:00Z"
  }
}
```

### 3. Staging (BFF mode)

```json
{
  "apiBaseUrl": "https://sdm-staging.example.org",
  "apiBasePath": "/api",
  "auth": {
    "mode": "sso-oidc",
    "bffOrigin": "https://sdm-staging.example.org/bff",
    "issuer": "https://idp-staging.example.org/realms/corp",
    "clientId": "sdm-portal-staging"
  },
  "tenants": {
    "defaultMode": "user-profile",
    "tenantContextHeader": "X-CA-SDM-Tenant",
    "allowSwitching": true
  },
  "features": {
    "kbEditor": true,
    "cmdbVisualizer": true,
    "bulkOperations": false,
    "changeCalendar": false,
    "reportingWidgets": true
  },
  "observability": {
    "sentryDsn": "https://example@sentry.example.org/124",
    "sentryEnvironment": "staging",
    "sentrySampleRate": 1.0,
    "rumEnabled": true
  },
  "meta": {
    "appVersion": "1.1.0-rc1",
    "buildId": "e5f6789",
    "deployedAt": "2026-05-20T14:30:00Z"
  }
}
```

## Loader — `packages/api-client/src/config.ts`

```ts
import type { RuntimeConfig } from "./config.types";
import { configSchema } from "./config.schema";

let cachedConfig: RuntimeConfig | null = null;

/**
 * Načíta runtime config zo /config.json. Volá sa pri štarte aplikácie,
 * pred prvým API requestom. Idempotentné — opakované volanie vráti cached.
 *
 * Fallback: ak fetch zlyhá (404), použije VITE_* premenné z build-time.
 * Tento fallback je pre lokálny dev (Vite serve neserve-uje /config.json
 * dokým neni v public/) — production musí mať config.json existujúci.
 */
export async function loadConfig(): Promise<RuntimeConfig> {
  if (cachedConfig) return cachedConfig;

  try {
    const response = await fetch("/config.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`config.json HTTP ${response.status}`);
    const raw = await response.json();
    cachedConfig = configSchema.parse(raw);   // zod validation — fail fast
    return cachedConfig;
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn("[config] /config.json not found, falling back to .env defaults", err);
      cachedConfig = buildFallbackFromEnv();
      return cachedConfig;
    }
    throw new Error(`Failed to load runtime config: ${(err as Error).message}`);
  }
}

export function getConfig(): RuntimeConfig {
  if (!cachedConfig) {
    throw new Error("Config not loaded. Call loadConfig() before getConfig().");
  }
  return cachedConfig;
}

function buildFallbackFromEnv(): RuntimeConfig {
  return {
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5173",
    apiBasePath: import.meta.env.VITE_API_BASE_PATH ?? "/api",
    auth: {
      mode: (import.meta.env.VITE_AUTH_MODE as "rest-access-key") ?? "rest-access-key",
      bffOrigin: import.meta.env.VITE_BFF_ORIGIN ?? "http://localhost:5174",
    },
    tenants: {
      defaultMode: "user-profile",
      tenantContextHeader: "X-CA-SDM-Tenant",
      allowSwitching: true,
    },
    features: {
      kbEditor: false,
      cmdbVisualizer: false,
      bulkOperations: false,
      changeCalendar: false,
      reportingWidgets: false,
    },
    observability: { rumEnabled: false },
    meta: {
      appVersion: "0.0.0-dev",
      buildId: "local",
      deployedAt: new Date().toISOString(),
    },
  };
}
```

## Bootstrap v `main.tsx`

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { loadConfig } from "@sdm/api-client/config";

async function bootstrap() {
  // 1. Načítaj runtime config (z /config.json)
  const config = await loadConfig();

  // 2. Bootstrap observability (Sentry) — môže používať config.observability
  if (config.observability.sentryDsn) {
    const Sentry = await import("@sentry/react");
    Sentry.init({
      dsn: config.observability.sentryDsn,
      environment: config.observability.sentryEnvironment,
      tracesSampleRate: config.observability.sentrySampleRate ?? 0.2,
      release: config.meta.buildId,
    });
  }

  // 3. Bootstrap mocks (iba ak je explicitne ON)
  if (import.meta.env.VITE_USE_MOCKS === "true") {
    const { worker } = await import("./mocks/browser");
    await worker.start({ onUnhandledRequest: "warn" });
  }

  // 4. Render
  ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
}

bootstrap().catch((err) => {
  console.error("Bootstrap failed:", err);
  document.body.innerHTML = `<pre style="padding: 2rem">Bootstrap failed: ${err.message}</pre>`;
});
```

## Zod schema — `packages/api-client/src/config.schema.ts`

```ts
import { z } from "zod";

const authConfigSchema = z.object({
  mode: z.enum(["sso-oidc", "sso-saml", "rest-access-key"]),
  bffOrigin: z.string().url(),                                       // 04 r2 ADR-01 — povinné v r2
  issuer: z.string().url().optional(),
  clientId: z.string().optional(),
  redirectPath: z.string().default("/auth/callback"),
  scopes: z.array(z.string()).default(["openid", "profile", "email"]),
  samlSpEntityId: z.string().optional(),
  samlIdpUrl: z.string().url().optional(),
  restAccessKeyEndpoint: z.string().default("/caisd-rest/rest_access"),
  tokenStorageKey: z.string().default("sdm-token"),
  tokenLifetimeSeconds: z.number().int().positive().default(3600),
}).superRefine((cfg, ctx) => {
  if (cfg.mode === "sso-oidc" && (!cfg.issuer || !cfg.clientId)) {
    ctx.addIssue({ code: "custom", message: "sso-oidc requires issuer + clientId" });
  }
  if (cfg.mode === "sso-saml" && (!cfg.samlSpEntityId || !cfg.samlIdpUrl)) {
    ctx.addIssue({ code: "custom", message: "sso-saml requires samlSpEntityId + samlIdpUrl" });
  }
});

const tenantsConfigSchema = z.object({
  defaultMode: z.enum(["user-profile", "subdomain", "explicit-select"]).default("user-profile"),
  tenantContextHeader: z.string().default("X-CA-SDM-Tenant"),               // 04 r2 ADR-11
  allowSwitching: z.boolean().default(true),
});

const featureFlagsSchema = z.object({
  kbEditor: z.boolean().default(false),
  cmdbVisualizer: z.boolean().default(false),
  bulkOperations: z.boolean().default(false),
  changeCalendar: z.boolean().default(false),
  reportingWidgets: z.boolean().default(false),
});

const observabilityConfigSchema = z.object({
  sentryDsn: z.string().url().optional(),
  sentryEnvironment: z.string().optional(),
  sentrySampleRate: z.number().min(0).max(1).default(0.2),
  rumEnabled: z.boolean().default(false),
});

const configMetaSchema = z.object({
  appVersion: z.string(),
  buildId: z.string(),
  deployedAt: z.string().datetime(),
});

export const configSchema = z.object({
  apiBaseUrl: z.string().url(),
  apiBasePath: z.string().default("/caisd-rest"),
  auth: authConfigSchema,
  tenants: tenantsConfigSchema,
  features: featureFlagsSchema,
  observability: observabilityConfigSchema,
  meta: configMetaSchema,
});
```

`configSchema.parse(raw)` zlyhá **rýchlo a hlasno**, ak `config.json` nemá
povinné polia alebo má zlé typy. Production deploy nemôže prejsť cez "tichý"
runtime degrade.

## Deploy stratégia

### nginx (typický on-prem)

`nginx.conf` server block:

```nginx
server {
  listen 80;
  server_name portal.example.org;

  root /var/www/sdm-portal;

  # Static SPA assets s long cache
  location ~* \.(js|css|woff2|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  # config.json — bind mount cez Docker volume / Ansible template,
  # NIE súčasť SPA buildu
  location = /config.json {
    alias /etc/sdm/portal-config.json;     # mimo SPA bundle
    add_header Cache-Control "no-store";    # vždy fresh
  }

  # SPA fallback
  location / {
    try_files $uri /index.html;
    add_header Cache-Control "no-store" always;
  }
}
```

### Docker volume

```yaml
# docker-compose.yml (príklad)
services:
  sdm-portal:
    image: sdm-rewrite-portal:1.0.0
    volumes:
      - ./config/portal-config.json:/usr/share/nginx/html/config.json:ro
    ports:
      - "80:80"
```

### Build-time injection — `meta` polia

`apps/portal/scripts/build.ts` (Phase C):

```ts
import { execSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import pkg from "../package.json" with { type: "json" };

const buildId = execSync("git rev-parse --short HEAD").toString().trim();
const deployedAt = new Date().toISOString();

const config = JSON.parse(await readFile("public/config.json", "utf-8"));
config.meta = {
  appVersion: pkg.version,
  buildId,
  deployedAt,
};
await writeFile("dist/config.json", JSON.stringify(config, null, 2));
```

`pnpm build` v `apps/portal/package.json`:

```jsonc
"build": "vite build && tsx scripts/build.ts"
```

## Feature flags — runtime toggle bez code change

Príklad — workspace queue chce zapnúť bulk operations v staging:

1. SSH do staging nginx hosta.
2. `vim /etc/sdm/workspace-config.json` → `"bulkOperations": true`.
3. Nedeploy, žiadny rebuild. Stačí browser hard-refresh (lebo `Cache-Control: no-store`).

UI musí byť pripravené:

```tsx
import { getConfig } from "@sdm/api-client/config";

function QueueToolbar() {
  const { features } = getConfig();
  return (
    <div>
      <button>Refresh</button>
      {features.bulkOperations && <BulkActionsMenu />}
    </div>
  );
}
```

## CSP & runtime config

Content-Security-Policy musí povoľovať `fetch('/config.json')`. Default Vite/nginx
to dovoľuje (`connect-src 'self'`). Žiadne action needed.

## Security poznámky

- `config.json` **nesmie obsahovať secrets**. Žiadne API keys, OIDC client
  secrets, DB hesielka. Iba **veřejné** identifikátory (issuer URL, clientId,
  feature flags, Sentry DSN — DSN je verejné, nie secret).
- Auth token (OIDC access token) sa NIKDY neuloží do `config.json`. Token žije
  v session storage / Authorization header.
- `config.json` je **read-only** z pohľadu aplikácie. Žiadny endpoint pre
  `PUT /config.json`.

## Verzionovanie schémy

Ak sa pridá nový field, default hodnota cez zod (`.default(...)`) zachová
spätnú kompatibilitu so staršími `config.json`. Breaking change (rename /
remove povinného fieldu) zvyšuje major version aplikácie, deploy notes
zachytávajú migration.

`config.json` momentálne nemá explicit `version` field — to je zámerne, schema
je single-version. Pri breaking change pridáme `meta.configSchemaVersion`.

## Otvorené závislosti

- `[05-security]` Auth mode default — `[resolved-in-round-2]`. Production: `sso-oidc` (OIDC redirect cez BFF). Dev: `rest-access-key` (permissive mock). Schema podporuje všetky 3, 05 dodá reálnu implementáciu loaderov v `packages/auth/`.
- `[04-architecture]` `apiBasePath` — `[resolved-in-round-2]`. **`/api`** (BFF endpoint). FE volá BFF, nie CA SDM priamo.
- `[04-architecture]` Multi-tenancy header — `[resolved-in-round-2]`. 04 ADR-11 finalizoval **`X-CA-SDM-Tenant`**. Zod schema default + všetky 3 príklady aktualizované.
- `[04-architecture]` `auth.bffOrigin` — `[resolved-in-round-2]`. Pridané v r2 ako povinné pole (`bffOrigin: z.string().url()`). Dev: `http://localhost:5174`, prod: `https://sdm.example.org/bff`.
- `[07-design-system]` Sentry release tracking používa `meta.buildId`. Žiadny impact na design-system, len pre úplnosť.
- `[?]` Field `features.*` momentálne mapuje na v1 features z GOAL §3. Ak post-MVP pribudnú ďalšie, schema sa rozšíri (so `.default(false)`).
