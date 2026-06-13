import { useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@sdm/i18n";
import type { ProblemId } from "@sdm/domain";
import { Card, Skeleton, usePageTransition } from "@sdm/design-system";
import { problemDetailQuery } from "./api";
import { ActivityTimeline } from "./components/ActivityTimeline";
import { LinkedIncidentsList } from "./components/LinkedIncidentsList";
import { ProblemBody } from "./components/ProblemBody";
import { ProblemHeader } from "./components/ProblemHeader";
import "./problems.css";

/**
 * `/problems/:id` — K.3.E redesign:
 *
 * - Tabs at the top scope which sub-section gets the "loud" treatment, but
 *   every section (description / RCA / linked incidents / activity) stays
 *   mounted underneath so the existing H.12 + journey-07 browser tests can
 *   still assert visibility of all sub-test-ids in one go.
 * - Sub-cards: header, RCA (description + root cause), linked incidents,
 *   workarounds, activity. Each wrapped in a `<Card>` to inherit DS tokens.
 * - `usePageTransition` runs the K.1 crossfade.
 */
type Tab = "overview" | "linked" | "activity";

const TABS: ReadonlyArray<Tab> = ["overview", "linked", "activity"];

export default function ProblemDetailRoute() {
  const { t } = useTranslation("workspace");
  const params = useParams();
  const id = params["id"] ?? "";
  const location = useLocation();
  const { ref: pageRef } = usePageTransition(location.pathname);
  const [tab, setTab] = useState<Tab>("overview");

  const detailQuery = useQuery({
    ...problemDetailQuery(id),
    enabled: id.length > 0,
  });

  if (detailQuery.isPending) {
    return (
      <section
        className="sdm-problem-detail-page"
        data-testid="problem-detail-loading"
        ref={pageRef as React.RefObject<HTMLElement>}
      >
        <Card variant="surface" className="sdm-problem-skeleton">
          <Skeleton variant="text" width="50%" height={24} />
          <Skeleton variant="text" width="100%" height={14} count={3} />
          <Skeleton variant="block" width="100%" height={140} />
        </Card>
      </section>
    );
  }
  if (detailQuery.isError || !detailQuery.data) {
    return (
      <section
        className="sdm-problem-detail-page"
        data-testid="problem-detail-error"
        role="alert"
        ref={pageRef as React.RefObject<HTMLElement>}
      >
        <p className="sdm-problems-state sdm-problems-state--error">{t("problems.error")}</p>
      </section>
    );
  }

  const detail = detailQuery.data;
  const problemId = detail.id as ProblemId;

  return (
    <section
      className="sdm-problem-detail-page"
      data-testid="problem-detail-page"
      data-problem-id={detail.id}
      ref={pageRef as React.RefObject<HTMLElement>}
    >
      <Card variant="surface" className="sdm-problem-detail-header-card">
        <ProblemHeader detail={detail} />
      </Card>

      <nav className="sdm-problem-detail-tabs" aria-label={t("problems.tabs.ariaLabel")}>
        {TABS.map((id) => (
          <a
            key={id}
            href={`#problem-section-${id}`}
            id={`problem-tab-${id}`}
            aria-current={tab === id ? "page" : undefined}
            data-active={tab === id || undefined}
            data-testid={`problem-tab-${id}`}
            className="sdm-problem-detail-tab"
            onClick={(e) => {
              e.preventDefault();
              setTab(id);
              document
                .getElementById(`problem-section-${id}`)
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            {t(`problems.tabs.${id}`)}
          </a>
        ))}
      </nav>

      <Card
        variant="surface"
        className="sdm-problem-detail-card"
        id="problem-section-overview"
        data-section="overview"
      >
        <ProblemBody detail={detail} />
        <section className="sdm-problem-section" data-testid="problem-workarounds">
          <h2 className="sdm-problem-section-title">{t("problems.sections.workarounds")}</h2>
          <p className="sdm-problem-body-empty">{t("problems.sections.workaroundsEmpty")}</p>
        </section>
      </Card>

      <Card
        variant="surface"
        className="sdm-problem-detail-card"
        id="problem-section-linked"
        data-section="linked"
      >
        <LinkedIncidentsList problemId={problemId} />
      </Card>

      <Card
        variant="surface"
        className="sdm-problem-detail-card"
        id="problem-section-activity"
        data-section="activity"
      >
        <ActivityTimeline problemId={detail.id} />
      </Card>
    </section>
  );
}
