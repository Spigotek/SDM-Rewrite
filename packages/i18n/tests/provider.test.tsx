import { render, screen, act } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  I18nProvider,
  bootstrapI18n,
  changeLocale,
  i18next,
  useDynamic,
  useLocale,
  useTranslation,
} from "../src/index";

function Probe() {
  const { t } = useTranslation();
  const { locale } = useLocale("portal");
  const resolve = useDynamic();
  return (
    <div>
      <p data-testid="signIn">{t("actions.signIn")}</p>
      <p data-testid="locale">{locale}</p>
      <p data-testid="idle-body">{t("session.idleBody", { count: 1 })}</p>
      <p data-testid="dynamic">{resolve({ sk: "Tenant Acme", en: "Tenant Acme EN" })}</p>
    </div>
  );
}

function PluralProbe() {
  const { t } = useTranslation();
  return <span data-testid="plural">{t("plurals.tickets", { count: 3 })}</span>;
}

describe("<I18nProvider>", () => {
  beforeAll(async () => {
    window.localStorage.clear();
    await bootstrapI18n({ app: "portal", initialLocale: "sk" });
  });

  beforeEach(async () => {
    // Reset to SK before every test for deterministic snapshots.
    if (i18next.language !== "sk") {
      await act(async () => {
        await i18next.changeLanguage("sk");
      });
    }
  });

  it("renders SK translations after SK bootstrap", () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId("signIn").textContent).toBe("Prihlásiť sa");
    expect(screen.getByTestId("locale").textContent).toBe("sk");
    expect(screen.getByTestId("idle-body").textContent).toContain("1 sekundu");
    expect(screen.getByTestId("dynamic").textContent).toBe("Tenant Acme");
  });

  it("switches to EN via changeLocale and updates <html lang>", async () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    expect(document.documentElement.lang).toBe("sk");

    await act(async () => {
      await changeLocale("portal", "en");
    });

    expect(screen.getByTestId("signIn").textContent).toBe("Sign in");
    expect(screen.getByTestId("locale").textContent).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(screen.getByTestId("dynamic").textContent).toBe("Tenant Acme EN");
  });

  it("uses ICU plural — 'few' branch SK (count=3)", () => {
    render(
      <I18nProvider>
        <PluralProbe />
      </I18nProvider>,
    );
    expect(screen.getByTestId("plural").textContent).toBe("3 tickety");
  });
});
