import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@sdm/i18n";
import { Button, StatusBadge, staggerListRows, type TicketStatus } from "@sdm/design-system";
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
 * LinkedIncidentsList — K.3.E polish.
 *
 * - Rows render as Card-style flex rows (still a `<ul>` so SR semantics hold)
 *   with `data-row` so `staggerListRows` from the design-system runs on
 *   mount + when the linked count changes.
 * - `StatusBadge withIcon` brings the lucide glyph into the row to match the
 *   queue/problems table treatment.
 * - The `linked-incidents-list` / `problem-linked-row` / `problem-link-...`
 *   test-ids are preserved for the J.4 browser test that asserts the link/
 *   unlink flow end-to-end.
 */
export interface LinkedIncidentsListProps {
  readonly problemId: ProblemId;
}

export function LinkedIncidentsList({ problemId }: LinkedIncidentsListProps) {
  const { t } = useTranslation("workspace");
  const [linkOpen, setLinkOpen] = useState(false);
  const unlink = useUnlinkIncident(problemId);
  const listRef = useRef<HTMLUListElement | null>(null);

  const query = useQuery(linkedIncidentsQuery(problemId));
  const incidents = query.data ?? [];

  useEffect(() => {
    staggerListRows(listRef.current);
  }, [incidents.length]);

  return (
    <section
      className="sdm-problem-linked sdm-problem-section"
      data-testid="problem-linked-incidents"
      data-component="linked-incidents-list"
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
        <p className="sdm-problem-linked-empty" data-testid="problem-linked-empty" role="status">
          {t("problems.linkedIncidents.empty")}
          <span className="sdm-problem-linked-empty-hint">
            {t("problems.linkedIncidents.unsupportedHint")}
          </span>
        </p>
      ) : (
        <ul className="sdm-problem-linked-list" ref={listRef}>
          {incidents.map((i) => (
            <li
              key={i.id}
              className="sdm-problem-linked-item"
              data-row
              data-row-id={i.id}
              data-testid="problem-linked-row"
              data-incident-id={i.id}
            >
              <span className="sdm-problem-linked-ref sdm-tabular">#{i.ref}</span>
              <StatusBadge
                status={INCIDENT_STATUS_MAP[i.status] ?? "open"}
                label={t(`ticketDetail.statusLabel.${i.status}` as const)}
                withIcon
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
