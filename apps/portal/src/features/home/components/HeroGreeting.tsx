import { useState } from "react";
import { useTranslation } from "@sdm/i18n";
import type { Session } from "@sdm/auth";
import { KbSearchBar } from "./KbSearchBar";

/**
 * Hero band — greeting on top, big KB search input under, popular-topic
 * chip row at the bottom (K.1 brief §10.1). The H1 stays the LCP target;
 * the search box is the dominant interactive surface for Lucia's primary
 * "search before tickets" journey.
 *
 * The search term lives here so the popular-topic chips can drive it —
 * clicking a chip is just `setTerm("Wi-Fi")` and the controlled
 * `<KbSearchBar>` picks it up via `valueOverride`.
 */
const POPULAR_TOPICS: ReadonlyArray<string> = ["Wi-Fi", "VPN", "Heslo", "Notebook"];

export function HeroGreeting({ session }: { session: Session | null }) {
  const { t } = useTranslation("portal");
  const [term, setTerm] = useState<string>("");
  const firstName = session ? (session.displayName.split(/\s+/)[0] ?? session.displayName) : null;

  return (
    <section className="sdm-home-hero" data-testid="home-hero">
      <h1 className="sdm-home-hero-title">
        {firstName ? t("home.greeting", { name: firstName }) : t("home.greetingAnonymous")}
      </h1>
      <p className="sdm-home-hero-sub">{t("home.subgreeting")}</p>
      <KbSearchBar valueOverride={term} onTermChange={setTerm} />
      <div className="sdm-home-hero-chips" data-testid="home-popular-topics">
        <span className="sdm-home-hero-chips-label">{t("home.hero.popularLabel")}</span>
        {POPULAR_TOPICS.map((topic) => (
          <button
            key={topic}
            type="button"
            className="sdm-home-hero-chip"
            data-testid={`home-popular-${topic.toLowerCase()}`}
            onClick={() => setTerm(topic)}
          >
            {topic}
          </button>
        ))}
      </div>
    </section>
  );
}
