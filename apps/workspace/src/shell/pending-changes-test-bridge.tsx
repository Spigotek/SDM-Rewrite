/**
 * H.1 — test-only bridge between Playwright (which can dispatch DOM events but
 * cannot call React hooks directly) and the `PendingChangesProvider`.
 *
 * Listens for `sdm:test-set-dirty` custom events from window and registers /
 * unregisters the supplied `formId`. The whole module is gated on
 * `import.meta.env.DEV` so Vite tree-shakes it from production bundles.
 *
 * Event detail shape: `{ formId: string; dirty: boolean }`.
 */
import { useEffect } from "react";
import { usePendingChanges } from "./pending-changes";

const EVENT_NAME = "sdm:test-set-dirty";

interface TestSetDirtyDetail {
  readonly formId: string;
  readonly dirty: boolean;
}

export function PendingChangesTestBridge() {
  const { register } = usePendingChanges();

  useEffect(() => {
    const cleanups = new Map<string, () => void>();
    function onEvent(e: Event) {
      const detail = (e as CustomEvent<TestSetDirtyDetail>).detail;
      if (!detail) return;
      if (detail.dirty) {
        if (!cleanups.has(detail.formId)) {
          cleanups.set(detail.formId, register(detail.formId));
        }
      } else {
        cleanups.get(detail.formId)?.();
        cleanups.delete(detail.formId);
      }
    }
    window.addEventListener(EVENT_NAME, onEvent);
    return () => {
      window.removeEventListener(EVENT_NAME, onEvent);
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [register]);

  return null;
}
