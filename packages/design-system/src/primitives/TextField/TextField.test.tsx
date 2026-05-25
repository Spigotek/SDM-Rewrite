import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextField } from "./TextField";

describe("<TextField>", () => {
  it("renders the label linked to the input", () => {
    render(<TextField label="Username" />);
    const input = screen.getByLabelText("Username");
    expect(input).toHaveAttribute("type", "text");
    expect(input.getAttribute("aria-invalid")).toBeNull();
  });

  it("propagates user input via onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TextField label="Email" type="email" onChange={onChange} />);
    await user.type(screen.getByLabelText("Email"), "a@b.c");
    expect(onChange).toHaveBeenCalled();
  });

  it("renders helper text wired via aria-describedby", () => {
    render(<TextField label="Username" helper="3-32 znakov" />);
    const input = screen.getByLabelText("Username");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    if (describedBy) {
      const helper = document.getElementById(describedBy);
      expect(helper).toHaveTextContent("3-32 znakov");
    }
  });

  it("renders error message with role=alert and aria-invalid", () => {
    render(<TextField label="Username" error="Vyplň pole" />);
    const input = screen.getByLabelText("Username");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Vyplň pole");
  });
});
