import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toast } from "./Toast";
import { ToastViewport } from "./ToastViewport";

describe("<Toast>", () => {
  it("renders the title", () => {
    render(<Toast intent="success" title="Saved" />);
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("renders the description when provided, omits it when absent", () => {
    const { rerender } = render(
      <Toast intent="info" title="Heads up" description="Details here" />,
    );
    expect(screen.getByText("Details here")).toBeInTheDocument();

    rerender(<Toast intent="info" title="Heads up" />);
    expect(screen.queryByText("Details here")).not.toBeInTheDocument();
  });

  it("calls onDismiss when the dismiss button is clicked", async () => {
    const onDismiss = vi.fn();
    render(<Toast intent="success" title="Saved" onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("disables the dismiss button when onDismiss is omitted", () => {
    render(<Toast intent="success" title="Saved" />);
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeDisabled();
  });

  it("uses role=status for success intent", () => {
    render(<Toast intent="success" title="Saved" />);
    expect(screen.getByRole("status")).toHaveAttribute("data-intent", "success");
  });

  it("uses role=status for info intent", () => {
    render(<Toast intent="info" title="FYI" />);
    expect(screen.getByRole("status")).toHaveAttribute("data-intent", "info");
  });

  it("uses role=alert for warning intent", () => {
    render(<Toast intent="warning" title="Careful" />);
    expect(screen.getByRole("alert")).toHaveAttribute("data-intent", "warning");
  });

  it("uses role=alert for danger intent", () => {
    render(<Toast intent="danger" title="Failed" />);
    expect(screen.getByRole("alert")).toHaveAttribute("data-intent", "danger");
  });

  it("renders a leading icon and exposes intent on the root", () => {
    const { container } = render(<Toast intent="warning" title="Careful" />);
    const root = container.querySelector('[data-component="toast"]');
    expect(root).toHaveAttribute("data-intent", "warning");
    expect(container.querySelector('[data-component="toast-icon"]')).toBeInTheDocument();
  });
});

describe("<ToastViewport>", () => {
  it("defaults aria-live to polite when no danger child is present", () => {
    const { container } = render(
      <ToastViewport>
        <Toast intent="success" title="Saved" />
        <Toast intent="info" title="FYI" />
      </ToastViewport>,
    );
    const viewport = container.querySelector('[data-component="toast-viewport"]');
    expect(viewport).toHaveAttribute("aria-live", "polite");
  });

  it("switches aria-live to assertive when any child is intent=danger", () => {
    const { container } = render(
      <ToastViewport>
        <Toast intent="success" title="Saved" />
        <Toast intent="danger" title="Failed" />
      </ToastViewport>,
    );
    const viewport = container.querySelector('[data-component="toast-viewport"]');
    expect(viewport).toHaveAttribute("aria-live", "assertive");
  });
});
