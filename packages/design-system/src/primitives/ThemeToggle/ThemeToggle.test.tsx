import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "./ThemeToggle";

describe("<ThemeToggle>", () => {
  it("renders the current value as a data attribute", () => {
    render(<ThemeToggle value="dark" onChange={() => {}} />);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("data-component", "theme-toggle");
    expect(btn).toHaveAttribute("data-value", "dark");
  });

  it("cycles system → light → dark → system on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<ThemeToggle value="system" onChange={onChange} />);

    await user.click(screen.getByRole("button"));
    expect(onChange).toHaveBeenLastCalledWith("light");

    rerender(<ThemeToggle value="light" onChange={onChange} />);
    await user.click(screen.getByRole("button"));
    expect(onChange).toHaveBeenLastCalledWith("dark");

    rerender(<ThemeToggle value="dark" onChange={onChange} />);
    await user.click(screen.getByRole("button"));
    expect(onChange).toHaveBeenLastCalledWith("system");
  });

  it("uses a default aria-label that reflects the current state", () => {
    render(<ThemeToggle value="light" onChange={() => {}} />);
    expect(
      screen.getByRole("button", { name: /Theme: light \(click to switch to dark\)/ }),
    ).toBeInTheDocument();
  });

  it("supports a custom aria-label", () => {
    render(<ThemeToggle value="dark" onChange={() => {}} aria-label="Prepnúť tému" />);
    expect(screen.getByRole("button", { name: "Prepnúť tému" })).toBeInTheDocument();
  });

  it("activates via keyboard (Space / Enter)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ThemeToggle value="system" onChange={onChange} />);
    const btn = screen.getByRole("button");
    btn.focus();
    expect(btn).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("light");
    await user.keyboard(" ");
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
