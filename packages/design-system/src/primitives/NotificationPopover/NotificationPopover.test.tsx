import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NotificationPopover, type NotificationEvent } from "./NotificationPopover";

function setupAnchor() {
  const anchor = document.createElement("button");
  anchor.textContent = "bell";
  document.body.appendChild(anchor);
  const anchorRef = { current: anchor };
  return { anchor, anchorRef };
}

function makeEvent(over: Partial<NotificationEvent>): NotificationEvent {
  return {
    id: over.id ?? "evt-1",
    occurredAt: over.occurredAt ?? "2026-06-13T10:00:00Z",
    verb: over.verb ?? "updated",
    ...over,
  };
}

describe("<NotificationPopover>", () => {
  it("renders nothing when closed", () => {
    const { anchorRef } = setupAnchor();
    const { container } = render(
      <NotificationPopover open={false} onClose={() => {}} events={[]} anchorRef={anchorRef} />,
    );
    expect(container.querySelector('[data-testid="notif-popover"]')).toBeNull();
  });

  it("renders the empty state when no events are supplied", () => {
    const { anchorRef } = setupAnchor();
    render(
      <NotificationPopover
        open
        onClose={() => {}}
        events={[]}
        anchorRef={anchorRef}
        emptyMessage="No new notifications"
      />,
    );
    expect(screen.getByTestId("notif-popover")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No new notifications" })).toBeInTheDocument();
    expect(screen.queryByTestId("notif-list")).toBeNull();
  });

  it("collapses 3+ contiguous same-ticket events into a cluster row", () => {
    const { anchorRef } = setupAnchor();
    const events: NotificationEvent[] = [
      makeEvent({ id: "a", ticketRef: "INC-1", verb: "first" }),
      makeEvent({ id: "b", ticketRef: "INC-1", verb: "second" }),
      makeEvent({ id: "c", ticketRef: "INC-1", verb: "third" }),
      makeEvent({ id: "d", ticketRef: "INC-2", verb: "other" }),
    ];
    render(<NotificationPopover open onClose={() => {}} events={events} anchorRef={anchorRef} />);
    const cluster = screen.getByTestId("notif-cluster-count");
    expect(cluster).toHaveTextContent("+2 more");
    // Cluster head + the lone INC-2 row = 2 list items total.
    const rows = screen
      .getByTestId("notif-list")
      .querySelectorAll("[data-component='notification-row']");
    expect(rows).toHaveLength(2);
  });

  it("fires onMarkAllRead when the header button is clicked", () => {
    const { anchorRef } = setupAnchor();
    const onMarkAllRead = vi.fn();
    render(
      <NotificationPopover
        open
        onClose={() => {}}
        events={[makeEvent({})]}
        anchorRef={anchorRef}
        onMarkAllRead={onMarkAllRead}
        markAllReadLabel="Mark all"
      />,
    );
    fireEvent.click(screen.getByTestId("notif-mark-all-read"));
    expect(onMarkAllRead).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape is pressed", () => {
    const { anchorRef } = setupAnchor();
    const onClose = vi.fn();
    render(<NotificationPopover open onClose={onClose} events={[]} anchorRef={anchorRef} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose on mousedown outside the popover and anchor", () => {
    const { anchorRef } = setupAnchor();
    const onClose = vi.fn();
    render(<NotificationPopover open onClose={onClose} events={[]} anchorRef={anchorRef} />);
    const outside = document.createElement("div");
    document.body.appendChild(outside);
    fireEvent.mouseDown(outside);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("forwards refs to the root element", () => {
    const { anchorRef } = setupAnchor();
    const ref = createRef<HTMLDivElement>();
    render(
      <NotificationPopover open onClose={() => {}} events={[]} anchorRef={anchorRef} ref={ref} />,
    );
    expect(ref.current).not.toBeNull();
    expect(ref.current?.getAttribute("data-component")).toBe("notification-popover");
  });

  it("renders the View all footer only when a viewAllHref is provided", () => {
    const { anchorRef } = setupAnchor();
    const { rerender } = render(
      <NotificationPopover
        open
        onClose={() => {}}
        events={[makeEvent({})]}
        anchorRef={anchorRef}
      />,
    );
    expect(screen.queryByTestId("notif-view-all")).toBeNull();
    rerender(
      <NotificationPopover
        open
        onClose={() => {}}
        events={[makeEvent({})]}
        anchorRef={anchorRef}
        viewAllHref="/notifications"
        viewAllLabel="View all"
      />,
    );
    const link = screen.getByTestId("notif-view-all");
    expect(link).toHaveAttribute("href", "/notifications");
    expect(link).toHaveTextContent("View all");
  });
});
