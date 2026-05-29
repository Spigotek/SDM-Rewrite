import { useTranslation } from "@sdm/i18n";
import type { KbArticleStats } from "../types";

/**
 * Read-only article stats panel — view count + helpfulness ratio. No voting
 * widget here (the portal H.6 surface owns helpfulness submission). Agent
 * persona uses these signals while triaging which KB article to attach to a
 * ticket — high view count + high helpful ratio = strong candidate.
 *
 * Ratio is `null` when `viewCount == 0`; the UI renders an em-dash so the
 * empty case is obvious instead of a misleading "0 %".
 */
export function ArticleStats({ stats }: { stats: KbArticleStats }) {
  const { t, i18n } = useTranslation("workspace");
  const pctFmt = new Intl.NumberFormat(i18n.language, {
    style: "percent",
    maximumFractionDigits: 0,
  });
  const numFmt = new Intl.NumberFormat(i18n.language);
  return (
    <section className="sdm-kb-article-stats" data-testid="kb-article-stats">
      <h2 className="sdm-kb-article-stats-title">{t("kb.stats.title")}</h2>
      <dl className="sdm-kb-article-stats-list">
        <div className="sdm-kb-article-stats-row">
          <dt>{t("kb.stats.viewCount")}</dt>
          <dd data-testid="kb-stats-view-count">{numFmt.format(stats.viewCount)}</dd>
        </div>
        <div className="sdm-kb-article-stats-row">
          <dt>{t("kb.stats.helpfulCount")}</dt>
          <dd data-testid="kb-stats-helpful-count">{numFmt.format(stats.helpfulCount)}</dd>
        </div>
        <div className="sdm-kb-article-stats-row">
          <dt>{t("kb.stats.helpfulnessRatio")}</dt>
          <dd data-testid="kb-stats-helpfulness-ratio">
            {stats.helpfulnessRatio === null ? "—" : pctFmt.format(stats.helpfulnessRatio)}
          </dd>
        </div>
      </dl>
    </section>
  );
}
