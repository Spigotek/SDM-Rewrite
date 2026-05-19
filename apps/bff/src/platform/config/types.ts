import { z } from "zod";

/**
 * Canonical FE-facing `RuntimeConfig` shape per
 * `docs/agents/devex-devops/runtime-config.md`.
 *
 * **Not** the same as `apps/bff/src/config/schema.ts` — that one is the BFF
 * process env (CASDM_BASE_URL, session driver, ...). This shape is what BFF
 * serves to the SPA from `GET /config` and what the SPA validates in its
 * own `bootstrap/config.ts`. The two diverge by design.
 */

export const AuthConfigSchema = z.object({
  mode: z.enum(["sso-oidc", "sso-saml", "rest-access-key"]),
  bffOrigin: z.string().url(),
  issuer: z.string().url().optional(),
  clientId: z.string().optional(),
  redirectPath: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  samlSpEntityId: z.string().optional(),
  samlIdpUrl: z.string().url().optional(),
  restAccessKeyEndpoint: z.string().optional(),
  tokenStorageKey: z.string().optional(),
  tokenLifetimeSeconds: z.number().int().positive().optional(),
});

export const TenantsConfigSchema = z.object({
  defaultMode: z.enum(["user-profile", "subdomain", "explicit-select"]),
  tenantContextHeader: z.string().default("X-CA-SDM-Tenant"),
  allowSwitching: z.boolean().default(true),
});

export const FeatureFlagsSchema = z.object({
  kbEditor: z.boolean().default(false),
  cmdbVisualizer: z.boolean().default(false),
  bulkOperations: z.boolean().default(false),
  changeCalendar: z.boolean().default(false),
  reportingWidgets: z.boolean().default(false),
});

export const ObservabilityConfigSchema = z.object({
  sentryDsn: z.string().optional(),
  sentryEnvironment: z.string().optional(),
  sentrySampleRate: z.number().min(0).max(1).optional(),
  rumEnabled: z.boolean().optional(),
});

export const ConfigMetaSchema = z.object({
  appVersion: z.string(),
  buildId: z.string(),
  deployedAt: z.string(),
});

export const RuntimeConfigSchema = z.object({
  apiBaseUrl: z.string().url(),
  apiBasePath: z.string().default("/api"),
  auth: AuthConfigSchema,
  tenants: TenantsConfigSchema,
  features: FeatureFlagsSchema,
  observability: ObservabilityConfigSchema.default({}),
  meta: ConfigMetaSchema,
});

export type RuntimeConfigPublic = z.infer<typeof RuntimeConfigSchema>;
