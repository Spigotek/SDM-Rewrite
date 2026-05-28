import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { CHANGE_TABS, type ChangeTabKey } from "./types";

const URL_KEY_TAB = "tab";

function parseTab(raw: string | null): ChangeTabKey {
  if (raw && (CHANGE_TABS as ReadonlyArray<string>).includes(raw)) {
    return raw as ChangeTabKey;
  }
  return "detail";
}

/**
 * Active tab persisted in the URL (`?tab=impact`) — supports deep-link from
 * a notification ("Open change impact") and survives a page refresh. Default
 * is `detail` when the param is missing or invalid.
 */
export interface UseChangeTabResult {
  readonly tab: ChangeTabKey;
  readonly setTab: (next: ChangeTabKey) => void;
}

export function useChangeTab(): UseChangeTabResult {
  const [params, setParams] = useSearchParams();
  const tab = useMemo(() => parseTab(params.get(URL_KEY_TAB)), [params]);

  const setTab = useCallback(
    (next: ChangeTabKey) => {
      setParams(
        (prev) => {
          const out = new URLSearchParams(prev);
          if (next === "detail") {
            out.delete(URL_KEY_TAB);
          } else {
            out.set(URL_KEY_TAB, next);
          }
          return out;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return { tab, setTab };
}
