import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Mail } from "lucide-react";
import { Icon } from "../Icon";
import { Tile } from "./Tile";

describe("<Tile>", () => {
  it("renders as a native <button type='button'> by default", () => {
    render(<Tile title="Reset password" description="Self-service" />);
    const tile = screen.getByRole("button", { name: /Reset password/ });
    expect(tile.tagName).toBe("BUTTON");
    expect(tile).toHaveAttribute("type", "button");
  });

  it("renders as an <a> when href is provided", () => {
    render(<Tile href="/catalog/email" title="Email issue" description="Mailbox" />);
    const tile = screen.getByRole("link", { name: /Email issue/ });
    expect(tile.tagName).toBe("A");
    expect(tile).toHaveAttribute("href", "/catalog/email");
  });

  it("exposes data-component and data-variant attributes", () => {
    render(<Tile title="KB article" variant="kb" />);
    const tile = screen.getByRole("button", { name: /KB article/ });
    expect(tile).toHaveAttribute("data-component", "tile");
    expect(tile).toHaveAttribute("data-variant", "kb");
  });

  it("renders the caller-provided icon inside the badge slot", () => {
    render(<Tile title="Email issue" icon={<Icon icon={Mail} />} />);
    const tile = screen.getByRole("button", { name: /Email issue/ });
    expect(tile.querySelector('[data-component="icon"]')).not.toBeNull();
  });
});
