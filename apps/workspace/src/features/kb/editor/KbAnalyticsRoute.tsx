import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@sdm/i18n";
import { tenantId as toTenantId } from "@sdm/domain";
import { Card, Skeleton, staggerListRows, usePageTransition } from "@sdm/design-system";
import { useSession } from "../../../shell/session-context";
import { kbAnalyticsQuery } from "./api";
import "../kb.css";
import "./editor.css";

/**
 * `/kb/analytics` — K.3.E polish.
 *
 * Three Card-wrapped panels (Top views / Bottom helpfulness / Search misses)
 * with `tabular-nums` on every numeric column, `staggerListRows` on list
 * mounts, and `usePageTransition` on route mount. Skeleton during load.
 */
const TENANT_PLACEHOLDER = toTenantId("__pending__");

type Range = "7d" | "30d" | "90d";

export default function KbAnalyticsRoute() {
  const { t } = useTranslation("workspace");
  const location = useLocation();
  const { session } = useSession();
  const tenantId = session?.tenantId ?? TENANT_PLACEHOLDER;
  const [range, setRange] = useState<Range>("30d");
  const { ref: pageRef } = usePageTransition(location.pathname);

  const snapshot = useQuery({
    ...kbAnalyticsQuery(tenantId, range),
    enabled: session !== null,
  });

  const topRef = useRef<HTMLOListElement | null>(null);
  const bottomRef = useRef<HTMLOListElement | null>(null);
  const missRef = useRef<HTMLOListElement | null>(null);

  useEffect(() => {
    if (!snapshot.data) return;
    staggerListRows(topRef.current);
    staggerListRows(bottomRef.current);
    staggerListRows(missRef.current);
  }, [snapshot.data, range]);

  return (
    <section
      className="sdm-kb-analytics-page"
      data-testid="workspace-kb-analytics"
      ref={pageRef as React.RefObject<HTMLElement>}
    >
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
              aria-current={range === r ? "true" : undefined}
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
        <div className="sdm-kb-analytics-grid" data-testid="kb-analytics-loading">
          {[0, 1, 2].map((i) => (
            <Card key={i} variant="surface" className="sdm-kb-analytics-card">
              <Skeleton variant="text" width="40%" height={18} />
              <Skeleton variant="text" width="100%" height={12} count={5} />
            </Card>
          ))}
        </div>
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
          <Card variant="surface" className="sdm-kb-analytics-card" data-testid="kb-analytics-top">
            <h2>{t("kb.analytics.top.title")}</h2>
            <ol ref={topRef}>
              {snapshot.data!.top.map((row) => (
                <li key={row.id} data-row data-row-id={row.id}>
                  <span className="sdm-kb-analytics-row-title">{row.title}</span>
                  <span className="sdm-kb-analytics-row-meta sdm-tabular">
                    {t("kb.analytics.top.views", { views: row.views })}
                  </span>
                </li>
              ))}
            </ol>
          </Card>

          <Card
            variant="surface"
            className="sdm-kb-analytics-card"
            data-testid="kb-analytics-bottom"
          >
            <h2>{t("kb.analytics.bottom.title")}</h2>
            <ol ref={bottomRef}>
              {snapshot.data!.bottom.map((row) => (
                <li key={row.id} data-row data-row-id={row.id}>
                  <span className="sdm-kb-analytics-row-title">{row.title}</span>
                  <span className="sdm-kb-analytics-row-meta sdm-tabular">
                    {row.helpfulnessRatio !== null
                      ? t("kb.analytics.bottom.ratio", {
                          ratio: Math.round(row.helpfulnessRatio * 100),
                        })
                      : t("kb.analytics.bottom.noData")}
                  </span>
                </li>
              ))}
            </ol>
          </Card>

          <Card
            variant="surface"
            className="sdm-kb-analytics-card"
            data-testid="kb-analytics-search-miss"
          >
            <h2>{t("kb.analytics.searchMiss.title")}</h2>
            <ol ref={missRef}>
              {snapshot.data!.searchMiss.map((row) => (
                <li key={row.query} data-row>
                  <span className="sdm-kb-analytics-row-title">{row.query}</span>
                  <span className="sdm-kb-analytics-row-meta sdm-tabular">
                    {t("kb.analytics.searchMiss.hits", { hits: row.hits })}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      )}
    </section>
  );
}
