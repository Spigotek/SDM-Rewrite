import { useTranslation } from "@sdm/i18n";
import type { Session } from "@sdm/auth";

/**
 * Greeting band at the top of `/`. Pulls the first name out of `session.displayName`
 * — splitting on whitespace is sufficient because every seed user follows the
 * `<First> <Last>` convention (`packages/api-mocks/src/fixtures/users.ts`). If
 * the BFF ever ships a real `firstName` field on the `/me` response we'd swap
 * to that, but the current shape collapses to `displayName` only.
 */
export function HeroGreeting({ session }: { session: Session }) {
  const { t } = useTranslation("portal");
  const firstName = session.displayName.split(/\s+/)[0] ?? session.displayName;
  return (
    <section className="sdm-home-hero" data-testid="home-hero">
      <h1>{t("home.greeting", { name: firstName })}</h1>
      <p className="sdm-home-hero-sub">{t("home.subgreeting")}</p>
    </section>
  );
}
