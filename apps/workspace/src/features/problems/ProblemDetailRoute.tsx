import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@sdm/i18n";
import type { ProblemId } from "@sdm/domain";
import { problemDetailQuery } from "./api";
import { ActivityTimeline } from "./components/ActivityTimeline";
import { LinkedIncidentsList } from "./components/LinkedIncidentsList";
import { ProblemBody } from "./components/ProblemBody";
import { ProblemHeader } from "./components/ProblemHeader";
import "./problems.css";

/**
 * `/problems/:id` — full RCA workspace for Marek. Single-column layout
 * (header → body → linked incidents → activity timeline). No split-pane
 * because the LinkedIncidentsList itself acts as the navigation surface to
 * deep-dive an incident, and the activity timeline benefits from full width.
 */
export default function ProblemDetailRoute() {
  const { t } = useTranslation("workspace");
  const params = useParams();
  const id = params["id"] ?? "";

  const detailQuery = useQuery({
    ...problemDetailQuery(id),
    enabled: id.length > 0,
  });

  if (detailQuery.isPending) {
    return (
      <section className="sdm-problem-detail-page" data-testid="problem-detail-loading">
        <p className="sdm-problems-state">{t("problems.loading")}</p>
      </section>
    );
  }
  if (detailQuery.isError || !detailQuery.data) {
    return (
      <section className="sdm-problem-detail-page" data-testid="problem-detail-error" role="alert">
        <p className="sdm-problems-state sdm-problems-state--error">{t("problems.error")}</p>
      </section>
    );
  }

  const detail = detailQuery.data;

  return (
    <section
      className="sdm-problem-detail-page"
      data-testid="problem-detail-page"
      data-problem-id={detail.id}
    >
      <ProblemHeader detail={detail} />
      <ProblemBody detail={detail} />
      <LinkedIncidentsList problemId={detail.id as ProblemId} />
      <ActivityTimeline problemId={detail.id} />
    </section>
  );
}
