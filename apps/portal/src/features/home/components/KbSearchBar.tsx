import { useEffect, useId, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { EmptyState, Skeleton } from "@sdm/design-system";
import { tenantId as toTenantId } from "@sdm/domain";
import { useTranslation } from "@sdm/i18n";
import { useSession } from "../../../shell/session-context";
import { useKbAutocomplete } from "../hooks";

const TENANT_PLACEHOLDER = toTenantId("__pending__");
const DEBOUNCE_MS = 200;
const MIN_TERM_LENGTH = 2;

/**
 * Inline search-icon SVG — `lucide-react` is not a portal dep, and the rest
 * of the portal shell follows the same pattern (`top-bar.tsx`).
 */
function SearchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export interface KbSearchBarProps {
  /**
   * Controlled value driven by the parent (chip clicks write here). Local
   * state mirrors it so the input remains responsive between updates.
   */
  readonly valueOverride: string;
  readonly onTermChange: (next: string) => void;
}

/**
 * Big KB search input with debounced (200 ms) autocomplete dropdown. Hits
 * `/api/kb?q=<term>&size=6` via `useKbAutocomplete`; results land as a
 * listbox underneath the input. Empty + loading states use design-system
 * primitives (`EmptyState` compact + `Skeleton` rows).
 *
 * The dropdown is `aria-autocomplete="list"` and the rows render as
 * `<Link>`s so keyboard navigation is the browser's native tab order —
 * `↑↓` to navigate, `Enter` to follow. The K.1 brief reserves cmd+K for
 * the future command palette; this component is a one-shot focusable
 * input, not a popup.
 */
export function KbSearchBar({ valueOverride, onTermChange }: KbSearchBarProps) {
  const { t } = useTranslation("portal");
  const { session } = useSession();
  const tenantId = session?.tenantId ?? TENANT_PLACEHOLDER;
  const inputId = useId();
  const listboxId = useId();

  // Internal value mirrors `valueOverride` but also captures local edits
  // before the parent acknowledges them. This avoids the input lagging
  // behind keystrokes while keeping chip-click writes synchronous.
  const [value, setValue] = useState(valueOverride);
  const [debouncedTerm, setDebouncedTerm] = useState(valueOverride);
  const onTermChangeRef = useRef(onTermChange);
  onTermChangeRef.current = onTermChange;

  // `valueOverride` updates (chip clicks) overwrite the local input.
  useEffect(() => {
    setValue(valueOverride);
  }, [valueOverride]);

  // Debounce the term that hits the network. 200 ms keeps the round-trip
  // under the 300 ms acceptance budget (200 ms debounce + ~80 ms MSW BFF).
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedTerm(value);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [value]);

  const enabled = session !== null;
  const query = useKbAutocomplete(tenantId, debouncedTerm, enabled);
  const hits = query.data ?? [];
  const trimmed = debouncedTerm.trim();
  const hasTerm = trimmed.length >= MIN_TERM_LENGTH;
  const showDropdown = hasTerm;
  const showSkeleton = hasTerm && query.isPending;
  const showEmpty = hasTerm && !query.isPending && hits.length === 0;

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    const next = event.target.value;
    setValue(next);
    onTermChangeRef.current(next);
  }

  return (
    <div className="sdm-home-kb-search" data-testid="home-kb-search">
      <label htmlFor={inputId} className="sdm-visually-hidden">
        {t("home.kbSearch.label")}
      </label>
      <div className="sdm-home-kb-search-input">
        <span className="sdm-home-kb-search-icon" aria-hidden="true">
          <SearchIcon />
        </span>
        <input
          id={inputId}
          type="search"
          className="sdm-home-kb-search-field"
          value={value}
          onChange={handleChange}
          placeholder={t("home.kbSearch.placeholder")}
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={showDropdown}
          data-testid="home-kb-search-input"
        />
      </div>
      {showDropdown ? (
        <div
          id={listboxId}
          className="sdm-home-kb-search-dropdown"
          role="listbox"
          aria-label={t("home.kbSearch.resultsLabel")}
          data-testid="home-kb-search-dropdown"
        >
          {showSkeleton ? (
            <ul className="sdm-home-kb-search-list" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <li key={i} className="sdm-home-kb-search-skeleton">
                  <Skeleton variant="text" width="80%" height={14} />
                  <Skeleton variant="text" width="60%" height={12} />
                </li>
              ))}
            </ul>
          ) : showEmpty ? (
            <EmptyState
              variant="compact"
              title={t("home.kbSearch.emptyTitle")}
              description={t("home.kbSearch.emptyDescription")}
              data-testid="home-kb-search-empty"
            />
          ) : (
            <ul className="sdm-home-kb-search-list">
              {hits.map((hit) => (
                <li key={hit.id}>
                  <Link
                    to={`/kb/article/${encodeURIComponent(hit.id)}`}
                    className="sdm-home-kb-search-hit"
                    role="option"
                    aria-selected={false}
                    data-testid={`home-kb-search-hit-${hit.id}`}
                  >
                    <span className="sdm-home-kb-search-hit-title">{hit.title}</span>
                    {hit.snippet ? (
                      <span className="sdm-home-kb-search-hit-snippet">{hit.snippet}</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
