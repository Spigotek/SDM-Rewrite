import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@sdm/i18n";
import { tenantId as toTenantId } from "@sdm/domain";
import { useSession } from "../../../shell/session-context";
import { kbAnalyticsQuery } from "./api";
import "../kb.css";
import "./editor.css";

/**
 * `/kb/analytics` — KB analytics dashboard for the kb_editor persona.
 *
 * Three cards:
 *   - Top 10 articles by views (last range).
 *   - Bottom 5 by helpfulness ratio.
 *   - Top search misses (queries with 0 results).
 *
 * Time range selector: 7d / 30d / 90d. Data is fixture-backed today;
 * real ingestion is deferred (no CA SDM source for these signals).
 */
const TENANT_PLACEHOLDER = toTenantId("__pending__");

type Range = "7d" | "30d" | "90d";

export default function KbAnalyticsRoute() {
  const { t } = useTranslation("workspace");
  const { session } = useSession();
  const tenantId = session?.tenantId ?? TENANT_PLACEHOLDER;
  const [range, setRange] = useState<Range>("30d");

  const snapshot = useQuery({
    ...kbAnalyticsQuery(tenantId, range),
    enabled: session !== null,
  });

  return (
    <section className="sdm-kb-analytics-page" data-testid="workspace-kb-analytics">
      <header className="sdm-kb-analytics-header">
        <h1 className="sdm-kb-analytics-title">{t("kb.analytics.title")}</h1>
        <div
          className="sdm-kb-analytics-range"
          role="radiogroup"
          aria-label={t("kb.analytics.rangeAria")}
        >
          {(["7d", "30d", "90d"] as const).map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={range === r}
              data-testid={`kb-analytics-range-${r}`}
              data-active={range === r || undefined}
              onClick={() => setRange(r)}
            >
              {t(`kb.analytics.range.${r}`)}
            </button>
          ))}
        </div>
      </header>

      {snapshot.isPending ? (
        <p className="sdm-kb-analytics-state" data-testid="kb-analytics-loading">
          {t("kb.analytics.loading")}
        </p>
      ) : snapshot.isError ? (
        <p
          role="alert"
          className="sdm-kb-analytics-state sdm-kb-analytics-state--error"
          data-testid="kb-analytics-error"
        >
          {t("kb.analytics.error")}
        </p>
      ) : (
        <div className="sdm-kb-analytics-grid">
          <section className="sdm-kb-analytics-card" data-testid="kb-analytics-top">
            <h2>{t("kb.analytics.top.title")}</h2>
            <ol>
              {snapshot.data!.top.map((row) => (
                <li key={row.id} data-row-id={row.id}>
                  <span className="sdm-kb-analytics-row-title">{row.title}</span>
                  <span className="sdm-kb-analytics-row-meta">
                    {t("kb.analytics.top.views", { views: row.views })}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="sdm-kb-analytics-card" data-testid="kb-analytics-bottom">
            <h2>{t("kb.analytics.bottom.title")}</h2>
            <ol>
              {snapshot.data!.bottom.map((row) => (
                <li key={row.id} data-row-id={row.id}>
                  <span className="sdm-kb-analytics-row-title">{row.title}</span>
                  <span className="sdm-kb-analytics-row-meta">
                    {row.helpfulnessRatio !== null
                      ? t("kb.analytics.bottom.ratio", {
                          ratio: Math.round(row.helpfulnessRatio * 100),
                        })
                      : t("kb.analytics.bottom.noData")}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="sdm-kb-analytics-card" data-testid="kb-analytics-search-miss">
            <h2>{t("kb.analytics.searchMiss.title")}</h2>
            <ol>
              {snapshot.data!.searchMiss.map((row) => (
                <li key={row.query}>
                  <span className="sdm-kb-analytics-row-title">{row.query}</span>
                  <span className="sdm-kb-analytics-row-meta">
                    {t("kb.analytics.searchMiss.hits", { hits: row.hits })}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </section>
  );
}
