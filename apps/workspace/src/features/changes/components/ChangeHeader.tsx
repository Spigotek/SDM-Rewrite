import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "@sdm/i18n";
import {
  CA_SDM_TRANSITIONS,
  PriorityBadge,
  StatusBadge,
  Toast,
  ToastViewport,
  type Severity,
  type TicketStatus,
} from "@sdm/design-system";
import type { ChangeDetail } from "../types";
import { usePatchChangeStatus } from "../hooks";

/**
 * Change-detail header — mirrors wireframe `03-change-calendar.md §Change
 * detail s approvals`. Top row: ref + summary; below it a two-line meta grid
 * with status / risk / category / schedule window. No action bar (CAB
 * approve / reject lives in H.11 ApprovalsTab footer).
 */

const STATUS_MAP: Record<string, TicketStatus> = {
  RFC: "new",
  APPR_PENDING: "pending",
  APPROVED: "open",
  SCHEDULED: "open",
  IN_PROGRESS: "in_progress",
  VERIFICATION_IN_PROGRESS: "in_progress",
  VERIFIED: "resolved",
  REJECTED: "closed",
  CL: "closed",
  CD: "closed",
  EMG_RFC: "pending",
  EMG_IN_PROGRESS: "in_progress",
  EMG_RETROSPECTIVE: "pending",
};

/**
 * Reverse map: DS `TicketStatus` → CA SDM change status code. Only the
 * canonical "next" codes are listed (e.g. `pending` resolves to
 * `APPR_PENDING`, not `EMG_RFC`).
 */
const REVERSE_STATUS_MAP: Partial<Record<TicketStatus, string>> = {
  new: "RFC",
  pending: "APPR_PENDING",
  open: "APPROVED",
  scheduled: "SCHEDULED",
  in_progress: "IN_PROGRESS",
  resolved: "VERIFIED",
  closed: "CL",
  cancelled: "CD",
  rejected: "REJECTED",
};

const RISK_SEVERITY: Record<string, Severity> = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
};

function formatDateRange(startIso: string | null, endIso: string | null): string {
  if (!startIso) return "—";
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return "—";
  const startStr = start.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  if (!endIso) return startStr;
  const end = new Date(endIso);
  if (Number.isNaN(end.getTime())) return startStr;
  const endStr = end.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${startStr} – ${endStr}`;
}

export function ChangeHeader({ detail }: { readonly detail: ChangeDetail }) {
  const { t } = useTranslation("workspace");
  const patch = usePatchChangeStatus(detail.id);

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
    const label = t(`changes.statusLabel.${code}` as const, { defaultValue: code });
    patch.mutate(code, {
      onSuccess: () => pushToast("success", t("status.transition.success", { label })),
      onError: (err) => {
        // L.1.C — Change status-only PATCH isn't wired in the BFF yet (only
        // J.6 schedule PATCH lives at `/api/changes/:id/schedule`). The FE
        // wires the mutation anyway so v1.4 can add the backend endpoint
        // without a FE PR.
        console.warn("[ChangeHeader] status transition rejected — backend not wired", err);
        pushToast("info", t("status.transition.unsupported"));
      },
    });
  };

  return (
    <header className="sdm-change-header" data-testid="change-header">
      <div className="sdm-change-header-title">
        <span className="sdm-change-header-ref">#{detail.ref}</span>
        <h1 className="sdm-change-header-summary">{detail.summary || t("changes.noSummary")}</h1>
      </div>
      <div className="sdm-change-header-meta">
        <div className="sdm-change-header-field">
          <span className="sdm-change-header-label">{t("changes.fields.status")}</span>
          <StatusBadge
            status={mapped}
            label={t(`changes.statusLabel.${detail.status}`)}
            withIcon
            transitionable
            disabled={patch.isPending}
            menuLabel={t("status.transition.menuLabel")}
            allowedTransitions={allowed}
            onTransition={onStatusTransition}
            data-testid="change-header-status-badge"
          />
        </div>
        <div className="sdm-change-header-field">
          <span className="sdm-change-header-label">{t("changes.fields.risk")}</span>
          <PriorityBadge
            severity={RISK_SEVERITY[detail.risk] ?? "low"}
            label={t(`changes.risk.${detail.risk}`)}
          />
        </div>
        <div className="sdm-change-header-field">
          <span className="sdm-change-header-label">{t("changes.fields.category")}</span>
          <span data-testid="change-header-category" data-category={detail.category}>
            {t(`changes.category.${detail.category}`)}
          </span>
        </div>
        <div className="sdm-change-header-field">
          <span className="sdm-change-header-label">{t("changes.fields.schedule")}</span>
          <span data-testid="change-header-schedule">
            {formatDateRange(detail.scheduledStartAt, detail.scheduledEndAt)}
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
