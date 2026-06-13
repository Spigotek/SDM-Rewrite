/**
 * Action registry — pub-sub store for command-palette contributions.
 *
 * A single module-level singleton keeps the API trivial for the SDM apps
 * (one registry per browser tab is plenty — portal and workspace ship as
 * separate SPAs). Tests reset the singleton via `__resetCommandPaletteRegistry`
 * to keep individual specs hermetic.
 *
 * The hook (`useCommandPaletteRegistry`) returns the registry instance and
 * subscribes the calling component to changes so the action list re-renders
 * when contributions appear / disappear.
 */

import { useEffect, useState } from "react";
import type { CommandPaletteAction } from "./types";

export class CommandPaletteRegistry {
  // Insertion order is preserved by Map — useful because the consumer can
  // contribute "Navigate" items first and have them appear above lazy-loaded
  // ticket rows without an explicit sort step.
  private readonly actions = new Map<string, CommandPaletteAction>();
  private readonly listeners = new Set<() => void>();

  register(action: CommandPaletteAction): () => void {
    this.actions.set(action.id, action);
    this.emit();
    return () => this.unregister(action.id);
  }

  unregister(id: string): void {
    if (this.actions.delete(id)) {
      this.emit();
    }
  }

  /**
   * Replace every action whose `id` has the supplied prefix with the new
   * batch. Used by mounts that contribute a dynamic group (tickets, KB hits)
   * from the result of an async query — they don't want to track each
   * individual id across renders.
   */
  replaceGroup(idPrefix: string, batch: ReadonlyArray<CommandPaletteAction>): void {
    let mutated = false;
    for (const key of [...this.actions.keys()]) {
      if (key.startsWith(idPrefix)) {
        this.actions.delete(key);
        mutated = true;
      }
    }
    for (const action of batch) {
      this.actions.set(action.id, action);
      mutated = true;
    }
    if (mutated) this.emit();
  }

  list(): ReadonlyArray<CommandPaletteAction> {
    return [...this.actions.values()];
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

let registrySingleton: CommandPaletteRegistry | null = null;

function getRegistry(): CommandPaletteRegistry {
  if (registrySingleton === null) {
    registrySingleton = new CommandPaletteRegistry();
  }
  return registrySingleton;
}

/**
 * Test-only escape hatch — resets the module-level singleton so each spec
 * starts with an empty registry. Not exported from the package barrel.
 */
export function __resetCommandPaletteRegistry(): void {
  registrySingleton = null;
}

/**
 * Hook — returns the singleton registry and re-renders the caller whenever an
 * action is contributed or removed. Reading the list snapshot (`registry.list()`)
 * inside `useMemo`/`useEffect` is the intended consumption pattern.
 */
export function useCommandPaletteRegistry(): {
  readonly registry: CommandPaletteRegistry;
  readonly actions: ReadonlyArray<CommandPaletteAction>;
} {
  const registry = getRegistry();
  const [snapshot, setSnapshot] = useState<ReadonlyArray<CommandPaletteAction>>(() =>
    registry.list(),
  );

  useEffect(() => {
    const sync = () => setSnapshot(registry.list());
    const unsubscribe = registry.subscribe(sync);
    // Resync once on mount in case actions were contributed between the
    // initial useState lazy initialiser and the subscribe call.
    sync();
    return unsubscribe;
  }, [registry]);

  return { registry, actions: snapshot };
}
