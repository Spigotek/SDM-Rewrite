import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UiTicketDetail } from "@sdm/api-types";
import { postPublicComment, ticketDetailQueryKey } from "./api";
import type { PortalTicketType } from "./types";

/**
 * Post a public reply. Optimistic snapshot/restore mirrors the workspace
 * pattern so a 4xx rolls back to the previous detail object without a
 * second GET. The success path replaces the cache with the server's
 * authoritative response (includes the new activity row).
 */
export function usePostPublicComment(type: PortalTicketType, id: string) {
  const qc = useQueryClient();
  const key = ticketDetailQueryKey(type, id);
  return useMutation({
    mutationFn: (text: string) => postPublicComment(type, id, text),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<UiTicketDetail>(key);
      return { previous };
    },
    onSuccess: (data) => {
      qc.setQueryData(key, data);
    },
    onError: (_err, _text, ctx) => {
      const snapshot = (ctx as { previous?: UiTicketDetail } | undefined)?.previous;
      if (snapshot) qc.setQueryData(key, snapshot);
    },
  });
}
