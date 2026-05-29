import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@sdm/i18n";
import { ciHistoryQuery } from "../api";
import type { CiDetail, CiHistoryEntry } from "../types";

/**
 * History tab — read-only change log per `spec/cmdb.md §audit-trail`. The
 * stream comes from MSW `/api/ci/:id/history` (deterministic seed derived from
 * the CI's `createdAt` + neighbour relationships). The BFF will eventually
 * project CA SDM `nr_com` (asset_log BREL) — same shape, same query key.
 */

function formatTs(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HistoryTab({ detail }: { readonly detail: CiDetail }) {
  const { t } = useTranslation("workspace");
  const query = useQuery(ciHistoryQuery(detail.id));

  return (
    <section
      role="tabpanel"
      id="cmdb-tabpanel-history"
      aria-labelledby="cmdb-tab-history"
      data-testid="cmdb-tabpanel-history"
      className="sdm-cmdb-tabpanel"
    >
      <header className="sdm-cmdb-history-header">
        <h2>{t("cmdb.history.title")}</h2>
        {query.data ? (
          <span className="sdm-cmdb-history-count" data-testid="cmdb-history-count">
            {t("cmdb.history.count", { count: query.data.length })}
          </span>
        ) : null}
      </header>

      {query.isPending ? (
        <p className="sdm-cmdb-history-state" data-testid="cmdb-history-loading">
          {t("cmdb.history.loading")}
        </p>
      ) : query.isError ? (
        <p
          role="alert"
          className="sdm-cmdb-history-state sdm-cmdb-history-state--error"
          data-testid="cmdb-history-error"
        >
          {t("cmdb.history.error")}
        </p>
      ) : !query.data || query.data.length === 0 ? (
        <p className="sdm-cmdb-history-state" data-testid="cmdb-history-empty">
          {t("cmdb.history.empty")}
        </p>
      ) : (
        <ol className="sdm-cmdb-history-list" data-testid="cmdb-history-list">
          {query.data.map((entry) => (
            <HistoryRow key={entry.id} entry={entry} />
          ))}
        </ol>
      )}
    </section>
  );
}

function HistoryRow({ entry }: { readonly entry: CiHistoryEntry }) {
  const { t } = useTranslation("workspace");
  return (
    <li className="sdm-cmdb-history-row" data-testid="cmdb-history-row" data-action={entry.action}>
      <span className="sdm-cmdb-history-ts">{formatTs(entry.timestamp)}</span>
      <span className="sdm-cmdb-history-action">
        {t(`cmdb.history.action.${entry.action}`, { defaultValue: entry.action })}
      </span>
      <span className="sdm-cmdb-history-actor">{entry.actor}</span>
      <span className="sdm-cmdb-history-detail">{entry.detail}</span>
    </li>
  );
}
