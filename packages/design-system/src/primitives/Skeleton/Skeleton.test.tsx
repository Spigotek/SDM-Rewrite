import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton } from "./Skeleton";

describe("<Skeleton>", () => {
  it("renders a single block by default with text variant", () => {
    const { container } = render(<Skeleton />);
    const node = container.querySelector("[data-component='skeleton']");
    expect(node).toHaveAttribute("data-variant", "text");
    expect(node).toHaveAttribute("aria-hidden", "true");
  });

  it("renders a circle variant", () => {
    const { container } = render(<Skeleton variant="circle" width={32} height={32} />);
    const node = container.querySelector("[data-component='skeleton']");
    expect(node).toHaveAttribute("data-variant", "circle");
    expect(node).toHaveStyle({ width: "32px", height: "32px" });
  });

  it("renders multiple placeholders when count > 1", () => {
    const { container } = render(<Skeleton count={3} />);
    const nodes = container.querySelectorAll("[data-component='skeleton']");
    expect(nodes.length).toBe(3);
  });

  it("accepts string lengths for width/height", () => {
    const { container } = render(<Skeleton width="50%" height="2em" />);
    const node = container.querySelector("[data-component='skeleton']") as HTMLElement;
    expect(node.style.width).toBe("50%");
    expect(node.style.height).toBe("2em");
  });
});
