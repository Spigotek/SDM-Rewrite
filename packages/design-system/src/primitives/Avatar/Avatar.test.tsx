import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Avatar, hashNameToColorIndex } from "./Avatar";
import { AvatarGroup } from "./AvatarGroup";

describe("<Avatar>", () => {
  it("renders initials when no src is provided", () => {
    render(<Avatar name="Anna Lukacova" />);
    const root = screen.getByRole("img", { name: "Anna Lukacova" });
    expect(root).toHaveAttribute("data-component", "avatar");
    expect(root).toHaveAttribute("data-size", "md");
    expect(root.querySelector('[data-component="avatar-initials"]')).toHaveTextContent("AL");
    expect(root.querySelector("img")).toBeNull();
  });

  it("renders an image when src is provided and loads", () => {
    render(<Avatar name="Anna Lukacova" src="/avatar.png" />);
    const root = screen.getByRole("img", { name: "Anna Lukacova" });
    const img = root.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("src", "/avatar.png");
    expect(root.querySelector('[data-component="avatar-initials"]')).toBeNull();
  });

  it("falls back to initials when the image fails to load", () => {
    render(<Avatar name="Anna Lukacova" src="/missing.png" />);
    const img = screen.getByRole("img", { name: "Anna Lukacova" }).querySelector("img");
    expect(img).not.toBeNull();
    fireEvent.error(img!);
    expect(
      screen
        .getByRole("img", { name: "Anna Lukacova" })
        .querySelector('[data-component="avatar-initials"]'),
    ).toHaveTextContent("AL");
  });

  it("falls back to the User icon when name is empty", () => {
    render(<Avatar name="   " aria-label="Unknown user" />);
    const root = screen.getByRole("img", { name: "Unknown user" });
    expect(root.querySelector('[data-component="avatar-initials"]')).toBeNull();
    expect(root.querySelector("svg")).not.toBeNull();
  });

  it("renders a status dot with aria-hidden and an SR-only status label", () => {
    render(<Avatar name="Anna Lukacova" status="online" />);
    const root = screen.getByRole("img", { name: "Anna Lukacova" });
    expect(root).toHaveAttribute("data-status", "online");
    const dot = root.querySelector('[data-component="avatar-status-dot"]');
    expect(dot).not.toBeNull();
    expect(dot).toHaveAttribute("aria-hidden", "true");
    expect(root.textContent).toContain("(online)");
  });

  it("produces a deterministic colour hash for the same name", () => {
    const a = hashNameToColorIndex("Anna Lukacova");
    const b = hashNameToColorIndex("Anna Lukacova");
    const c = hashNameToColorIndex("ANNA LUKACOVA");
    expect(a).toBe(b);
    expect(a).toBe(c);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(5);
  });

  it("uses first two characters when name is a single word", () => {
    render(<Avatar name="Linear" />);
    expect(screen.getByText("LI")).toBeInTheDocument();
  });
});

describe("<AvatarGroup>", () => {
  it("renders all children when count is at or below max", () => {
    render(
      <AvatarGroup max={3}>
        <Avatar name="Anna Lukacova" />
        <Avatar name="Boris Novak" />
        <Avatar name="Cecilia Maly" />
      </AvatarGroup>,
    );
    expect(screen.getAllByRole("img")).toHaveLength(3);
    expect(screen.queryByText(/^\+/)).toBeNull();
  });

  it("collapses excess children into a +N overflow chip", () => {
    render(
      <AvatarGroup max={2}>
        <Avatar name="Anna Lukacova" />
        <Avatar name="Boris Novak" />
        <Avatar name="Cecilia Maly" />
        <Avatar name="Dusan Lago" />
      </AvatarGroup>,
    );
    expect(screen.getByText("+2")).toBeInTheDocument();
    expect(screen.getByLabelText("2 more")).toHaveAttribute("data-component", "avatar-overflow");
  });

  it("propagates size to all children", () => {
    render(
      <AvatarGroup size="lg" max={3}>
        <Avatar name="Anna Lukacova" />
        <Avatar name="Boris Novak" />
      </AvatarGroup>,
    );
    for (const img of screen.getAllByRole("img")) {
      expect(img).toHaveAttribute("data-size", "lg");
    }
  });
});
