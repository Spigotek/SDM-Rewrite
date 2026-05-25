import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./StatusBadge";

describe("<StatusBadge>", () => {
  it("renders the default Slovak label for a status", () => {
    render(<StatusBadge status="new" />);
    const badge = screen.getByText("Nový");
    expect(badge).toHaveAttribute("data-component", "status-badge");
    expect(badge).toHaveAttribute("data-status", "new");
    expect(badge).toHaveAttribute("data-variant", "info");
  });

  it("maps in_progress to warning variant", () => {
    render(<StatusBadge status="in_progress" />);
    const badge = screen.getByText("V riešení");
    expect(badge).toHaveAttribute("data-variant", "warning");
  });

  it("respects the label override", () => {
    render(<StatusBadge status="resolved" label="Done" />);
    const badge = screen.getByText("Done");
    expect(badge).toHaveAttribute("data-status", "resolved");
    expect(badge).toHaveAttribute("data-variant", "success");
  });
});
