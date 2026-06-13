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

  it("renders critical as solid (no dot leading icon)", () => {
    const { container } = render(<PriorityBadge severity="critical" />);
    const dot = container.querySelector("[data-component='badge-icon']");
    expect(dot).toBeNull();
  });

  it("maps low severity to neutral variant per K.1 brief §6.5", () => {
    render(<PriorityBadge severity="low" />);
    const badge = screen.getByText("Nízka");
    expect(badge).toHaveAttribute("data-variant", "neutral");
  });

  it("maps medium severity to info variant per K.1 brief §6.5", () => {
    render(<PriorityBadge severity="medium" />);
    const badge = screen.getByText("Stredná");
    expect(badge).toHaveAttribute("data-variant", "info");
  });

  it("respects label override", () => {
    render(<PriorityBadge severity="medium" label="Mid" />);
    const badge = screen.getByText("Mid");
    expect(badge).toHaveAttribute("data-severity", "medium");
  });

  it("renders a dot for non-critical severities", () => {
    const { container } = render(<PriorityBadge severity="high" />);
    const dot = container.querySelector("[data-component='badge-icon'] span");
    expect(dot).toBeTruthy();
  });
});
