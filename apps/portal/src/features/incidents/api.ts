import type { Incident, Priority } from "@sdm/domain";
import { toSubmitError } from "../../lib/submit-error";
import type { CategoryCode, NewIncidentFormValues, UrgencyLevel } from "./schema";

/**
 * `POST /api/incidents` plumbing for the portal new-incident form.
 *
 * The MSW handler (`packages/api-mocks/src/handlers/incidents.ts`) accepts an
 * `Incident` shape directly — tenant + requester are resolved server-side from
 * the session cookie. The BFF live endpoint expects the `IncidentCreateFe`
 * payload (`apps/bff/src/api/endpoints/incidents.ts`) which is the same minus
 * a few server-managed fields. We post a payload that satisfies both:
 *
 *   - `summary`, `description`, `priority`, `urgency`, `category` go straight in.
 *   - `customerId` / `requesterId` are left undefined — MSW fills them with
 *     the default user, BFF derives them from the session.
 *
 * `mapUrgencyToPriority` inverts the wireframe 3-level scale to the CA SDM 5-
 * level scale: `1 (cannot work) → 1 (critical)`, `2 (with issues) → 3 (medium)`,
 * `3 (minor) → 5 (low)`. This stays in sync with what the requester radio
 * group communicates (impact-to-the-user) versus what the helpdesk queue
 * sorts on (CA SDM priority).
 */

export interface NewIncidentInput {
  readonly summary: string;
  readonly description?: string;
  readonly priority: Priority;
  readonly urgency: Priority;
  readonly category: CategoryCode;
  /**
   * Portal "me" signal — the BFF resolves it to the session contact GUID
   * (`apps/bff/src/api/endpoints/_entity-routes.ts` create-time resolver).
   * Without it CA SDM rejects the create with "Required attribute Affected
   * End User is missing" (M.3).
   */
  readonly customer: "me";
  /** Portal taxonomy + urgency carried so the BFF can fold them into description. */
  readonly categoryCode: CategoryCode;
  readonly urgencyCode: UrgencyLevel;
}

export function mapFormToInput(values: NewIncidentFormValues): NewIncidentInput {
  const priority = mapUrgencyToPriority(values.urgency);
  return {
    summary: values.summary,
    ...(values.description ? { description: values.description } : {}),
    priority,
    urgency: priority,
    category: values.category,
    customer: "me",
    categoryCode: values.category,
    urgencyCode: values.urgency,
  };
}

export function mapUrgencyToPriority(urgency: UrgencyLevel): Priority {
  switch (urgency) {
    case "1":
      return 1;
    case "2":
      return 3;
    case "3":
      return 5;
  }
}

export async function postIncident(input: NewIncidentInput): Promise<Incident> {
  const resp = await fetch("/api/incidents", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });
  if (!resp.ok) {
    throw await toSubmitError(resp, "incident-create");
  }
  return (await resp.json()) as Incident;
}
