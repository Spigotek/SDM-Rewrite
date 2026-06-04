import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { patchChangeSchedule } from "../api";

/**
 * J.6 — useReschedule hook.
 *
 * Composes the PATCH /api/changes/:id/schedule mutation with TanStack Query
 * cache invalidation. On success invalidates ["changes-list", *] so both
 * the list view and the calendar reflect the new schedule without a manual
 * refresh. Tracks the in-flight change ID so callers can show a spinner on
 * the specific event being rescheduled.
 *
 * NOT optimistic — FullCalendar applies the drag visually before calling
 * eventDrop/eventResize, so the UI already shows the new position. We call
 * `info.revert()` on the FullCalendar event object on failure to roll back
 * the visual position. This means we never need to speculatively update the
 * query cache here.
 */
export interface UseRescheduleResult {
  /** Call with new start/end ISO strings. Resolves on success. Throws on error. */
  readonly reschedule: (id: string, newStart: string, newEnd: string) => Promise<void>;
  /** ID of the change currently being rescheduled, null when idle. */
  readonly isReschedulingId: string | null;
}

export function useReschedule(): UseRescheduleResult {
  const qc = useQueryClient();
  const [isReschedulingId, setIsReschedulingId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: ({ id, newStart, newEnd }: { id: string; newStart: string; newEnd: string }) =>
      patchChangeSchedule(id, { scheduledStartAt: newStart, scheduledEndAt: newEnd }),
    onSuccess: () => {
      // Invalidate all changes-list queries regardless of tenantId key segment.
      void qc.invalidateQueries({ queryKey: ["changes-list"] });
    },
  });

  const reschedule = async (id: string, newStart: string, newEnd: string): Promise<void> => {
    setIsReschedulingId(id);
    try {
      await mutation.mutateAsync({ id, newStart, newEnd });
    } finally {
      setIsReschedulingId(null);
    }
  };

  return { reschedule, isReschedulingId };
}
