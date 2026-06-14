import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useTranslation } from "@sdm/i18n";
import { IconButton, slideInPanel } from "@sdm/design-system";
import type { UiQueueItem } from "@sdm/api-types";
import { QueueDetailPane } from "./QueueDetailPane";

/**
 * Right-side detail drawer for `/queue` (Phase M.2.B — replaces the permanent
 * H.7/M.1.A split-pane column).
 *
 * Owner feedback: the permanent right column wasted horizontal space. The
 * detail now slides in over the content only when a row is selected, so the
 * list spans full width by default while preserving the "detail of the
 * selected row" spatial metaphor.
 *
 * - 480px panel pinned to the right, with a dimmed backdrop.
 * - ESC and backdrop-click close (clearing `?selected=`).
 * - Focus trap: focus moves to the close button on open and cycles inside the
 *   panel; closing restores focus to the previously-focused element.
 * - GSAP slide-in (panel translateX + backdrop opacity) honouring
 *   `prefers-reduced-motion: reduce`, which short-circuits to no animation.
 *
 * The drawer hosts the existing `QueueDetailPane` body verbatim — same query,
 * cache, tabs, and "Otvoriť plný detail" CTA.
 */

export interface QueueDetailDrawerProps {
  readonly row: UiQueueItem | null;
  readonly open: boolean;
  readonly onClose: () => void;
}

export function QueueDetailDrawer({ row, open, onClose }: QueueDetailDrawerProps) {
  const { t } = useTranslation("workspace");
  const panelRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Slide-in on open via the DS motion helper (keeps gsap confined to
  // `@sdm/design-system`). Closing unmounts the node, so there is no slide-out
  // tween — the unmount is instantaneous, which keeps the close path simple and
  // avoids a dangling tween writing to a detached node.
  useEffect(() => {
    if (!open) return;
    return slideInPanel({ panel: panelRef.current, backdrop: backdropRef.current });
  }, [open]);

  // Focus management: capture the active element on open, move focus into the
  // panel, restore on close.
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    return () => {
      restoreFocusRef.current?.focus?.();
    };
  }, [open]);

  // ESC to close + focus trap (Tab cycles within the panel). Attached to the
  // panel node via a ref-effect rather than a JSX handler so the dialog root
  // stays free of keyboard listeners (jsx-a11y/no-noninteractive-element-*).
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    panel.addEventListener("keydown", handler);
    return () => panel.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="sdm-queue-detail-drawer-root"
      data-testid="queue-detail-drawer"
      role="dialog"
      aria-modal="true"
      aria-label={t("queue.detailDrawer.ariaLabel")}
    >
      <div
        ref={backdropRef}
        className="sdm-queue-detail-drawer-backdrop"
        data-testid="queue-detail-drawer-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <div ref={panelRef} className="sdm-queue-detail-drawer-panel">
        <div className="sdm-queue-detail-drawer-close">
          <IconButton
            ref={closeButtonRef}
            type="button"
            size="sm"
            variant="ghost"
            aria-label={t("queue.detailDrawer.close")}
            title={t("queue.detailDrawer.close")}
            data-testid="queue-detail-drawer-close"
            icon={<X size={16} aria-hidden="true" />}
            onClick={onClose}
          />
        </div>
        <QueueDetailPane row={row} />
      </div>
    </div>
  );
}
