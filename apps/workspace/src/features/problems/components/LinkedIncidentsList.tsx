import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@sdm/i18n";
import { Button, StatusBadge, type TicketStatus } from "@sdm/design-system";
import type { IncidentStatus } from "@sdm/domain";
import { linkedIncidentsQuery, type ProblemId } from "../api";
import { useUnlinkIncident } from "../hooks";
import { LinkIncidentModal } from "./LinkIncidentModal";

const INCIDENT_STATUS_MAP: Record<IncidentStatus, TicketStatus> = {
  OP: "open",
  WIP: "in_progress",
  HLD: "pending",
  AWU: "pending",
  AWV: "pending",
  ESC: "in_progress",
  RES: "resolved",
  CL: "closed",
  CD: "closed",
};

/**
 * LinkedIncidentsList — renders the incidents currently linked to this problem
 * + the "Link incident" action that opens the multi-select modal.
 *
 * H.12.md §Done-when MVP: per F.6 §24 BREL doesn't work on this CA SDM
 * instance, so a real BFF mutation needs a WC-query rewrite. We ship the FE
 * flow against MSW today (round-trip proven by the H.12 browser test) and
 * defer the BFF endpoint to a Phase I follow-up. Until the BFF is wired, the
 * empty state surfaces the "feature available after B-E customization" hint
 * so non-MSW environments don't look broken.
 */
export interface LinkedIncidentsListProps {
  readonly problemId: ProblemId;
}

export function LinkedIncidentsList({ problemId }: LinkedIncidentsListProps) {
  const { t } = useTranslation("workspace");
  const [linkOpen, setLinkOpen] = useState(false);
  const unlink = useUnlinkIncident(problemId);

  const query = useQuery(linkedIncidentsQuery(problemId));
  const incidents = query.data ?? [];

  return (
    <section
      className="sdm-problem-linked sdm-problem-section"
      data-testid="problem-linked-incidents"
      aria-label={t("problems.linkedIncidents.ariaLabel")}
    >
      <div className="sdm-problem-linked-header">
        <h2 className="sdm-problem-section-title">
          {t("problems.linkedIncidents.title")}
          {incidents.length > 0 ? (
            <>
              {" — "}
              {t("problems.linkedIncidents.count", { count: incidents.length })}
            </>
          ) : null}
        </h2>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setLinkOpen(true)}
          data-testid="problem-link-incident-open"
        >
          {t("problems.linkedIncidents.linkButton")}
        </Button>
      </div>

      {incidents.length === 0 ? (
        <p className="sdm-problem-linked-empty" data-testid="problem-linked-empty">
          {t("problems.linkedIncidents.empty")}
          <span className="sdm-problem-linked-empty-hint">
            {t("problems.linkedIncidents.unsupportedHint")}
          </span>
        </p>
      ) : (
        <ul className="sdm-problem-linked-list">
          {incidents.map((i) => (
            <li
              key={i.id}
              className="sdm-problem-linked-item"
              data-testid="problem-linked-row"
              data-incident-id={i.id}
            >
              <span className="sdm-problem-linked-ref">#{i.ref}</span>
              <StatusBadge
                status={INCIDENT_STATUS_MAP[i.status] ?? "open"}
                label={t(`ticketDetail.statusLabel.${i.status}` as const)}
              />
              <Link
                to={`/tickets/${encodeURIComponent(i.id)}`}
                className="sdm-problem-linked-summary"
              >
                {i.summary}
              </Link>
              <Button
                variant="tertiary"
                size="sm"
                onClick={() => unlink.mutate(i.id)}
                loading={unlink.isPending}
                data-testid="problem-linked-unlink"
              >
                {t("problems.linkedIncidents.unlinkButton")}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {linkOpen ? (
        <LinkIncidentModal
          problemId={problemId}
          alreadyLinkedIds={incidents.map((i) => i.id)}
          onClose={() => setLinkOpen(false)}
        />
      ) : null}
    </section>
  );
}
