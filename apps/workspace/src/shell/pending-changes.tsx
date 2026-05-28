/**
 * H.1 — minimal "is any form dirty?" context.
 *
 * Forms (Composer, NewIncidentForm, etc.) register themselves by `formId` when
 * their internal state becomes dirty and unregister on submit / unmount. The
 * tenant switcher reads the set to decide whether to prompt the user before
 * switching.
 *
 * Scope is intentionally tiny: no state serialisation, no diff capture, no
 * draft persistence. Draft auto-save lives in Phase I per the H.1 plan.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface PendingChangesContextValue {
  readonly dirtyForms: ReadonlySet<string>;
  readonly hasDirtyForms: boolean;
  readonly register: (formId: string) => () => void;
}

const PendingChangesContext = createContext<PendingChangesContextValue | null>(null);

export function PendingChangesProvider({ children }: { children: ReactNode }) {
  const [dirtyForms, setDirtyForms] = useState<ReadonlySet<string>>(() => new Set());
  // RefCount lets the same `formId` be registered multiple times (e.g. an
  // RHF field-array remounting) without dropping the entry prematurely.
  const refCounts = useRef<Map<string, number>>(new Map());

  const register = useCallback((formId: string): (() => void) => {
    const prev = refCounts.current.get(formId) ?? 0;
    refCounts.current.set(formId, prev + 1);
    if (prev === 0) {
      setDirtyForms((current) => {
        const next = new Set(current);
        next.add(formId);
        return next;
      });
    }

    let released = false;
    return () => {
      if (released) return;
      released = true;
      const count = refCounts.current.get(formId) ?? 0;
      if (count <= 1) {
        refCounts.current.delete(formId);
        setDirtyForms((current) => {
          if (!current.has(formId)) return current;
          const next = new Set(current);
          next.delete(formId);
          return next;
        });
      } else {
        refCounts.current.set(formId, count - 1);
      }
    };
  }, []);

  const value = useMemo<PendingChangesContextValue>(
    () => ({ dirtyForms, hasDirtyForms: dirtyForms.size > 0, register }),
    [dirtyForms, register],
  );

  return <PendingChangesContext.Provider value={value}>{children}</PendingChangesContext.Provider>;
}

export function usePendingChanges(): PendingChangesContextValue {
  const ctx = useContext(PendingChangesContext);
  if (!ctx) {
    throw new Error("usePendingChanges() must be called inside <PendingChangesProvider>");
  }
  return ctx;
}
