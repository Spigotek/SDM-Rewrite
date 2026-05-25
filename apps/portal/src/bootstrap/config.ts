// Runtime config loader — fetches /config from BFF (or MSW mock in dev).
// Canonical RuntimeConfig per docs/agents/devex-devops/runtime-config.md;
// mirrors BFF schema at apps/bff/src/platform/config/types.ts.

export interface AuthConfig {
  readonly mode: "sso-oidc" | "sso-saml" | "rest-access-key";
  readonly bffOrigin: string;
  readonly issuer?: string;
  readonly clientId?: string;
  readonly redirectPath?: string;
  readonly scopes?: readonly string[];
  readonly samlSpEntityId?: string;
  readonly samlIdpUrl?: string;
  readonly restAccessKeyEndpoint?: string;
  readonly tokenStorageKey?: string;
  readonly tokenLifetimeSeconds?: number;
}

export interface TenantsConfig {
  readonly defaultMode: "user-profile" | "subdomain" | "explicit-select";
  readonly tenantContextHeader: string;
  readonly allowSwitching: boolean;
}

export interface FeatureFlags {
  readonly kbEditor: boolean;
  readonly cmdbVisualizer: boolean;
  readonly bulkOperations: boolean;
  readonly changeCalendar: boolean;
  readonly reportingWidgets: boolean;
}

export interface ObservabilityConfig {
  readonly sentryDsn?: string;
  readonly sentryEnvironment?: string;
  readonly sentrySampleRate?: number;
  readonly rumEnabled?: boolean;
}

export interface ConfigMeta {
  readonly appVersion: string;
  readonly buildId: string;
  readonly deployedAt: string;
}

export interface RuntimeConfig {
  readonly apiBaseUrl: string;
  readonly apiBasePath: string;
  readonly auth: AuthConfig;
  readonly tenants: TenantsConfig;
  readonly features: FeatureFlags;
  readonly observability: ObservabilityConfig;
  readonly meta: ConfigMeta;
}

let cached: RuntimeConfig | null = null;

export async function loadConfig(): Promise<RuntimeConfig> {
  if (cached) return cached;
  const response = await fetch("/config", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`[config] /config HTTP ${response.status}`);
  }
  const data = (await response.json()) as RuntimeConfig;
  cached = data;
  return data;
}

export function getConfig(): RuntimeConfig {
  if (!cached) {
    throw new Error("[config] loadConfig() must be called before getConfig()");
  }
  return cached;
}
