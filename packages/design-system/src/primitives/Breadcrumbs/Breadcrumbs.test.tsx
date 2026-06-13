import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Breadcrumbs } from "./Breadcrumbs";

describe("<Breadcrumbs>", () => {
  it("renders a nav with default aria-label", () => {
    render(<Breadcrumbs items={[{ label: "Tenants", href: "/tenants" }, { label: "SOIMCO" }]} />);
    const nav = screen.getByRole("navigation", { name: "Breadcrumbs" });
    expect(nav).toHaveAttribute("data-component", "breadcrumbs");
  });

  it("supports a custom aria-label", () => {
    render(
      <Breadcrumbs
        aria-label="Ticket trail"
        items={[{ label: "Tickets", href: "/tickets" }, { label: "INC-1042" }]}
      />,
    );
    expect(screen.getByRole("navigation", { name: "Ticket trail" })).toBeInTheDocument();
  });

  it("renders all items below the truncation threshold", () => {
    render(
      <Breadcrumbs
        items={[
          { label: "Tenants", href: "/tenants" },
          { label: "SOIMCO", href: "/tenants/soimco" },
          { label: "Incidents", href: "/tenants/soimco/incidents" },
          { label: "INC-1042" },
        ]}
      />,
    );
    expect(screen.getByText("Tenants")).toBeInTheDocument();
    expect(screen.getByText("SOIMCO")).toBeInTheDocument();
    expect(screen.getByText("Incidents")).toBeInTheDocument();
    expect(screen.getByText("INC-1042")).toBeInTheDocument();
    expect(screen.queryByText("…")).not.toBeInTheDocument();
  });

  it("truncates the middle when items exceed the threshold", () => {
    render(
      <Breadcrumbs
        items={[
          { label: "Root", href: "/" },
          { label: "A", href: "/a" },
          { label: "B", href: "/a/b" },
          { label: "C", href: "/a/b/c" },
          { label: "D", href: "/a/b/c/d" },
          { label: "Leaf" },
        ]}
      />,
    );

    expect(screen.getByText("Root")).toBeInTheDocument();
    expect(screen.getByText("…")).toBeInTheDocument();
    expect(screen.getByText("D")).toBeInTheDocument();
    expect(screen.getByText("Leaf")).toBeInTheDocument();
    expect(screen.queryByText("A")).not.toBeInTheDocument();
    expect(screen.queryByText("B")).not.toBeInTheDocument();
    expect(screen.queryByText("C")).not.toBeInTheDocument();

    // Hidden-item count exposed to assistive tech.
    expect(screen.getByText("3 items hidden")).toBeInTheDocument();
  });

  it("renders the last item as a span with aria-current even when href is provided", () => {
    render(
      <Breadcrumbs
        items={[
          { label: "Tenants", href: "/tenants" },
          { label: "Current", href: "/tenants/current" },
        ]}
      />,
    );
    const current = screen.getByText("Current");
    expect(current.tagName).toBe("SPAN");
    expect(current).toHaveAttribute("aria-current", "page");

    const link = screen.getByText("Tenants");
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/tenants");
  });

  it("renders non-last items without href as plain spans", () => {
    render(<Breadcrumbs items={[{ label: "Static" }, { label: "Leaf" }]} />);
    const staticCrumb = screen.getByText("Static");
    expect(staticCrumb.tagName).toBe("SPAN");
    expect(staticCrumb).not.toHaveAttribute("aria-current");
  });

  it("marks separators as aria-hidden", () => {
    const { container } = render(
      <Breadcrumbs
        items={[
          { label: "Tenants", href: "/tenants" },
          { label: "SOIMCO", href: "/tenants/soimco" },
          { label: "Leaf" },
        ]}
      />,
    );

    const separators = container.querySelectorAll('[aria-hidden="true"]');
    // Two separators (between three crumbs) — every separator must be aria-hidden.
    const slashes = Array.from(separators).filter((el) => el.textContent === "/");
    expect(slashes.length).toBe(2);
    slashes.forEach((sep) => {
      expect(sep).toHaveAttribute("aria-hidden", "true");
    });
  });
});
