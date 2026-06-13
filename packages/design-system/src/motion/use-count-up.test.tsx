import { afterEach, describe, expect, it } from "vitest";
import { useRef } from "react";
import { act, render, waitFor } from "@testing-library/react";
import { useCountUp } from "./use-count-up";

interface CounterProps {
  readonly value: number;
  readonly durationMs?: number;
}

function Counter({ value, durationMs }: CounterProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  useCountUp(value, durationMs === undefined ? { ref } : { ref, durationMs });
  return (
    <span ref={ref} data-testid="counter">
      {value}
    </span>
  );
}

const ORIGINAL_MATCH_MEDIA = window.matchMedia;

afterEach(() => {
  window.matchMedia = ORIGINAL_MATCH_MEDIA;
});

describe("useCountUp", () => {
  it("settles on the target value once the tween completes", async () => {
    const { getByTestId } = render(<Counter value={42} durationMs={50} />);
    await waitFor(
      () => {
        expect(getByTestId("counter").textContent).toBe("42");
      },
      { timeout: 1500 },
    );
  });

  it("short-circuits to the final value synchronously when prefers-reduced-motion is set", async () => {
    window.matchMedia = ((query: string) =>
      ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList) as typeof window.matchMedia;

    const { getByTestId } = render(<Counter value={7} />);
    await act(async () => {
      await Promise.resolve();
    });
    // Reduced-motion bypasses the tween entirely — the value lands immediately.
    expect(getByTestId("counter").textContent).toBe("7");
  });

  it("updates the rendered text when the value prop changes", async () => {
    const { getByTestId, rerender } = render(<Counter value={3} durationMs={50} />);
    await waitFor(() => {
      expect(getByTestId("counter").textContent).toBe("3");
    });

    rerender(<Counter value={9} durationMs={50} />);
    await waitFor(() => {
      expect(getByTestId("counter").textContent).toBe("9");
    });
  });

  it("falls back to the static value for non-finite inputs", async () => {
    const { getByTestId } = render(<Counter value={Number.NaN} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(getByTestId("counter").textContent).toBe("NaN");
  });
});
