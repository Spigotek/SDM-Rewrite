import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextArea } from "./TextArea";

describe("<TextArea>", () => {
  it("renders the label and links it to the textarea", () => {
    render(<TextArea label="Comment" />);
    const ta = screen.getByLabelText("Comment");
    expect(ta.tagName).toBe("TEXTAREA");
  });

  it("invokes onChange when user types", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TextArea label="Comment" onChange={onChange} />);
    await user.type(screen.getByLabelText("Comment"), "Hi");
    expect(onChange).toHaveBeenCalled();
  });

  it("renders a character counter when maxLength is set", () => {
    render(<TextArea label="Note" maxLength={120} value="Hi" onChange={() => {}} />);
    expect(screen.getByText("2 / 120")).toBeInTheDocument();
  });

  it("renders error text with role=alert", () => {
    render(<TextArea label="Comment" error="Required" />);
    const ta = screen.getByLabelText("Comment");
    expect(ta).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
  });
});
