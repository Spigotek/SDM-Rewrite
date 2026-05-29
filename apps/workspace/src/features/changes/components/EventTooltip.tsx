import { createPortal } from "react-dom";
import { useTranslation } from "@sdm/i18n";
import type { ChangeRow } from "../types";

/**
 * Floating event tooltip — rendered via portal so it can escape the
 * FullCalendar event cell overflow.
 *
 * The position prop is the anchor's bounding-rect origin (page coordinates).
 * Render-side: the tooltip places itself above the anchor with a small gap;
 * if it would clip the viewport top, it flips below.
 *
 * We deliberately keep this lightweight — Radix Tooltip would force an extra
 * cost on the calendar lazy chunk and FullCalendar already gives us robust
 * mount/unmount hooks for the anchor element.
 */
export interface EventTooltipProps {
  readonly row: ChangeRow;
  readonly anchor: DOMRect;
}

function formatRange(start: string | null, end: string | null): string {
  if (!start) return "—";
  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return "—";
  const dateLabel = startDate.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const startTime = startDate.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (!end) return `${dateLabel} · ${startTime}`;
  const endDate = new Date(end);
  if (Number.isNaN(endDate.getTime())) return `${dateLabel} · ${startTime}`;
  const endTime = endDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${dateLabel} · ${startTime}–${endTime}`;
}

export function EventTooltip({ row, anchor }: EventTooltipProps) {
  const { t } = useTranslation("workspace");
  const margin = 8;
  const tooltipMaxWidth = 280;
  const viewportWidth = window.innerWidth;
  const flipBelow = anchor.top < 120;
  const top = flipBelow ? anchor.bottom + margin : anchor.top - margin;
  // Center horizontally over the anchor, clamped to the viewport.
  const anchorCenter = anchor.left + anchor.width / 2;
  const left = Math.max(
    margin,
    Math.min(anchorCenter - tooltipMaxWidth / 2, viewportWidth - tooltipMaxWidth - margin),
  );

  const style: React.CSSProperties = {
    position: "fixed",
    top,
    left,
    transform: flipBelow ? "translateY(0)" : "translateY(-100%)",
    maxWidth: tooltipMaxWidth,
    zIndex: 9999,
  };

  return createPortal(
    <div
      role="tooltip"
      className="sdm-calendar-tooltip"
      data-testid="calendar-event-tooltip"
      style={style}
    >
      <header className="sdm-calendar-tooltip-header">
        <span className="sdm-calendar-tooltip-ref">#{row.ref}</span>
        <span className="sdm-calendar-tooltip-risk" data-risk={row.risk}>
          {t(`changes.risk.${row.risk}`)}
        </span>
      </header>
      <p className="sdm-calendar-tooltip-summary">{row.summary || t("changes.noSummary")}</p>
      <dl className="sdm-calendar-tooltip-meta">
        <div>
          <dt>{t("changes.fields.schedule")}</dt>
          <dd>{formatRange(row.scheduledStartAt, row.scheduledEndAt)}</dd>
        </div>
        <div>
          <dt>{t("changes.fields.status")}</dt>
          <dd>{t(`changes.statusLabel.${row.status}`)}</dd>
        </div>
      </dl>
    </div>,
    document.body,
  );
}
