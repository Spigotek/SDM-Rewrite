import { useEffect, useId, useRef, useState } from "react";
import type { ChangeEvent } from "react";

/**
 * Debounced search box (300 ms per `components.md §SearchInput` — KB
 * variant). The visible `value` is the local input state so the field
 * never lags; the debounced value is reported via `onDebouncedChange` and
 * drives the network query.
 *
 * K.3.E (v1.2): the leading glyph is now a lucide-shaped inline SVG (the
 * portal has no `lucide-react` dep so we mirror the K.2 top-bar +
 * `KbSearchBar.tsx` SVG convention). The visual rhythm now matches the
 * home hero search box — 48-px tall, brand-token border, focus-ring.
 *
 * A11y: native `<input type="search">` for the searchbox semantics, an
 * `<label>` slot via `aria-label`, and a `aria-busy` flag while a fetch
 * is in-flight so AT users hear the result count once the live region
 * settles.
 */
export interface SearchInputProps {
  readonly initialValue?: string;
  readonly label: string;
  readonly placeholder?: string;
  readonly debounceMs?: number;
  readonly autoFocus?: boolean;
  readonly busy?: boolean;
  readonly onDebouncedChange: (value: string) => void;
}

function SearchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
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

export function SearchInput(props: SearchInputProps) {
  const {
    initialValue = "",
    label,
    placeholder,
    debounceMs = 300,
    autoFocus = false,
    busy = false,
    onDebouncedChange,
  } = props;
  const inputId = useId();
  const [value, setValue] = useState(initialValue);
  const onDebouncedChangeRef = useRef(onDebouncedChange);
  onDebouncedChangeRef.current = onDebouncedChange;

  useEffect(() => {
    const handle = window.setTimeout(() => {
      onDebouncedChangeRef.current(value);
    }, debounceMs);
    return () => window.clearTimeout(handle);
  }, [value, debounceMs]);

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    setValue(event.target.value);
  }

  return (
    <div className="sdm-kb-search-input">
      <label htmlFor={inputId} className="sdm-visually-hidden">
        {label}
      </label>
      <span aria-hidden="true" className="sdm-kb-search-input-icon">
        <SearchIcon />
      </span>
      {/* Auto-focus is a deliberate UX choice for the KB landing page —
          search is the primary action per wireframe `portal/05-kb-search.md`
          ("Search bar | Auto-focus na load"). The route is reached
          intentionally, so the focus shift is expected. */}
      <input
        id={inputId}
        type="search"
        className="sdm-kb-search-input-field"
        value={value}
        placeholder={placeholder}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
        aria-busy={busy || undefined}
        data-testid="kb-search-input"
        onChange={handleChange}
      />
    </div>
  );
}
