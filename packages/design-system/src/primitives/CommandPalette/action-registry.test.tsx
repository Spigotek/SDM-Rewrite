import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  CommandPaletteRegistry,
  __resetCommandPaletteRegistry,
  useCommandPaletteRegistry,
} from "./action-registry";
import type { CommandPaletteAction } from "./types";

function action(id: string, overrides: Partial<CommandPaletteAction> = {}): CommandPaletteAction {
  return {
    id,
    title: id,
    group: "actions",
    onActivate: () => {},
    ...overrides,
  };
}

describe("CommandPaletteRegistry", () => {
  afterEach(() => {
    __resetCommandPaletteRegistry();
  });

  it("registers and lists actions in insertion order", () => {
    const registry = new CommandPaletteRegistry();
    registry.register(action("a"));
    registry.register(action("b"));
    registry.register(action("c"));
    expect(registry.list().map((a) => a.id)).toEqual(["a", "b", "c"]);
  });

  it("returns an unregister fn from register()", () => {
    const registry = new CommandPaletteRegistry();
    const off = registry.register(action("a"));
    expect(registry.list()).toHaveLength(1);
    off();
    expect(registry.list()).toHaveLength(0);
  });

  it("notifies subscribers on register / unregister / replaceGroup", () => {
    const registry = new CommandPaletteRegistry();
    const listener = vi.fn();
    registry.subscribe(listener);
    registry.register(action("a"));
    registry.register(action("b"));
    registry.unregister("a");
    registry.replaceGroup("ticket:", [
      action("ticket:1", { group: "tickets" }),
      action("ticket:2", { group: "tickets" }),
    ]);
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it("replaceGroup swaps every action whose id begins with the prefix", () => {
    const registry = new CommandPaletteRegistry();
    registry.register(action("nav:home", { group: "navigate" }));
    registry.register(action("ticket:1", { group: "tickets" }));
    registry.register(action("ticket:2", { group: "tickets" }));
    registry.replaceGroup("ticket:", [action("ticket:9", { group: "tickets" })]);
    expect(registry.list().map((a) => a.id)).toEqual(["nav:home", "ticket:9"]);
  });

  it("useCommandPaletteRegistry re-renders when actions change", () => {
    const { result } = renderHook(() => useCommandPaletteRegistry());
    expect(result.current.actions).toEqual([]);
    act(() => {
      result.current.registry.register(action("a"));
    });
    expect(result.current.actions.map((a) => a.id)).toEqual(["a"]);
    act(() => {
      result.current.registry.register(action("b"));
    });
    expect(result.current.actions.map((a) => a.id)).toEqual(["a", "b"]);
  });

  it("useCommandPaletteRegistry shares the same singleton across hook callers", () => {
    const first = renderHook(() => useCommandPaletteRegistry());
    const second = renderHook(() => useCommandPaletteRegistry());
    expect(first.result.current.registry).toBe(second.result.current.registry);
    act(() => {
      first.result.current.registry.register(action("a"));
    });
    expect(second.result.current.actions.map((a) => a.id)).toEqual(["a"]);
  });
});
