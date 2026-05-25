import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Select } from "./Select";

const OPTIONS = [
  { value: "low", label: "Nízka" },
  { value: "medium", label: "Stredná" },
  { value: "high", label: "Vysoká" },
];

describe("<Select>", () => {
  it("renders the trigger with a placeholder when no value selected", () => {
    render(<Select label="Priorita" options={OPTIONS} placeholder="Vyber…" />);
    const trigger = screen.getByRole("combobox", { name: "Priorita" });
    expect(trigger).toHaveTextContent("Vyber…");
    expect(trigger.closest('[data-component="select"]')).toBeInTheDocument();
  });

  it("renders selected option label when defaultValue is provided", () => {
    render(<Select label="Priorita" options={OPTIONS} defaultValue="high" />);
    const trigger = screen.getByRole("combobox", { name: "Priorita" });
    expect(trigger).toHaveTextContent("Vysoká");
  });

  it("renders error message with role=alert", () => {
    render(<Select label="Priorita" options={OPTIONS} error="Povinné pole" />);
    const trigger = screen.getByRole("combobox", { name: "Priorita" });
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Povinné pole");
  });
});
