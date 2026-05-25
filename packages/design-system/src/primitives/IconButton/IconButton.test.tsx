import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { X } from "lucide-react";
import { Icon } from "../Icon";
import { IconButton } from "./IconButton";

describe("<IconButton>", () => {
  it("renders with ghost variant by default and mandatory aria-label", () => {
    render(<IconButton aria-label="Close" icon={<Icon icon={X} />} />);
    const btn = screen.getByRole("button", { name: "Close" });
    expect(btn).toHaveAttribute("data-component", "icon-button");
    expect(btn).toHaveAttribute("data-variant", "ghost");
  });

  it("supports alternative variants and sizes", () => {
    render(<IconButton aria-label="Delete" icon={<Icon icon={X} />} variant="danger" size="sm" />);
    const btn = screen.getByRole("button", { name: "Delete" });
    expect(btn).toHaveAttribute("data-variant", "danger");
    expect(btn).toHaveAttribute("data-size", "sm");
  });

  it("fires onClick on activation", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<IconButton aria-label="Close" icon={<Icon icon={X} />} onClick={onClick} />);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
