import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NavLink } from "./NavLink";

describe("<NavLink>", () => {
  it("renders as an anchor with default horizontal variant", () => {
    render(<NavLink href="/queue" label="My queue" data-testid="nav" />);
    const anchor = screen.getByTestId("nav");
    expect(anchor.tagName).toBe("A");
    expect(anchor).toHaveAttribute("href", "/queue");
    expect(anchor).toHaveAttribute("data-component", "nav-link");
    expect(anchor).toHaveAttribute("data-variant", "horizontal");
    expect(anchor).toHaveAttribute("data-active", "false");
    expect(anchor).not.toHaveAttribute("aria-current");
  });

  it("exposes vertical variant via data attribute", () => {
    render(<NavLink href="/triage" label="Triage" variant="vertical" data-testid="nav" />);
    expect(screen.getByTestId("nav")).toHaveAttribute("data-variant", "vertical");
  });

  it("sets aria-current=page and data-active when active", () => {
    render(<NavLink href="/queue" label="My queue" active data-testid="nav" />);
    const anchor = screen.getByTestId("nav");
    expect(anchor).toHaveAttribute("aria-current", "page");
    expect(anchor).toHaveAttribute("data-active", "true");
  });

  it("renders count badge with screen-reader-friendly text", () => {
    render(<NavLink href="/queue" label="My queue" count={12} data-testid="nav" />);
    const anchor = screen.getByTestId("nav");
    // Accessible name concatenates label + sr-only ", 12 items".
    expect(anchor).toHaveAccessibleName("My queue , 12 items");
    // The visible badge itself is aria-hidden so SR doesn't repeat "12".
    expect(screen.getByText("12")).toHaveAttribute("aria-hidden", "true");
  });

  it("prevents click and href when disabled", async () => {
    const onClick = vi.fn();
    render(<NavLink href="/queue" label="My queue" disabled onClick={onClick} data-testid="nav" />);
    const anchor = screen.getByTestId("nav");
    expect(anchor).toHaveAttribute("aria-disabled", "true");
    expect(anchor).not.toHaveAttribute("href");
    expect(anchor).toHaveAttribute("tabindex", "-1");

    await userEvent.click(anchor);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("fires onClick normally when not disabled", async () => {
    const onClick = vi.fn((event) => event.preventDefault());
    render(<NavLink href="/queue" label="My queue" onClick={onClick} data-testid="nav" />);
    await userEvent.click(screen.getByTestId("nav"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
