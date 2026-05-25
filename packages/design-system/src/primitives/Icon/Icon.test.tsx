import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Check } from "lucide-react";
import { Icon } from "./Icon";

describe("<Icon>", () => {
  it("renders Lucide icon with default md size and aria-hidden when decorative", () => {
    const { container } = render(<Icon icon={Check} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("data-component", "icon");
    expect(svg).toHaveAttribute("data-size", "md");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("supports size variants", () => {
    const { container } = render(<Icon icon={Check} size="lg" />);
    expect(container.querySelector("svg")).toHaveAttribute("data-size", "lg");
  });

  it("becomes role=img with aria-label when meaningful", () => {
    const { container } = render(<Icon icon={Check} aria-label="OK" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("role", "img");
    expect(svg).toHaveAttribute("aria-label", "OK");
  });
});
