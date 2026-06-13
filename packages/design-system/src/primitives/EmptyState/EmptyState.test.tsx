import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./EmptyState";

describe("<EmptyState>", () => {
  it("renders the title as a heading", () => {
    render(<EmptyState title="Žiadne otvorené tickety" />);
    const heading = screen.getByRole("heading", { name: "Žiadne otvorené tickety" });
    expect(heading.tagName).toBe("H2");
  });

  it("omits the description slot when no description is provided", () => {
    render(<EmptyState title="Nothing here" />);
    expect(document.querySelector('[data-component="empty-state-description"]')).toBeNull();
  });

  it("renders the CTA inside the footer slot", () => {
    render(<EmptyState title="No tickets" cta={<button type="button">New request</button>} />);
    const footer = document.querySelector('[data-component="empty-state-footer"]');
    expect(footer).not.toBeNull();
    expect(footer).toContainElement(screen.getByRole("button", { name: "New request" }));
  });

  it('applies role="status" on the compact variant and omits it on hero', () => {
    const { rerender } = render(<EmptyState variant="compact" title="No items" />);
    expect(screen.getByRole("status")).toHaveAttribute("data-variant", "compact");

    rerender(<EmptyState variant="hero" title="No items" />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(document.querySelector('[data-component="empty-state"]')).toHaveAttribute(
      "data-variant",
      "hero",
    );
  });

  it("wraps the illustration in an aria-hidden container", () => {
    render(
      <EmptyState variant="hero" title="No items" illustration={<svg data-testid="illu" />} />,
    );
    const wrapper = document.querySelector('[data-component="empty-state-illustration"]');
    expect(wrapper).not.toBeNull();
    expect(wrapper).toHaveAttribute("aria-hidden", "true");
    expect(wrapper).toContainElement(screen.getByTestId("illu"));
  });

  it("ignores the illustration slot on the minimal variant", () => {
    render(
      <EmptyState variant="minimal" title="No items" illustration={<svg data-testid="illu" />} />,
    );
    expect(screen.queryByTestId("illu")).toBeNull();
    expect(document.querySelector('[data-component="empty-state-illustration"]')).toBeNull();
  });
});
