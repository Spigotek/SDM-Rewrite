import { describe, expect, it } from "vitest";
import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { Wordmark } from "./Wordmark";

describe("<Wordmark>", () => {
  it("renders an accessible SVG with the SDM wordmark by default", () => {
    render(<Wordmark />);
    const svg = screen.getByRole("img", { name: "SDM" });
    expect(svg).toHaveAttribute("data-component", "wordmark");
    expect(svg).toHaveAttribute("data-size", "md");
    expect(svg).toHaveAttribute("data-monochrome", "false");
    // Three wordmark letters land in the DOM regardless of motion.
    const letters = svg.querySelectorAll("[data-wordmark-letter]");
    expect(letters).toHaveLength(3);
    expect(letters[0]).toHaveTextContent("S");
    expect(letters[1]).toHaveTextContent("D");
    expect(letters[2]).toHaveTextContent("M");
  });

  it("respects the size prop on the viewBox and data attribute", () => {
    render(<Wordmark size="lg" />);
    const svg = screen.getByRole("img", { name: "SDM" });
    expect(svg).toHaveAttribute("data-size", "lg");
    expect(svg).toHaveAttribute("viewBox", "0 0 120 36");
    expect(svg).toHaveAttribute("width", "120");
    expect(svg).toHaveAttribute("height", "36");
  });

  it("forwards refs to the underlying SVG element", () => {
    const ref = createRef<SVGSVGElement>();
    render(<Wordmark ref={ref} />);
    expect(ref.current).not.toBeNull();
    expect(ref.current?.tagName.toLowerCase()).toBe("svg");
  });

  it("supports a custom accessible label", () => {
    render(<Wordmark aria-label="Service Desk Manager" />);
    expect(screen.getByRole("img", { name: "Service Desk Manager" })).toBeInTheDocument();
  });

  it("switches the mark fills to currentColor when monochrome is true", () => {
    render(<Wordmark monochrome />);
    const svg = screen.getByRole("img", { name: "SDM" });
    expect(svg).toHaveAttribute("data-monochrome", "true");
    const frontMark = svg.querySelector('[data-wordmark-mark="front"]');
    expect(frontMark).not.toBeNull();
    expect(frontMark?.getAttribute("fill")).toBe("currentColor");
  });
});
