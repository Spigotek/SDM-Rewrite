import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { CommandPalette } from "./CommandPalette";
import type { CommandPaletteAction } from "./types";

function makeAction(
  id: string,
  overrides: Partial<CommandPaletteAction> = {},
): CommandPaletteAction {
  return {
    id,
    title: id,
    group: "actions",
    onActivate: vi.fn(),
    ...overrides,
  };
}

const SAMPLE_ACTIONS: ReadonlyArray<CommandPaletteAction> = [
  makeAction("nav:home", { title: "Domov", group: "navigate" }),
  makeAction("nav:tickets", { title: "Moje tickety", group: "navigate" }),
  makeAction("act:theme", { title: "Toggle theme", group: "actions" }),
  makeAction("act:signout", { title: "Sign out", group: "actions" }),
  makeAction("ticket:INC-1042", {
    title: "INC-1042 Billing login",
    group: "tickets",
    subtitle: "Open",
  }),
];

beforeEach(() => {
  localStorage.clear();
});

describe("<CommandPalette>", () => {
  it("renders nothing when open is false", () => {
    const { container } = render(
      <CommandPalette open={false} onClose={vi.fn()} actions={SAMPLE_ACTIONS} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the combobox + listbox roles when open", () => {
    render(<CommandPalette open onClose={vi.fn()} actions={SAMPLE_ACTIONS} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getAllByRole("option").length).toBe(SAMPLE_ACTIONS.length);
  });

  it("exposes data-component + data-state + dialog attributes", () => {
    render(<CommandPalette open onClose={vi.fn()} actions={SAMPLE_ACTIONS} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-component", "command-palette");
    expect(dialog).toHaveAttribute("data-state", "open");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("Escape calls onClose", () => {
    const onClose = vi.fn();
    render(<CommandPalette open onClose={onClose} actions={SAMPLE_ACTIONS} />);
    const input = screen.getByRole("combobox");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Arrow keys cycle the selected option", () => {
    render(<CommandPalette open onClose={vi.fn()} actions={SAMPLE_ACTIONS} />);
    const input = screen.getByRole("combobox");

    // Initial selection is the first option.
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getAllByRole("option")[2]).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");

    // Wraps around when going past the end.
    for (let i = 0; i < SAMPLE_ACTIONS.length; i += 1) {
      fireEvent.keyDown(input, { key: "ArrowDown" });
    }
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");
  });

  it("Enter activates the selected action and calls onClose", () => {
    const onClose = vi.fn();
    const onActivate = vi.fn();
    const actions: ReadonlyArray<CommandPaletteAction> = [
      makeAction("first", { title: "First", onActivate }),
      makeAction("second", { title: "Second" }),
    ];
    render(<CommandPalette open onClose={onClose} actions={actions} />);
    const input = screen.getByRole("combobox");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Mode prefix '>' filters to the actions group only", () => {
    render(<CommandPalette open onClose={vi.fn()} actions={SAMPLE_ACTIONS} />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: ">" } });
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-mode", "actions");
    const options = screen.getAllByRole("option");
    for (const option of options) {
      expect(option).toHaveAttribute("data-group", "actions");
    }
    expect(options.length).toBe(2);
  });

  it("Mode prefix '#' filters to the navigate group only", () => {
    render(<CommandPalette open onClose={vi.fn()} actions={SAMPLE_ACTIONS} />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "#" } });
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-mode", "navigate");
    const options = screen.getAllByRole("option");
    for (const option of options) {
      expect(option).toHaveAttribute("data-group", "navigate");
    }
    expect(options.length).toBe(2);
  });

  it("Mode prefix '?' shows the help footer instead of results", () => {
    render(<CommandPalette open onClose={vi.fn()} actions={SAMPLE_ACTIONS} />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "?" } });
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-mode", "help");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("note")).toBeInTheDocument();
  });

  it("Renders Recent group from localStorage on open when query is empty", async () => {
    // Pre-populate recents and verify they surface in their own group.
    localStorage.setItem("sdm.cmdk.recent", JSON.stringify(["act:theme"]));
    render(<CommandPalette open onClose={vi.fn()} actions={SAMPLE_ACTIONS} />);
    // The recent action shows up twice — once in its native group, once in
    // the synthesised "Recent" group at the top.
    const groups = Array.from(document.querySelectorAll("[data-group]"));
    const groupNames = groups.map((node) => node.getAttribute("data-group"));
    expect(groupNames).toContain("recent");
  });

  it("Debounces onQueryChange and re-filters locally on every keystroke", () => {
    vi.useFakeTimers();
    try {
      const onQueryChange = vi.fn();
      render(
        <CommandPalette
          open
          onClose={vi.fn()}
          actions={SAMPLE_ACTIONS}
          onQueryChange={onQueryChange}
        />,
      );
      const input = screen.getByRole("combobox") as HTMLInputElement;
      // Local filter is instant — only navigate items containing "domov" remain.
      act(() => {
        fireEvent.change(input, { target: { value: "domov" } });
      });
      const options = screen.getAllByRole("option");
      expect(options.length).toBe(1);
      expect(options[0]).toHaveTextContent("Domov");

      // onQueryChange does not fire until the 120 ms debounce elapses.
      expect(onQueryChange).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(150);
      });
      expect(onQueryChange).toHaveBeenCalledTimes(1);
      expect(onQueryChange).toHaveBeenCalledWith("domov");
    } finally {
      vi.useRealTimers();
    }
  });

  it("Empty results render the emptyMessage status", () => {
    render(
      <CommandPalette
        open
        onClose={vi.fn()}
        actions={SAMPLE_ACTIONS}
        emptyMessage="No matches here"
      />,
    );
    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "xyzzy-no-match" } });
    expect(screen.getByText("No matches here")).toBeInTheDocument();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("Tab keypress is swallowed (focus stays in the input)", () => {
    render(<CommandPalette open onClose={vi.fn()} actions={SAMPLE_ACTIONS} />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    input.focus();
    const event = fireEvent.keyDown(input, { key: "Tab" });
    // fireEvent.keyDown returns false when defaultPrevented = true.
    expect(event).toBe(false);
    expect(document.activeElement).toBe(input);
  });

  it("cmd+1 activates the first visible row", () => {
    const onActivate = vi.fn();
    const actions: ReadonlyArray<CommandPaletteAction> = [
      makeAction("first", { title: "First", onActivate }),
      makeAction("second", { title: "Second" }),
    ];
    render(<CommandPalette open onClose={vi.fn()} actions={actions} />);
    const input = screen.getByRole("combobox");
    fireEvent.keyDown(input, { key: "1", metaKey: true });
    expect(onActivate).toHaveBeenCalledTimes(1);
  });
});
