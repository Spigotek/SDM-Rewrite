import { useMemo } from "react";
import { useLocation, useParams, type LoaderFunctionArgs } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, Skeleton, usePageTransition } from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";
import type { UiTicketType } from "@sdm/api-types";
import { queryClient } from "../../lib/query-client";
import { NotFoundElement, ForbiddenElement } from "../../routes/error-boundaries";
import { ticketDetailQuery } from "./api";
import { TicketHeader } from "./components/TicketHeader";
import { TicketBody } from "./components/TicketBody";
import { ActivityTimeline } from "./components/ActivityTimeline";
import { AttachmentsList } from "./components/AttachmentsList";
import { PublicComposer } from "./components/PublicComposer";
import type { ParsedTicketParam, PortalTicketType } from "./types";
import "./ticket-detail.css";

const TYPE_VALUES: ReadonlyArray<UiTicketType> = ["incident", "request", "problem", "change"];

/**
 * Resolve the route param to `(type, id)`.
 *
 * The portal uses a single `/tickets/:id` route. We accept two ID shapes:
 *
 *  1. **Prefixed entity ID** — `incident:10000`, `request:20012`, ...
 *     This is what `MyRecentTickets` (H.2) emits and what the BFF /
 *     MSW store uses internally.
 *  2. **Reference number** — `IN-00001`, `REQ-00001`, `PR-00001`,
 *     `CHG-00001`. Per H.4 §Open questions the portal accepts ref
 *     prefixes too for human-friendly URLs.
 *
 * Anything else returns `null` so the route renders `NotFoundElement`.
 */
export function parseTicketParam(raw: string): ParsedTicketParam | null {
  if (!raw) return null;

  const colon = raw.indexOf(":");
  if (colon > 0) {
    const prefix = raw.slice(0, colon);
    if ((TYPE_VALUES as ReadonlyArray<string>).includes(prefix)) {
      return { type: prefix as PortalTicketType, id: raw };
    }
    return null;
  }

  // Ref-based shorthand: IN-* / REQ-* / PR-* / CHG-*.
  if (/^IN-/i.test(raw)) return { type: "incident", id: raw };
  if (/^REQ-/i.test(raw)) return { type: "request", id: raw };
  if (/^PR-/i.test(raw)) return { type: "problem", id: raw };
  if (/^CHG-/i.test(raw)) return { type: "change", id: raw };
  // Bare numeric ID — default to `incident`. The portal home lists tickets
  // from `/api/incidents`, and the live BFF (talking to real CA SDM 17.4)
  // returns raw numeric IDs, not the prefixed shape the MSW fixtures use.
  // Without this branch the home → detail click 404s in live mode (the
  // J.0 staging smoke 2026-06-12 hit this on the first user click).
  if (/^\d+$/.test(raw)) return { type: "incident", id: raw };
  return null;
}

function DetailSkeleton() {
  return (
    <div className="sdm-portal-ticket-skeleton" aria-hidden="true">
      <Skeleton variant="text" width="6ch" height={14} />
      <Skeleton variant="text" width="65%" height={28} />
      <Skeleton variant="text" width="40%" height={14} />
      <Skeleton variant="text" width="100%" height={14} count={5} />
    </div>
  );
}

export function TicketDetailRoute() {
  const { t } = useTranslation("portal");
  const params = useParams();
  const rawId = params["id"] ?? "";
  const parsed = useMemo(() => parseTicketParam(rawId), [rawId]);
  const location = useLocation();
  const { ref: pageRef } = usePageTransition(location.pathname);

  const detailQuery = useQuery({
    ...ticketDetailQuery(parsed?.type ?? "incident", parsed?.id ?? ""),
    enabled: parsed !== null,
  });

  if (parsed === null) {
    return <NotFoundElement />;
  }

  if (detailQuery.isPending) {
    return (
      <section
        ref={pageRef}
        className="sdm-portal-ticket-detail"
        data-testid="portal-ticket-detail-loading"
      >
        <Card variant="surface" className="sdm-portal-ticket-card">
          <DetailSkeleton />
        </Card>
      </section>
    );
  }

  if (detailQuery.isError) {
    const status = (detailQuery.error as { status?: number } | null)?.status;
    if (status === 404) return <NotFoundElement />;
    if (status === 403) return <ForbiddenElement />;
    return (
      <section
        ref={pageRef}
        className="sdm-portal-ticket-detail"
        data-testid="portal-ticket-detail-error"
        role="alert"
      >
        <p className="sdm-portal-ticket-state sdm-portal-ticket-state--error">
          {t("ticketDetail.error")}
        </p>
      </section>
    );
  }

  const detail = detailQuery.data;
  if (!detail) {
    return <NotFoundElement />;
  }

  const closed =
    detail.status?.code === "CL" || detail.status?.code === "CD" || detail.closedAt !== null;

  return (
    <section
      ref={pageRef}
      className="sdm-portal-ticket-detail"
      data-testid="portal-ticket-detail"
      data-ticket-type={detail.ticketType}
      data-ticket-id={detail.id}
    >
      <Card variant="surface" className="sdm-portal-ticket-card sdm-portal-ticket-card--header">
        <TicketHeader detail={detail} />
      </Card>
      <Card variant="surface" className="sdm-portal-ticket-card">
        <TicketBody description={detail.description} />
      </Card>
      <Card variant="surface" className="sdm-portal-ticket-card">
        <ActivityTimeline activity={detail.activity} />
      </Card>
      {detail.attachments.items.length > 0 || detail.attachments._unsupported ? (
        <Card variant="surface" className="sdm-portal-ticket-card">
          <AttachmentsList attachments={detail.attachments} />
        </Card>
      ) : null}
      <Card variant="surface" className="sdm-portal-ticket-card">
        <PublicComposer ticketType={detail.ticketType} ticketId={detail.id} closed={closed} />
      </Card>
    </section>
  );
}

/**
 * Loader prefetches the ticket detail so the first render after navigation
 * is hot-cache. If the URL parses but the BFF returns 404 / 403, the
 * component-level path renders the appropriate error element — we keep the
 * loader resolve-only so React Router's `errorElement` isn't hit unnecessarily.
 */
export async function ticketDetailLoader({ params }: LoaderFunctionArgs): Promise<null> {
  const raw = String(params["id"] ?? "");
  const parsed = parseTicketParam(raw);
  if (!parsed) return null;
  try {
    await queryClient.ensureQueryData(ticketDetailQuery(parsed.type, parsed.id));
  } catch {
    // Component path handles error states — swallow so the route still mounts.
  }
  return null;
}

export default TicketDetailRoute;
