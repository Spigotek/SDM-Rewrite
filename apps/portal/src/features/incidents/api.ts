import type { Incident, Priority } from "@sdm/domain";
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
}

export function mapFormToInput(values: NewIncidentFormValues): NewIncidentInput {
  const priority = mapUrgencyToPriority(values.urgency);
  return {
    summary: values.summary,
    ...(values.description ? { description: values.description } : {}),
    priority,
    urgency: priority,
    category: values.category,
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
    let detail = "";
    try {
      const body = (await resp.json()) as { message?: string };
      detail = body.message ? `: ${body.message}` : "";
    } catch {
      // Ignore non-JSON bodies.
    }
    const error = new Error(`[incident-create] HTTP ${resp.status}${detail}`) as Error & {
      status?: number;
    };
    error.status = resp.status;
    throw error;
  }
  return (await resp.json()) as Incident;
}
