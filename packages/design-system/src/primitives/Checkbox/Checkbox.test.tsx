import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Checkbox } from "./Checkbox";

describe("<Checkbox>", () => {
  it("renders an unchecked checkbox with the provided label", () => {
    render(<Checkbox label="Súhlasím" />);
    const cb = screen.getByRole("checkbox", { name: "Súhlasím" });
    expect(cb).toHaveAttribute("data-state", "unchecked");
  });

  it("invokes onCheckedChange on click", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Checkbox label="Súhlasím" onCheckedChange={onCheckedChange} />);
    await user.click(screen.getByRole("checkbox", { name: "Súhlasím" }));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("renders indeterminate state", () => {
    render(<Checkbox label="Vyber všetko" checked="indeterminate" onCheckedChange={() => {}} />);
    const cb = screen.getByRole("checkbox", { name: "Vyber všetko" });
    expect(cb).toHaveAttribute("data-state", "indeterminate");
  });
});
