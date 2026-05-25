import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "./Badge";

describe("<Badge>", () => {
  it("renders with neutral variant by default", () => {
    render(<Badge>New</Badge>);
    const badge = screen.getByText("New");
    expect(badge).toHaveAttribute("data-component", "badge");
    expect(badge).toHaveAttribute("data-variant", "neutral");
    expect(badge).toHaveAttribute("data-shape", "rounded");
  });

  it("supports semantic variants", () => {
    render(<Badge variant="danger">Critical</Badge>);
    expect(screen.getByText("Critical")).toHaveAttribute("data-variant", "danger");
  });

  it("supports pill shape and accessible label override", () => {
    render(
      <Badge shape="pill" aria-label="Priority: Critical">
        Critical
      </Badge>,
    );
    const badge = screen.getByLabelText("Priority: Critical");
    expect(badge).toHaveAttribute("data-shape", "pill");
  });
});
