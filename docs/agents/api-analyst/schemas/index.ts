/**
 * CA SDM 17.4 — Public schema bundle.
 *
 * Re-export všetkých TypeScript typov, ktoré popisujú entity a request/response
 * tvary CA Service Desk Manager 17.4 REST API. Používa sa ako single source
 * of truth pre `packages/api-client` a `packages/domain`.
 *
 * Modulárna štruktúra (per scope GOAL.md §3):
 *   - common.ts        — building blocks (timestamp, UUID, refs, pagination)
 *   - auth.ts          — auth flow types
 *   - contact.ts       — Contact, Tenant, Group
 *   - incident.ts      — `in` factory + activity log + transitions
 *   - request.ts       — `cr` factory + activity log + status
 *   - problem.ts       — `pr` factory
 *   - change.ts        — `chg` + workflow tasks + change activity log
 *   - knowledge.ts     — KCAT, KD, comments, links
 *   - cmdb.ts          — `nr` (CI), relationships, families, locations
 *   - attachment.ts    — `attmnt` + folders + multipart upload payload
 *   - reference.ts     — priority, severity, impact, urgency, categories
 *   - service-catalog.ts — Service Point offerings + pcat search
 */

export * from "./common";
export * from "./auth";
export * from "./contact";
export * from "./incident";
export * from "./request";
export * from "./problem";
export * from "./change";
export * from "./knowledge";
export * from "./cmdb";
export * from "./attachment";
export * from "./reference";
export * from "./service-catalog";
