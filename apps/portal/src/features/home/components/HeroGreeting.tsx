import { useTranslation } from "@sdm/i18n";
import type { Session } from "@sdm/auth";

/**
 * Greeting band at the top of `/`. Pulls the first name out of
 * `session.displayName` — splitting on whitespace is sufficient because every
 * seed user follows the `<First> <Last>` convention
 * (`packages/api-mocks/src/fixtures/users.ts`). If the BFF ever ships a real
 * `firstName` field on the `/me` response we'd swap to that, but the current
 * shape collapses to `displayName` only.
 *
 * I.0 perf fix: when `session` is null (bootstrap session fetch returned a
 * non-2xx and `SessionProvider` is still in its `loading` retry state) the
 * component renders the anonymous greeting variant so this part of the page
 * still paints at the first render, keeping LCP bound by JS download +
 * parse rather than by the `/me` round-trip.
 */
export function HeroGreeting({ session }: { session: Session | null }) {
  const { t } = useTranslation("portal");
  if (!session) {
    return (
      <section className="sdm-home-hero" data-testid="home-hero">
        <h1>{t("home.greetingAnonymous")}</h1>
        <p className="sdm-home-hero-sub">{t("home.subgreeting")}</p>
      </section>
    );
  }
  const firstName = session.displayName.split(/\s+/)[0] ?? session.displayName;
  return (
    <section className="sdm-home-hero" data-testid="home-hero">
      <h1>{t("home.greeting", { name: firstName })}</h1>
      <p className="sdm-home-hero-sub">{t("home.subgreeting")}</p>
    </section>
  );
}
