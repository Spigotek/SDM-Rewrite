/**
 * Canonical audit event taxonomy per `docs/agents/security/audit-and-compliance.md` §2.
 *
 * Only the events listed under F.4 Done-when are wired in this chunk — the rest
 * are reserved names so an SIEM consumer can validate against the full schema
 * (forward compatibility). Adding a new emit site means importing the canonical
 * name from here; no string literals at call sites.
 */

export type AuditCategory = "auth" | "authz" | "sensitive" | "security" | "data";

export type AuditResult = "success" | "failure" | "denied";

/** Schema version of the AuditEvent payload — bump on breaking shape changes. */
export const AUDIT_SCHEMA_VERSION = "1.0" as const;

/**
 * Names are the canonical strings emitted in `event` field. They mirror §2
 * tables verbatim. Wired-in-MVP set is the subset enforced by F.4 Done-when;
 * the rest are reserved + ready for follow-up chunks (post-MVP step-up MFA,
 * SP impersonation, GDPR endpoints, etc.).
 */
export const AUDIT_EVENTS = {
  auth: {
    LOGIN_SUCCESS: "auth.login.success",
    LOGIN_FAILURE: "auth.login.failure",
    LOGOUT: "auth.logout",
    SESSION_HEARTBEAT: "auth.session.heartbeat",
    SESSION_IDLE_EXPIRED: "auth.session.idle.expired",
    SESSION_ABSOLUTE_EXPIRED: "auth.session.absolute.expired",
  },
  authz: {
    PERMISSION_DENIED: "authz.permission.denied",
    TENANT_SWITCH_SUCCESS: "authz.tenant.switch.success",
    TENANT_SWITCH_DENIED: "authz.tenant.switch.denied",
  },
  security: {
    CSRF_VIOLATION: "security.csrf.violation",
    RATE_LIMIT_EXCEEDED: "security.rate_limit.exceeded",
    TAMPERED_COOKIE: "security.tampered.cookie.detected",
  },
  sensitive: {
    BULK_OPERATION_EXECUTED: "sensitive.bulk.operation.executed",
    ATTACHMENT_DOWNLOAD_LARGE: "sensitive.attachment.download.large",
  },
  data: {
    /**
     * `data.<entity>.{write,delete}` — entity-specific names are composed at
     * call site (`auditEvents.data.write("incident")` → "data.incident.write")
     * because the entity catalogue is open-ended (in/cr/pr/chg/KD/nr today).
     * Reads have 0% sampling per §3 — covered by reverse proxy access log.
     */
    write: (entity: string): string => `data.${entity}.write`,
    delete: (entity: string): string => `data.${entity}.delete`,
  },
} as const;

/**
 * Sampling rates per §3. Returns 1.0 for "always", 0.01 for "1 in 100", etc.
 * The emit helper checks Math.random() < rate before serialising the payload —
 * cheap when sampled out (no JSON.stringify on every heartbeat).
 */
export function samplingRate(eventName: string): number {
  if (eventName === AUDIT_EVENTS.auth.SESSION_HEARTBEAT) return 0.01;
  return 1.0;
}
