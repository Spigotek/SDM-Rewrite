/**
 * Public type surface for the CommandPalette primitive (K.1 brief §6.10).
 *
 * The primitive itself is router- and tenant-agnostic — it only knows how to
 * filter, render, and dispatch actions. App-side mounts (portal /
 * workspace) are responsible for building the action list (`onActivate`
 * callbacks resolve to `useNavigate()` calls, logout, theme cycle, etc.).
 */

import type { ReactNode } from "react";

export type CommandPaletteGroup = "recent" | "navigate" | "actions" | "tickets" | "kb" | "users";

export interface CommandPaletteAction {
  /** Stable identifier (used for recents persistence + React keys). */
  readonly id: string;
  /** Human-readable label — also the accessible name of the row. */
  readonly title: string;
  /** Group bucket — drives the small-caps section header. */
  readonly group: CommandPaletteGroup;
  /** Optional leading icon (lucide icon, emoji, custom SVG). */
  readonly icon?: ReactNode;
  /** Optional trailing shortcut chip (e.g. "⌘N", "G then Q"). */
  readonly shortcut?: string;
  /** Optional secondary text (subtitle) shown under the title — used for ticket previews. */
  readonly subtitle?: string;
  /** Invoked when the row is activated (Enter, click, or `cmd+N` numeric jump). */
  onActivate: () => void;
}

export interface CommandPaletteProps {
  /** Controlled — when `false` the component returns `null`. */
  readonly open: boolean;
  /** Called when the user presses Escape, clicks the backdrop, or activates a row. */
  onClose: () => void;
  /** Full list of contributable actions. The primitive filters this list locally. */
  readonly actions: ReadonlyArray<CommandPaletteAction>;
  /**
   * Notified on every input change (raw query, including mode prefixes). Mounts
   * use this to lazy-fetch tickets/KB/CMDB rows based on what the user typed.
   * The debounce is 120 ms (K.1 brief §6.10) — the primitive itself only fires
   * after the debounce window elapses.
   */
  onQueryChange?: (query: string) => void;
  /** Override the input placeholder. */
  readonly placeholder?: string;
  /** Override the "no results" empty-state message. */
  readonly emptyMessage?: string;
}
