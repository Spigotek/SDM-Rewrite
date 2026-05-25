import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Link } from "./Link";

describe("<Link>", () => {
  it("renders an anchor with default variant", () => {
    render(
      <Link href="/queue" data-testid="link">
        Queue
      </Link>,
    );
    const anchor = screen.getByTestId("link");
    expect(anchor.tagName).toBe("A");
    expect(anchor).toHaveAttribute("href", "/queue");
    expect(anchor).toHaveAttribute("data-component", "link");
    expect(anchor).toHaveAttribute("data-variant", "default");
  });

  it("supports subtle variant", () => {
    render(
      <Link href="/x" variant="subtle">
        Subtle
      </Link>,
    );
    expect(screen.getByText("Subtle")).toHaveAttribute("data-variant", "subtle");
  });

  it("adds target/rel when marked external", () => {
    render(
      <Link href="https://example.com" external>
        External
      </Link>,
    );
    const anchor = screen.getByText("External");
    expect(anchor).toHaveAttribute("target", "_blank");
    expect(anchor).toHaveAttribute("rel", "noopener noreferrer");
  });
});
