import { useState } from "react";
import { useTranslation } from "@sdm/i18n";
import type { TenantId } from "@sdm/domain";

/**
 * `<SharedCiMarker>` — small badge "Shared (N)" that opens a popover listing
 * the tenants the CI is shared with. Rendered next to the CI name in
 * `CmdbTable` rows and inside `CiHeader` for the detail page. Falls back to
 * `null` when `sharedWithTenantIds` is empty or undefined so non-sp_admin
 * callers don't see any visual artefacts (existing single-tenant invariant
 * per H.13).
 */
export interface SharedCiMarkerProps {
  readonly sharedWithTenantIds: ReadonlyArray<TenantId> | undefined;
  readonly testId?: string;
}

export function SharedCiMarker({ sharedWithTenantIds, testId }: SharedCiMarkerProps) {
  const { t } = useTranslation("workspace");
  const [open, setOpen] = useState(false);

  if (!sharedWithTenantIds || sharedWithTenantIds.length === 0) return null;
  const count = sharedWithTenantIds.length;

  return (
    <span className="sdm-shared-ci-marker" data-testid={testId ?? "shared-ci-marker"}>
      <button
        type="button"
        className="sdm-shared-ci-marker-badge"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title={t("sp.cmdb.sharedWith.tooltip", { count })}
      >
        {t("sp.cmdb.sharedWith.label", { count })}
      </button>
      {open ? (
        <div
          className="sdm-shared-ci-marker-popover"
          role="dialog"
          aria-label={t("sp.cmdb.sharedWith.popoverAriaLabel")}
          data-testid="shared-ci-marker-popover"
        >
          <ul className="sdm-shared-ci-marker-list">
            {sharedWithTenantIds.map((id) => (
              <li key={id} className="sdm-shared-ci-marker-list-item">
                {id}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </span>
  );
}
