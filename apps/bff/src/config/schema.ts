import { z } from "zod";

/**
 * Env vars arrive as strings. `z.coerce.boolean()` is `Boolean(value)` which
 * coerces *any* non-empty string (including "false") to true. We need real
 * string parsing for boolean flags coming from the environment.
 */
const EnvBoolean = z.union([z.boolean(), z.string()]).transform((v, ctx) => {
  if (typeof v === "boolean") return v;
  const norm = v.trim().toLowerCase();
  if (norm === "true" || norm === "1" || norm === "yes" || norm === "on") return true;
  if (norm === "false" || norm === "0" || norm === "no" || norm === "off" || norm === "") {
    return false;
  }
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: `expected boolean-like string, got "${v}"`,
  });
  return z.NEVER;
});

export const RuntimeConfigSchema = z.object({
  nodeEnv: z.enum(["development", "test", "production"]).default("development"),
  bff: z.object({
    port: z.coerce.number().int().positive().default(5174),
    trustedOrigins: z.array(z.string().url()).min(1),
    logLevel: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  }),
  casdm: z.object({
    baseUrl: z.string().url(),
    basicAuthUser: z.string().min(1),
    basicAuthPass: z.string().min(1),
    requestTimeoutMs: z.coerce.number().int().positive().default(15000),
  }),
  session: z.object({
    driver: z.literal("memory").default("memory"),
    cookieName: z.string().min(1).default("sdm.sid"),
    cookieSecure: EnvBoolean.default(false),
    sameSite: z.enum(["Lax", "Strict", "None"]).default("Lax"),
    idleSec: z.coerce.number().int().positive().default(1800),
    absoluteSec: z.coerce.number().int().positive().default(28800),
    cookieMaxAgeSec: z.coerce.number().int().positive().default(28800),
  }),
  uiRoleMapping: z
    .record(
      z.string(),
      z.enum([
        "requester",
        "requester_external",
        "agent_l1",
        "agent_l2",
        "change_manager",
        "kb_editor",
        "cmdb_owner",
        "sp_admin",
      ]),
    )
    .default({}),
});

export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>;
