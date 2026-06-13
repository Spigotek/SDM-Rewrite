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

  it("maps in_progress to the brand (primary) variant per K.1 brief §6.4", () => {
    render(<StatusBadge status="in_progress" />);
    const badge = screen.getByText("V riešení");
    expect(badge).toHaveAttribute("data-variant", "brand");
  });

  it("maps open to info per K.1 brief §6.4", () => {
    render(<StatusBadge status="open" />);
    const badge = screen.getByText("Otvorený");
    expect(badge).toHaveAttribute("data-variant", "info");
  });

  it("respects the label override", () => {
    render(<StatusBadge status="resolved" label="Done" />);
    const badge = screen.getByText("Done");
    expect(badge).toHaveAttribute("data-status", "resolved");
    expect(badge).toHaveAttribute("data-variant", "success");
  });

  it("resolves a CA SDM code to the canonical status", () => {
    render(<StatusBadge caCode="WIP" />);
    const badge = screen.getByText("V riešení");
    expect(badge).toHaveAttribute("data-status", "in_progress");
    expect(badge).toHaveAttribute("data-ca-code", "WIP");
    expect(badge).toHaveAttribute("data-variant", "brand");
  });

  it("maps every documented CA SDM code", () => {
    const cases: Array<[string, string]> = [
      ["OP", "open"],
      ["WIP", "in_progress"],
      ["HD", "hold"],
      ["WC", "waiting_customer"],
      ["WV", "waiting_vendor"],
      ["RE", "resolved"],
      ["CL", "closed"],
      ["CN", "cancelled"],
      ["RJ", "rejected"],
      ["AP", "approval_pending"],
      ["AR", "approval_rejected"],
      ["SC", "scheduled"],
    ];
    for (const [code, expected] of cases) {
      const { container, unmount } = render(<StatusBadge caCode={code} />);
      const node = container.querySelector("[data-component='status-badge']");
      expect(node).toHaveAttribute("data-status", expected);
      unmount();
    }
  });

  it("renders a leading icon when withIcon is set", () => {
    const { container } = render(<StatusBadge status="resolved" withIcon />);
    const icon = container.querySelector("[data-component='badge-icon'] svg");
    expect(icon).toBeTruthy();
  });

  it("does not render an icon by default", () => {
    const { container } = render(<StatusBadge status="resolved" />);
    const icon = container.querySelector("[data-component='badge-icon']");
    expect(icon).toBeNull();
  });
});
