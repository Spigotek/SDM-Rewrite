import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@sdm/i18n";
import { tenantId as toTenantId } from "@sdm/domain";
import { useSession } from "../../shell/session-context";
import { changesListQuery } from "./api";
import { ChangesTable } from "./components/ChangesTable";
import type { ChangeRow } from "./types";
import "./changes.css";

/**
 * `/changes` — Peter's CAB list. Single-pane (no split-view) because the
 * change-detail wireframe is a dedicated page, not a slide-in. Calendar view
 * lives at `/changes/calendar` and ships in H.10; CAB approval flow ships in
 * H.11.
 *
 * Polling cadence (30 s) matches the queue — Peter is reactive but not on the
 * second-by-second loop Anna is. H.10 calendar overlays will hook into the
 * same query key so toggling between list and calendar reuses the cache.
 */
const EMPTY_ROWS: ReadonlyArray<ChangeRow> = [];

export default function ChangesRoute() {
  const { t } = useTranslation("workspace");
  const { session } = useSession();
  const tenantId = session?.tenantId;

  const queryTenantId = tenantId ?? toTenantId("__pending__");
  const query = useQuery({
    ...changesListQuery(queryTenantId),
    enabled: !!tenantId,
  });

  const rows: ReadonlyArray<ChangeRow> = useMemo(() => query.data ?? EMPTY_ROWS, [query.data]);

  return (
    <section data-testid="workspace-changes" className="sdm-changes-page">
      <header className="sdm-changes-header">
        <h1 className="sdm-changes-title">{t("changes.title")}</h1>
        <span className="sdm-changes-tenant-hint">
          {t("placeholders.activeTenant")}{" "}
          <strong data-testid="active-tenant">{tenantId ?? ""}</strong>
        </span>
      </header>

      {query.isPending ? (
        <p className="sdm-changes-state" data-testid="changes-loading">
          {t("changes.loading")}
        </p>
      ) : query.isError ? (
        <p
          role="alert"
          className="sdm-changes-state sdm-changes-state--error"
          data-testid="changes-error"
        >
          {t("changes.error")}
        </p>
      ) : rows.length === 0 ? (
        <p className="sdm-changes-state" data-testid="changes-empty">
          {t("changes.empty")}
        </p>
      ) : (
        <ChangesTable rows={rows} />
      )}
    </section>
  );
}
