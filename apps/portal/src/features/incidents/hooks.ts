import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Incident } from "@sdm/domain";
import { mapFormToInput, postIncident, type NewIncidentInput } from "./api";
import type { NewIncidentFormValues } from "./schema";

/**
 * `useNewIncident` — single mutation hook for the form's submit handler.
 *
 * On success we invalidate the two portal home queries that surface incident
 * lists (`my-tickets` for the active-tickets panel; the H.2 home prefetches
 * use the same key). This forces a background refetch so when Lucia clicks
 * "Vrátiť sa na domov" from the success screen the new ticket appears
 * without a stale-cache delay.
 */
export function useNewIncident() {
  const qc = useQueryClient();
  return useMutation<Incident, Error & { status?: number }, NewIncidentFormValues>({
    mutationFn: (values) => postIncident(mapFormToInput(values)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-tickets"] });
    },
  });
}

export type { NewIncidentInput };
