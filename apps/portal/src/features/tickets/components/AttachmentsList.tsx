import { useTranslation } from "@sdm/i18n";
import type { UiAttachmentMeta, UiTicketDetailAttachments } from "@sdm/api-types";

/**
 * Attachment list — read-only metadata for the requester.
 *
 * Binary download endpoint (`GET /caisd-rest/attmnt/{id}/file-resource`) is
 * **deferred** per H.4 §Open questions + F.6 §23.6. We render each chip
 * non-interactive with a tooltip explaining the temporary limitation so
 * Lucia knows the attachment exists without the FE silently dropping it.
 *
 * K.3.E v1.2 — paperclip glyph is now a lucide-shaped inline SVG (portal
 * has no `lucide-react` dep). File-size is rendered with tabular-nums.
 */
export interface AttachmentsListProps {
  readonly attachments: UiTicketDetailAttachments;
}

function PaperclipIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M13.234 20.252 21 12.3" />
      <path d="m16 6-8.414 8.586a2 2 0 0 0 0 2.828 2 2 0 0 0 2.828 0l8.414-8.586a4 4 0 0 0 0-5.656 4 4 0 0 0-5.656 0l-8.415 8.585a6 6 0 1 0 8.486 8.486" />
    </svg>
  );
}

function formatBytes(bytes: number | null): string {
  if (bytes == null || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentChip({ item, tooltip }: { item: UiAttachmentMeta; tooltip: string }) {
  const size = formatBytes(item.sizeBytes);
  return (
    <li
      className="sdm-portal-ticket-attachment-chip"
      title={tooltip}
      data-testid="portal-ticket-attachment"
    >
      <span className="sdm-portal-ticket-attachment-icon" aria-hidden="true">
        <PaperclipIcon />
      </span>
      <span className="sdm-portal-ticket-attachment-name">{item.name || item.id}</span>
      {size ? <span className="sdm-portal-ticket-attachment-size">{size}</span> : null}
    </li>
  );
}

export function AttachmentsList({ attachments }: AttachmentsListProps) {
  const { t } = useTranslation("portal");

  if (attachments._unsupported) {
    return (
      <section
        className="sdm-portal-ticket-attachments"
        data-testid="portal-ticket-attachments-unsupported"
      >
        <h2 className="sdm-portal-ticket-section-title">{t("ticketDetail.attachments.title")}</h2>
        <p
          className="sdm-portal-ticket-attachments-empty"
          title={t("ticketDetail.unsupportedTooltip")}
        >
          {t("ticketDetail.attachments.unsupported")}
        </p>
      </section>
    );
  }

  if (attachments.items.length === 0) {
    return null;
  }

  const downloadTooltip = t("ticketDetail.attachments.downloadDeferred");

  return (
    <section className="sdm-portal-ticket-attachments" data-testid="portal-ticket-attachments">
      <h2 className="sdm-portal-ticket-section-title">{t("ticketDetail.attachments.title")}</h2>
      <ul className="sdm-portal-ticket-attachment-list">
        {attachments.items.map((item) => (
          <AttachmentChip key={item.id} item={item} tooltip={downloadTooltip} />
        ))}
      </ul>
    </section>
  );
}
