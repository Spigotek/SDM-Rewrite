/**
 * Zod schema for the portal new-incident form.
 *
 * Validation rules mirror the wireframe `portal/02-new-ticket.md` §UI prvky:
 *
 *   - `category` — required, one of 5 buckets (Hardvér/Softvér/Sieť/Účet/Iné).
 *     Maps to the CA SDM `category` pcat lookup via the BFF — for MVP we
 *     hard-code the bucket codes here because the reference endpoint
 *     (`/api/reference/category`) is not yet wired in the BFF (F.2 deferred
 *     dynamic loading). When that arrives we replace the enum with `z.string()`
 *     + a runtime check against the cached reference list.
 *   - `summary` — required, 5 to 120 characters. The 5-char floor weeds out
 *     "halp" / "??" bodies; the 120 ceiling mirrors the wireframe single-line
 *     constraint.
 *   - `description` — optional, capped at 5000 characters.
 *   - `urgency` — required, one of 3 levels (1 = `cannot work`, 2 = `working
 *     with issues`, 3 = `minor`). Inverted scale vs CA SDM Urgency 1..5 — we
 *     map it to a `Priority` 5..1 in the API layer before posting.
 *
 * Error message keys reference `shared.validation.*` and `portal.newIncident
 * .errors.*` — the form passes them through `t()` so the SK/EN parity check
 * stays green. The schema returns the i18n key (not the translated string) so
 * the resolver renders messages in the active locale at submit time.
 */

import { z } from "zod";

export const CATEGORY_CODES = ["hardware", "software", "network", "account", "other"] as const;
export type CategoryCode = (typeof CATEGORY_CODES)[number];

/**
 * Urgency in UI terms (wireframe scale, 1 = cannot work). Mapped to CA SDM
 * Priority 1..5 in `api.ts#mapUrgencyToPriority`.
 */
export const URGENCY_LEVELS = ["1", "2", "3"] as const;
export type UrgencyLevel = (typeof URGENCY_LEVELS)[number];

export const SUMMARY_MIN = 5;
export const SUMMARY_MAX = 120;
export const DESCRIPTION_MAX = 5000;

export const newIncidentSchema = z.object({
  category: z.enum(CATEGORY_CODES, {
    errorMap: () => ({ message: "validation.required" }),
  }),
  summary: z
    .string({ required_error: "validation.required" })
    .trim()
    .min(SUMMARY_MIN, { message: "validation.tooShort" })
    .max(SUMMARY_MAX, { message: "validation.tooLong" }),
  description: z
    .string()
    .trim()
    .max(DESCRIPTION_MAX, { message: "validation.tooLong" })
    .optional()
    .or(z.literal("").transform(() => undefined)),
  urgency: z.enum(URGENCY_LEVELS, {
    errorMap: () => ({ message: "validation.required" }),
  }),
});

export type NewIncidentFormValues = z.infer<typeof newIncidentSchema>;
