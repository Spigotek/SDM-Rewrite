// Runtime config loader — fetches /config from BFF (or MSW mock in dev).
// Plný RuntimeConfig kontrakt per docs/agents/devex-devops/runtime-config.md
// príde s Phase F.4; v E.3 berieme len shape, ktorý mock dnes vystavuje.

export interface RuntimeFeatures {
  readonly enableTenantSwitcher: boolean;
  readonly enableKbSearch: boolean;
  readonly enableAuditViewer: boolean;
}

export interface RuntimeRelease {
  readonly version: string;
  readonly buildSha: string;
}

export interface RuntimeConfig {
  readonly apiBaseUrl: string;
  readonly authMode: string;
  readonly features: RuntimeFeatures;
  readonly release: RuntimeRelease;
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
