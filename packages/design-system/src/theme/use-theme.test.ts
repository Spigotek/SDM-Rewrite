import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { THEME_STORAGE_KEY } from "../tokens/theme";
import { useTheme } from "./use-theme";

type MediaListener = (event: MediaQueryListEvent) => void;

interface FakeMediaQuery {
  matches: boolean;
  listeners: Set<MediaListener>;
}

function installFakeMatchMedia(state: Record<string, boolean>): {
  setMatches: (query: string, value: boolean) => void;
} {
  const registry = new Map<string, FakeMediaQuery>();

  window.matchMedia = (query: string): MediaQueryList => {
    let entry = registry.get(query);
    if (!entry) {
      entry = { matches: state[query] ?? false, listeners: new Set() };
      registry.set(query, entry);
    }
    return {
      get matches() {
        return entry!.matches;
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, listener: MediaListener) => {
        entry!.listeners.add(listener);
      },
      removeEventListener: (_type: string, listener: MediaListener) => {
        entry!.listeners.delete(listener);
      },
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  };

  return {
    setMatches: (query: string, value: boolean) => {
      const entry = registry.get(query);
      if (!entry) return;
      entry.matches = value;
      entry.listeners.forEach((l) =>
        l({ matches: value, media: query } as unknown as MediaQueryListEvent),
      );
    },
  };
}

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("useTheme", () => {
  it("resolves to light when no stored choice + no system preference", () => {
    installFakeMatchMedia({});
    const { result } = renderHook(() => useTheme());
    expect(result.current.choice).toBe("system");
    expect(result.current.applied).toBe("light");
  });

  it("honours stored dark choice", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    installFakeMatchMedia({});
    const { result } = renderHook(() => useTheme());
    expect(result.current.choice).toBe("dark");
    expect(result.current.applied).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("falls back to system dark preference when choice = system", () => {
    installFakeMatchMedia({ "(prefers-color-scheme: dark)": true });
    const { result } = renderHook(() => useTheme());
    expect(result.current.choice).toBe("system");
    expect(result.current.applied).toBe("dark");
  });

  it("setChoice persists + applies", () => {
    installFakeMatchMedia({});
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.setChoice("dark");
    });
    expect(result.current.choice).toBe("dark");
    expect(result.current.applied).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("setChoice('system') clears persisted override", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    installFakeMatchMedia({});
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.setChoice("system");
    });
    expect(result.current.choice).toBe("system");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it("reacts to system theme flips when choice = system", () => {
    const mm = installFakeMatchMedia({});
    const { result } = renderHook(() => useTheme());
    expect(result.current.applied).toBe("light");

    act(() => {
      mm.setMatches("(prefers-color-scheme: dark)", true);
    });
    expect(result.current.applied).toBe("dark");
  });
});
