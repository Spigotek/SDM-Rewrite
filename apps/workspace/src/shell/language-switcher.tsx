import { useLocale, useTranslation, type Locale } from "@sdm/i18n";

const OPTIONS: readonly Locale[] = ["sk", "en"];

export function LanguageSwitcher() {
  const { t } = useTranslation();
  const { locale, setLocale } = useLocale("workspace");
  return (
    <label className="sdm-language-switcher" data-testid="language-switcher">
      <span className="sdm-language-label">{t("language.label")}</span>
      <select
        value={locale}
        onChange={(e) => {
          void setLocale(e.target.value as Locale);
        }}
        aria-label={t("language.label")}
        data-testid="language-switcher-select"
      >
        {OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {t(`language.${opt}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
