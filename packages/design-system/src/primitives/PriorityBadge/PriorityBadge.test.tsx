import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PriorityBadge } from "./PriorityBadge";

describe("<PriorityBadge>", () => {
  it("renders default Slovak label for critical severity", () => {
    render(<PriorityBadge severity="critical" />);
    const badge = screen.getByText("Kritická");
    expect(badge).toHaveAttribute("data-component", "priority-badge");
    expect(badge).toHaveAttribute("data-severity", "critical");
    expect(badge).toHaveAttribute("data-variant", "danger");
  });

  it("maps low severity to success variant", () => {
    render(<PriorityBadge severity="low" />);
    const badge = screen.getByText("Nízka");
    expect(badge).toHaveAttribute("data-variant", "success");
  });

  it("respects label override", () => {
    render(<PriorityBadge severity="medium" label="Mid" />);
    const badge = screen.getByText("Mid");
    expect(badge).toHaveAttribute("data-severity", "medium");
  });
});
