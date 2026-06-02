/**
 * Coverage for the I.0 Resolution 4 critical-path i18n shim.
 *
 * Three contracts:
 *   1. Before hydration, `useTranslation()` resolves keys against the static
 *      critical dictionary (`i18n-critical.ts`).
 *   2. After `promoteToHydrated(i18next)`, subscribed components re-render
 *      and `t()` proxies to the real i18next instance (full ICU formatting).
 *   3. After `i18next.changeLanguage()`, the same components re-render with
 *      the new locale.
 */

import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { bootstrapI18n, changeLocale, __resetI18n } from "@sdm/i18n";
import { __resetI18nShim, promoteToHydrated, useTranslation } from "../i18n-shim";

function Probe() {
  // Mirrors real-component call shape — shell components use `useTranslation()`
  // for shared catalog keys, feature components use `useTranslation("portal")`
  // for app-namespaced keys.
  const { t: tShared, ready } = useTranslation();
  const { t: tPortal } = useTranslation("portal");
  return (
    <div>
      <p data-testid="signin">{tShared("actions.signIn")}</p>
      <p data-testid="greeting">{tPortal("home.actions.newIncident.title")}</p>
      <p data-testid="vars">{tPortal("home.greeting", { name: "Lucia" })}</p>
      <p data-testid="ready">{ready ? "ready" : "critical"}</p>
    </div>
  );
}

afterEach(() => {
  __resetI18nShim();
  __resetI18n();
});

describe("i18n-shim", () => {
  it("renders critical dictionary values before hydration", () => {
    // Force SK locale resolution for deterministic snapshot.
    document.documentElement.lang = "sk";
    render(<Probe />);
    expect(screen.getByTestId("signin").textContent).toBe("Prihlásiť sa");
    expect(screen.getByTestId("greeting").textContent).toBe("Nahlásiť problém");
    expect(screen.getByTestId("vars").textContent).toBe("Ahoj, Lucia 👋");
    expect(screen.getByTestId("ready").textContent).toBe("critical");
  });

  it("swaps to i18next after promoteToHydrated and re-renders", async () => {
    document.documentElement.lang = "sk";
    render(<Probe />);
    expect(screen.getByTestId("ready").textContent).toBe("critical");

    const instance = await bootstrapI18n({ app: "portal", initialLocale: "sk" });
    act(() => {
      promoteToHydrated(instance);
    });

    // Real i18next is now backing `t()` — keys still resolve, plus the
    // `ready` flag flips.
    expect(screen.getByTestId("ready").textContent).toBe("ready");
    expect(screen.getByTestId("signin").textContent).toBe("Prihlásiť sa");
    expect(screen.getByTestId("vars").textContent).toBe("Ahoj, Lucia 👋");
  });

  it("re-renders subscribed components on languageChanged", async () => {
    document.documentElement.lang = "sk";
    render(<Probe />);

    const instance = await bootstrapI18n({ app: "portal", initialLocale: "sk" });
    act(() => {
      promoteToHydrated(instance);
    });
    expect(screen.getByTestId("signin").textContent).toBe("Prihlásiť sa");

    // Switch to EN via the package's `changeLocale` (loads the EN catalog +
    // calls `i18next.changeLanguage`). The shim's `emit` listener fires on
    // `languageChanged` → version bump → every subscribed component
    // re-renders with the EN strings.
    await act(async () => {
      await changeLocale("portal", "en");
    });
    expect(screen.getByTestId("signin").textContent).toBe("Sign in");
  });
});

describe("i18n-critical", () => {
  beforeAll(() => {
    document.documentElement.lang = "sk";
  });

  it("returns the key itself on miss (no silent fallback)", () => {
    // `useTranslation` test is the integration path; here we ensure the
    // miss-fallback contract holds via the public hook.
    function Miss() {
      const { t } = useTranslation();
      return <span data-testid="miss">{t("does.not.exist")}</span>;
    }
    render(<Miss />);
    expect(screen.getByTestId("miss").textContent).toBe("does.not.exist");
  });
});
