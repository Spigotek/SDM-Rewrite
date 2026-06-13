import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "@sdm/i18n";
import {
  CA_SDM_TRANSITIONS,
  StatusBadge,
  Toast,
  ToastViewport,
  type TicketStatus,
} from "@sdm/design-system";
import type { ProblemDetail } from "../types";
import { usePatchProblem } from "../hooks";

const STATUS_MAP: Record<string, TicketStatus> = {
  IDENTIFIED: "new",
  INVESTIGATION: "in_progress",
  ROOT_CAUSE_KNOWN: "in_progress",
  KNOWN_ERROR: "open",
  RESOLVED: "resolved",
  CL: "closed",
  CD: "closed",
};

/**
 * Reverse map: design-system `TicketStatus` → CA SDM problem status code. Only
 * the canonical "next" codes are listed — the lozenge menu filters to whatever
 * the documented lifecycle map supports for the current state.
 */
const REVERSE_STATUS_MAP: Partial<Record<TicketStatus, string>> = {
  new: "IDENTIFIED",
  in_progress: "INVESTIGATION",
  open: "KNOWN_ERROR",
  resolved: "RESOLVED",
  closed: "CL",
};

function formatDate(iso: string | null | undefined, locale?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Detail-header for `/problems/:id` — K.3.E polish. The ref is now rendered
 * in the `--font-size-2xl` mono treatment per K.1 brief §10.2, with the
 * summary as the H1 below. Meta grid keeps the 4-up shape but pulls
 * `StatusBadge withIcon` and `sdm-tabular` to align with the queue/changes
 * surfaces.
 */
export function ProblemHeader({ detail }: { readonly detail: ProblemDetail }) {
  const { t, i18n } = useTranslation("workspace");
  const patch = usePatchProblem(detail.id);

  const mapped = STATUS_MAP[detail.status] ?? "open";
  const allowed = useMemo<ReadonlyArray<TicketStatus>>(
    () => (CA_SDM_TRANSITIONS[mapped] ?? []).filter((s) => REVERSE_STATUS_MAP[s] !== undefined),
    [mapped],
  );

  const [toasts, setToasts] = useState<
    ReadonlyArray<{
      readonly id: string;
      readonly intent: "success" | "info" | "danger";
      readonly title: string;
    }>
  >([]);
  const pushToast = useCallback((intent: "success" | "info" | "danger", title: string) => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, intent, title }]);
    setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 5000);
  }, []);
  const dismissToast = useCallback(
    (id: string) => setToasts((prev) => prev.filter((toast) => toast.id !== id)),
    [],
  );

  const onStatusTransition = (next: TicketStatus) => {
    const code = REVERSE_STATUS_MAP[next];
    if (!code) {
      pushToast("info", t("status.transition.unsupported"));
      return;
    }
    const label = t(`problems.statusLabel.${code}` as const, { defaultValue: code });
    patch.mutate(
      { statusCode: code },
      {
        onSuccess: () => pushToast("success", t("status.transition.success", { label })),
        onError: (err) => {
          // L.1.C — Problem status PATCH isn't wired in the BFF yet (the F.2
          // entity registrar only exposes GET/PUT/DELETE). The FE wires the
          // mutation anyway so backend catch-up in v1.4 doesn't need a FE PR.
          console.warn("[ProblemHeader] status transition rejected — backend not wired", err);
          pushToast("info", t("status.transition.unsupported"));
        },
      },
    );
  };

  return (
    <header className="sdm-problem-header" data-testid="problem-header">
      <div className="sdm-problem-header-title">
        <span className="sdm-problem-header-ref sdm-tabular">#{detail.ref}</span>
        <h1 className="sdm-problem-header-summary">{detail.summary || t("problems.noSummary")}</h1>
        {detail.isMajor ? (
          <span className="sdm-problem-header-major" data-testid="problem-header-major">
            {t("problems.fields.isMajor")}
          </span>
        ) : null}
      </div>
      <div className="sdm-problem-header-meta">
        <div className="sdm-problem-header-field">
          <span className="sdm-problem-header-label">{t("problems.fields.status")}</span>
          <StatusBadge
            status={mapped}
            label={t(`problems.statusLabel.${detail.status}` as const)}
            withIcon
            transitionable
            disabled={patch.isPending}
            menuLabel={t("status.transition.menuLabel")}
            allowedTransitions={allowed}
            onTransition={onStatusTransition}
            data-testid="problem-header-status-badge"
          />
        </div>
        <div className="sdm-problem-header-field">
          <span className="sdm-problem-header-label">{t("problems.fields.assignee")}</span>
          <span className="sdm-problem-header-value" data-testid="problem-header-assignee">
            {detail.assigneeId ?? t("problems.fields.unassigned")}
          </span>
        </div>
        <div className="sdm-problem-header-field">
          <span className="sdm-problem-header-label">{t("problems.fields.openedAt")}</span>
          <span className="sdm-problem-header-value sdm-tabular">
            {formatDate(detail.openedAt, i18n.language)}
          </span>
        </div>
        <div className="sdm-problem-header-field">
          <span className="sdm-problem-header-label">{t("problems.fields.resolvedAt")}</span>
          <span className="sdm-problem-header-value sdm-tabular">
            {formatDate(detail.resolvedAt, i18n.language)}
          </span>
        </div>
      </div>
      <ToastViewport>
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            id={toast.id}
            intent={toast.intent}
            title={toast.title}
            onDismiss={() => dismissToast(toast.id)}
          />
        ))}
      </ToastViewport>
    </header>
  );
}
