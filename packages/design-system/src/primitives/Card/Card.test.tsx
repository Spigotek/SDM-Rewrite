import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "./Card";

describe("<Card>", () => {
  it("renders the children inside a surface variant by default", () => {
    render(<Card>Content</Card>);
    const card = screen.getByText("Content").closest('[data-component="card"]');
    expect(card).toHaveAttribute("data-variant", "surface");
  });

  it("renders title + meta inside header when provided", () => {
    render(
      <Card title="Heading" meta="Updated 2 min ago">
        Body
      </Card>,
    );
    expect(screen.getByText("Heading").tagName).toBe("H3");
    expect(screen.getByText("Updated 2 min ago")).toBeInTheDocument();
  });

  it("renders footer slot when provided and toggles interactive variant", () => {
    render(
      <Card variant="interactive" footer={<button type="button">Action</button>}>
        Body
      </Card>,
    );
    const card = screen.getByText("Body").closest('[data-component="card"]');
    expect(card).toHaveAttribute("data-variant", "interactive");
    expect(screen.getByRole("button", { name: "Action" })).toBeInTheDocument();
  });
});
