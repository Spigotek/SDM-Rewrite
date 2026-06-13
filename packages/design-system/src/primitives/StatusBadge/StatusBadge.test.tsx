import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CA_SDM_TRANSITIONS, StatusBadge, type TicketStatus } from "./StatusBadge";

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

  // ── L.1.C — transitionable mode ────────────────────────────────────────────

  it("renders as a <button> when transitionable is set", () => {
    render(<StatusBadge status="open" transitionable />);
    const trigger = screen.getByRole("button", { name: /Otvorený/i });
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger).toHaveAttribute("data-transitionable", "true");
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("opens a menu listing the documented next statuses when clicked", async () => {
    const user = userEvent.setup();
    render(<StatusBadge status="open" transitionable />);
    const trigger = screen.getByRole("button", { name: /Otvorený/i });
    await user.click(trigger);
    const menu = await screen.findByTestId("status-badge-menu");
    expect(menu).toHaveAttribute("role", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    // CA_SDM_TRANSITIONS.open = in_progress, hold, waiting_customer, waiting_vendor, resolved, cancelled
    for (const target of CA_SDM_TRANSITIONS.open) {
      expect(screen.getByTestId(`status-badge-menu-item-${target}`)).toBeInTheDocument();
    }
  });

  it("respects an explicit allowedTransitions prop", async () => {
    const user = userEvent.setup();
    render(
      <StatusBadge status="open" transitionable allowedTransitions={["resolved", "cancelled"]} />,
    );
    await user.click(screen.getByRole("button"));
    expect(screen.getByTestId("status-badge-menu-item-resolved")).toBeInTheDocument();
    expect(screen.getByTestId("status-badge-menu-item-cancelled")).toBeInTheDocument();
    expect(screen.queryByTestId("status-badge-menu-item-in_progress")).toBeNull();
  });

  it("falls back to CA_SDM_TRANSITIONS when allowedTransitions is omitted", async () => {
    const user = userEvent.setup();
    render(<StatusBadge status="resolved" transitionable />);
    await user.click(screen.getByRole("button"));
    // CA_SDM_TRANSITIONS.resolved = closed, reopened
    expect(screen.getByTestId("status-badge-menu-item-closed")).toBeInTheDocument();
    expect(screen.getByTestId("status-badge-menu-item-reopened")).toBeInTheDocument();
    expect(screen.queryByTestId("status-badge-menu-item-in_progress")).toBeNull();
  });

  it("fires onTransition with the picked status and closes the menu", async () => {
    const user = userEvent.setup();
    const onTransition = vi.fn();
    render(<StatusBadge status="open" transitionable onTransition={onTransition} />);
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByTestId("status-badge-menu-item-in_progress"));
    expect(onTransition).toHaveBeenCalledTimes(1);
    expect(onTransition).toHaveBeenCalledWith<[TicketStatus]>("in_progress");
    await waitFor(() => {
      expect(screen.queryByTestId("status-badge-menu")).toBeNull();
    });
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(<StatusBadge status="open" transitionable />);
    await user.click(screen.getByRole("button"));
    expect(screen.getByTestId("status-badge-menu")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByTestId("status-badge-menu")).toBeNull();
    });
  });

  it("does not open when disabled", async () => {
    const user = userEvent.setup();
    render(<StatusBadge status="open" transitionable disabled />);
    const trigger = screen.getByRole("button");
    expect(trigger).toBeDisabled();
    await user.click(trigger);
    expect(screen.queryByTestId("status-badge-menu")).toBeNull();
  });

  it("exports CA_SDM_TRANSITIONS with terminal statuses mapped to empty arrays", () => {
    expect(CA_SDM_TRANSITIONS.cancelled).toEqual([]);
    expect(CA_SDM_TRANSITIONS.rejected).toEqual([]);
    expect(CA_SDM_TRANSITIONS.approval_rejected).toEqual([]);
    expect(CA_SDM_TRANSITIONS.in_progress.length).toBeGreaterThan(0);
  });
});
