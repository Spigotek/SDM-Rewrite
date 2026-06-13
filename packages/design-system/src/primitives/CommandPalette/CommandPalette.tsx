/**
 * `CommandPalette` — Linear-style global launcher (K.1 brief §6.10).
 *
 * Pure UI primitive — controlled by the caller through `open` / `onClose` and
 * the supplied `actions` list. The primitive knows how to:
 *
 *   - debounce typing (120 ms) and surface raw `query` to `onQueryChange`
 *   - filter locally by mode prefix (`>` actions, `#` navigate, `?` help)
 *   - cycle the selection with arrow keys + `cmd+1..9` numeric jumps
 *   - render the combobox/listbox a11y triad (`role`, `aria-activedescendant`)
 *   - persist + render up to 5 recent action IDs (`localStorage.sdm.cmdk.recent`)
 *   - animate enter/exit via GSAP, honour `prefers-reduced-motion`
 *
 * Routing, network fetches, and shortcut binding are the caller's job — see
 * the portal / workspace `command-palette-mount.tsx` modules.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ChangeEvent, KeyboardEvent, ReactNode } from "react";
import gsap from "gsap";
import { cn } from "../../utils/cn";
import styles from "./CommandPalette.module.css";
import type { CommandPaletteAction, CommandPaletteGroup, CommandPaletteProps } from "./types";

const RECENT_STORAGE_KEY = "sdm.cmdk.recent";
const RECENT_MAX = 5;
const DEBOUNCE_MS = 120;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** Order in which group headers render. */
const GROUP_ORDER: readonly CommandPaletteGroup[] = [
  "recent",
  "navigate",
  "actions",
  "tickets",
  "kb",
  "users",
];

const GROUP_LABEL_FALLBACK: Record<CommandPaletteGroup, string> = {
  recent: "Recent",
  navigate: "Navigate",
  actions: "Actions",
  tickets: "Tickets",
  kb: "Knowledge base",
  users: "Users",
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function readRecents(): ReadonlyArray<string> {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((value): value is string => typeof value === "string")
      .slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

function writeRecents(ids: ReadonlyArray<string>): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(ids.slice(0, RECENT_MAX)));
  } catch {
    /* localStorage may throw in private mode — recents are best-effort */
  }
}

interface Mode {
  readonly kind: "all" | "actions" | "navigate" | "help";
  readonly term: string;
}

function parseMode(rawQuery: string): Mode {
  if (rawQuery.startsWith(">")) return { kind: "actions", term: rawQuery.slice(1).trim() };
  if (rawQuery.startsWith("#")) return { kind: "navigate", term: rawQuery.slice(1).trim() };
  if (rawQuery.startsWith("?")) return { kind: "help", term: rawQuery.slice(1).trim() };
  return { kind: "all", term: rawQuery.trim() };
}

function matchesTerm(action: CommandPaletteAction, term: string): boolean {
  if (term.length === 0) return true;
  const haystack = `${action.title} ${action.subtitle ?? ""}`.toLowerCase();
  return haystack.includes(term.toLowerCase());
}

interface FilteredGroup {
  readonly group: CommandPaletteGroup;
  readonly actions: ReadonlyArray<CommandPaletteAction>;
}

function buildFilteredGroups(
  actions: ReadonlyArray<CommandPaletteAction>,
  mode: Mode,
  recentIds: ReadonlyArray<string>,
): ReadonlyArray<FilteredGroup> {
  const trimmedTerm = mode.term;
  const byId = new Map(actions.map((action) => [action.id, action] as const));

  if (mode.kind === "help") {
    // Help mode shows nothing in the result list — the footer takes over.
    return [];
  }

  const buckets = new Map<CommandPaletteGroup, CommandPaletteAction[]>();
  for (const action of actions) {
    if (action.group === "recent") continue; // Recent group is synthesised below.
    if (mode.kind === "actions" && action.group !== "actions") continue;
    if (mode.kind === "navigate" && action.group !== "navigate") continue;
    if (!matchesTerm(action, trimmedTerm)) continue;
    const list = buckets.get(action.group) ?? [];
    list.push(action);
    buckets.set(action.group, list);
  }

  // Recent group is only shown when query is empty + mode is "all" (i.e. no
  // prefix). Hide it when the user is filtering — it would just duplicate the
  // matched rows.
  const showRecents = mode.kind === "all" && trimmedTerm.length === 0;
  if (showRecents) {
    const recents: CommandPaletteAction[] = [];
    for (const id of recentIds) {
      const action = byId.get(id);
      if (action) recents.push({ ...action, group: "recent" });
    }
    if (recents.length > 0) {
      buckets.set("recent", recents);
    }
  }

  const result: FilteredGroup[] = [];
  for (const group of GROUP_ORDER) {
    const items = buckets.get(group);
    if (items && items.length > 0) result.push({ group, actions: items });
  }
  return result;
}

function flattenGroups(groups: ReadonlyArray<FilteredGroup>): ReadonlyArray<CommandPaletteAction> {
  return groups.flatMap((g) => g.actions);
}

export interface CommandPaletteHandle {
  /** Focus the input — used by mounts that want to re-focus on open. */
  focus(): void;
}

function CommandPaletteImpl(
  props: CommandPaletteProps,
  ref: React.ForwardedRef<CommandPaletteHandle>,
) {
  const {
    open,
    onClose,
    actions,
    onQueryChange,
    placeholder = "Search or type a command…",
    emptyMessage = "No results",
  } = props;

  const baseId = useId();
  const listboxId = `${baseId}-list`;
  const helpId = `${baseId}-help`;

  const [rawQuery, setRawQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentIds, setRecentIds] = useState<ReadonlyArray<string>>(() => readRecents());

  const inputRef = useRef<HTMLInputElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLButtonElement | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => inputRef.current?.focus(),
    }),
    [],
  );

  // Reset state every time the palette opens — the user expects a clean slate.
  useEffect(() => {
    if (open) {
      setRawQuery("");
      setSelectedIndex(0);
      setRecentIds(readRecents());
    }
  }, [open]);

  // Debounce the network notification — the local filter remains instant.
  useEffect(() => {
    if (!open) return undefined;
    if (!onQueryChange) return undefined;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      onQueryChange(rawQuery);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [rawQuery, open, onQueryChange]);

  const mode = useMemo(() => parseMode(rawQuery), [rawQuery]);
  const groups = useMemo(
    () => buildFilteredGroups(actions, mode, recentIds),
    [actions, mode, recentIds],
  );
  const flatActions = useMemo(() => flattenGroups(groups), [groups]);

  // Clamp the selection so we never overflow when the list shrinks (e.g. the
  // user just typed a character that filtered everything out).
  useEffect(() => {
    if (selectedIndex >= flatActions.length && flatActions.length > 0) {
      setSelectedIndex(0);
    }
  }, [flatActions.length, selectedIndex]);

  const recordRecent = useCallback((id: string) => {
    setRecentIds((prev) => {
      const next = [id, ...prev.filter((existing) => existing !== id)].slice(0, RECENT_MAX);
      writeRecents(next);
      return next;
    });
  }, []);

  const activate = useCallback(
    (action: CommandPaletteAction) => {
      recordRecent(action.id);
      try {
        action.onActivate();
      } finally {
        onClose();
      }
    },
    [recordRecent, onClose],
  );

  // GSAP enter animation. `useLayoutEffect` so the animation fires before the
  // browser paints the static end-state (avoids a flicker on first paint).
  useLayoutEffect(() => {
    if (!open) return;
    if (prefersReducedMotion()) return;
    const modal = modalRef.current;
    const backdrop = backdropRef.current;
    if (modal) {
      gsap.from(modal, {
        opacity: 0,
        scale: 0.96,
        y: -4,
        duration: 0.22,
        ease: "expo.out",
      });
    }
    if (backdrop) {
      gsap.from(backdrop, {
        opacity: 0,
        duration: 0.18,
        ease: "linear",
      });
    }
  }, [open]);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setRawQuery(event.target.value);
    setSelectedIndex(0);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Tab must stay inside the palette — there is only one focusable element
    // anyway (the input), so the simplest implementation is to swallow Tab.
    if (event.key === "Tab") {
      event.preventDefault();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (flatActions.length === 0) return;
      setSelectedIndex((prev) => (prev + 1) % flatActions.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (flatActions.length === 0) return;
      setSelectedIndex((prev) => (prev - 1 + flatActions.length) % flatActions.length);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const target = flatActions[selectedIndex];
      if (target) activate(target);
      return;
    }
    // cmd+1..9 numeric jump
    if ((event.metaKey || event.ctrlKey) && /^[1-9]$/.test(event.key)) {
      event.preventDefault();
      const idx = Number.parseInt(event.key, 10) - 1;
      const target = flatActions[idx];
      if (target) activate(target);
    }
  };

  // Focus the input on open. Using a ref-driven effect rather than `autoFocus`
  // so we satisfy `jsx-a11y/no-autofocus` and so re-opens (which keep the same
  // component instance) also focus.
  useLayoutEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const showHelp = mode.kind === "help";

  return (
    <div className={styles.root} data-state="open">
      <button
        ref={backdropRef}
        type="button"
        className={styles.backdrop}
        data-component="command-palette-backdrop"
        data-state="open"
        aria-label="Close command palette"
        onClick={onClose}
        tabIndex={-1}
      />
      <div
        ref={modalRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        data-component="command-palette"
        data-state="open"
        data-mode={mode.kind}
      >
        <div className={styles.inputRow}>
          <span className={styles.leadingChip} aria-hidden="true">
            <kbd>⌘</kbd>
            <kbd>K</kbd>
          </span>
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            value={rawQuery}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            role="combobox"
            aria-expanded
            aria-controls={listboxId}
            aria-activedescendant={
              flatActions[selectedIndex] ? `${baseId}-opt-${selectedIndex}` : undefined
            }
            aria-autocomplete="list"
            data-component="command-palette-input"
          />
          <span className={styles.trailingChip} aria-hidden="true">
            <kbd>Esc</kbd>
          </span>
        </div>

        {showHelp ? (
          <CommandPaletteHelp id={helpId} />
        ) : (
          <CommandPaletteListbox
            id={listboxId}
            baseId={baseId}
            groups={groups}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            onActivate={activate}
            emptyMessage={emptyMessage}
            flatActions={flatActions}
          />
        )}
      </div>
    </div>
  );
}

interface CommandPaletteListboxProps {
  readonly id: string;
  readonly baseId: string;
  readonly groups: ReadonlyArray<FilteredGroup>;
  readonly selectedIndex: number;
  onSelect(index: number): void;
  onActivate(action: CommandPaletteAction): void;
  readonly emptyMessage: string;
  readonly flatActions: ReadonlyArray<CommandPaletteAction>;
}

function CommandPaletteListbox(props: CommandPaletteListboxProps): ReactNode {
  const { id, baseId, groups, selectedIndex, onSelect, onActivate, emptyMessage, flatActions } =
    props;

  if (groups.length === 0) {
    return (
      <div id={id} className={styles.empty} role="status" data-component="command-palette-empty">
        {emptyMessage}
      </div>
    );
  }

  // Build a flat-index lookup so each row knows its index across groups.
  const indexById = new Map<string, number>();
  flatActions.forEach((action, index) => indexById.set(action.id, index));

  return (
    <ul
      id={id}
      className={styles.listbox}
      role="listbox"
      aria-label="Search results"
      data-component="command-palette-listbox"
    >
      {groups.map((group) => (
        <li
          key={group.group}
          className={styles.groupBlock}
          role="presentation"
          data-group={group.group}
        >
          <div className={styles.groupHeader} aria-hidden="true">
            {GROUP_LABEL_FALLBACK[group.group]}
          </div>
          <ul className={styles.groupList} role="presentation">
            {group.actions.map((action) => {
              const flatIndex = indexById.get(action.id) ?? 0;
              const selected = flatIndex === selectedIndex;
              const optionId = `${baseId}-opt-${flatIndex}`;
              return (
                <li
                  key={action.id}
                  id={optionId}
                  role="option"
                  aria-selected={selected}
                  className={cn(styles.option, selected && styles.optionSelected)}
                  data-component="command-palette-option"
                  data-selected={selected}
                  data-group={action.group}
                  onMouseEnter={() => onSelect(flatIndex)}
                  onMouseDown={(event) => {
                    // Prevent the input from losing focus before activation.
                    event.preventDefault();
                    onActivate(action);
                  }}
                >
                  {action.icon != null && (
                    <span className={styles.optionIcon} aria-hidden="true">
                      {action.icon}
                    </span>
                  )}
                  <span className={styles.optionBody}>
                    <span className={styles.optionTitle}>{action.title}</span>
                    {action.subtitle != null && (
                      <span className={styles.optionSubtitle}>{action.subtitle}</span>
                    )}
                  </span>
                  {action.shortcut != null && (
                    <span className={styles.optionShortcut} aria-hidden="true">
                      {action.shortcut}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function CommandPaletteHelp({ id }: { readonly id: string }): ReactNode {
  return (
    <div id={id} className={styles.help} role="note" data-component="command-palette-help">
      <div className={styles.helpHeader}>Keyboard shortcuts</div>
      <ul className={styles.helpList}>
        <li>
          <kbd>Esc</kbd> close
        </li>
        <li>
          <kbd>↑</kbd> <kbd>↓</kbd> select
        </li>
        <li>
          <kbd>Enter</kbd> activate
        </li>
        <li>
          <kbd>⌘</kbd> <kbd>1-9</kbd> jump to row
        </li>
        <li>
          Prefix <kbd>&gt;</kbd> filter to actions, <kbd>#</kbd> to navigate, <kbd>?</kbd> for help
        </li>
      </ul>
    </div>
  );
}

export const CommandPalette = forwardRef<CommandPaletteHandle, CommandPaletteProps>(
  CommandPaletteImpl,
);
