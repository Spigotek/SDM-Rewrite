import { Suspense, lazy, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@sdm/i18n";
import type { CiDetail } from "../types";
import { ciRelationshipsQuery } from "../api";
import { buildElements, MAX_NODES_DEFAULT, type LayoutKind } from "../lib/cytoscape-config";
import { GraphLegend } from "./GraphLegend";
import { GraphListFallback } from "./GraphListFallback";

/**
 * Relationships tab — orchestrates fetching, mode toggle (graph / list), layout
 * picker, and the lazy Cytoscape canvas. Replaces H.13's `RelationshipsPlaceholder`.
 *
 * The Cytoscape graph is loaded via `React.lazy(() => import("./CmdbGraph"))`
 * — that import boundary is what Vite splits into the `vendor-graph` chunk
 * (see `vite.config.ts` manualChunks). The workspace initial JS pays zero
 * cost for Cytoscape until the user lands on a CI detail and switches to this
 * tab; even then, the list-fallback mode short-circuits the lazy import.
 *
 * Max-nodes gate (per `components.md §RelationshipGraph` performance gate):
 * default 200. If a CI has more neighbours, we render the first N + a
 * "Show more" button that doubles the cap. Each click logs a `console.info`
 * crumb — Sentry hooks pick those up via the global breadcrumbs pipeline.
 */
const CmdbGraph = lazy(() => import("./CmdbGraph"));

type ViewMode = "graph" | "list";

export interface RelationshipGraphProps {
  readonly detail: CiDetail;
}

export function RelationshipGraph({ detail }: RelationshipGraphProps) {
  const { t } = useTranslation("workspace");
  const [mode, setMode] = useState<ViewMode>("graph");
  const [layout, setLayout] = useState<LayoutKind>("force");
  const [cap, setCap] = useState<number>(MAX_NODES_DEFAULT);

  const relQuery = useQuery({
    ...ciRelationshipsQuery(detail.id),
    enabled: detail.id.length > 0,
  });

  const payload = relQuery.data;
  const total = payload?.relationships.length ?? 0;
  const overLimit = total > cap;

  const visibleRelationships = useMemo(
    () => (payload ? payload.relationships.slice(0, cap) : []),
    [payload, cap],
  );

  const neighbourLabels = useMemo(() => {
    const map = new Map<string, { name: string; ciClass: string }>();
    if (!payload) return map;
    for (const n of payload.neighbours) map.set(n.id, { name: n.name, ciClass: n.class });
    return map;
  }, [payload]);

  const elements = useMemo(
    () =>
      buildElements({
        centerId: detail.id,
        centerLabel: detail.name,
        centerClass: detail.class,
        relationships: visibleRelationships,
        neighbourLabels,
      }),
    [detail.id, detail.name, detail.class, visibleRelationships, neighbourLabels],
  );

  return (
    <section
      role="tabpanel"
      id="cmdb-tabpanel-relationships"
      aria-labelledby="cmdb-tab-relationships"
      data-testid="cmdb-tabpanel-relationships"
      className="sdm-cmdb-tabpanel sdm-cmdb-graph-panel"
    >
      <header className="sdm-cmdb-graph-header">
        <div className="sdm-cmdb-graph-header-titles">
          <h2>{t("cmdb.relationships.title")}</h2>
          <p className="sdm-cmdb-graph-count" data-testid="cmdb-graph-count">
            {t("cmdb.relationships.count", { count: total })}
          </p>
        </div>
        <div
          className="sdm-cmdb-graph-controls"
          role="toolbar"
          aria-label={t("cmdb.relationships.controlsAriaLabel")}
        >
          <div
            className="sdm-cmdb-graph-mode-toggle"
            role="group"
            aria-label={t("cmdb.relationships.modeAriaLabel")}
          >
            <button
              type="button"
              data-testid="cmdb-graph-mode-graph"
              data-active={mode === "graph" || undefined}
              aria-pressed={mode === "graph"}
              onClick={() => setMode("graph")}
              className="sdm-cmdb-graph-mode-btn"
            >
              {t("cmdb.relationships.mode.graph")}
            </button>
            <button
              type="button"
              data-testid="cmdb-graph-mode-list"
              data-active={mode === "list" || undefined}
              aria-pressed={mode === "list"}
              onClick={() => setMode("list")}
              className="sdm-cmdb-graph-mode-btn"
            >
              {t("cmdb.relationships.mode.list")}
            </button>
          </div>
          {mode === "graph" && (
            <label className="sdm-cmdb-graph-layout-picker">
              <span className="sdm-cmdb-graph-layout-label">
                {t("cmdb.relationships.layoutLabel")}
              </span>
              <select
                data-testid="cmdb-graph-layout"
                value={layout}
                onChange={(e) => setLayout(e.target.value as LayoutKind)}
                className="sdm-cmdb-graph-layout-select"
              >
                <option value="force">{t("cmdb.relationships.layout.force")}</option>
                <option value="tree">{t("cmdb.relationships.layout.tree")}</option>
                <option value="breadth">{t("cmdb.relationships.layout.breadth")}</option>
              </select>
            </label>
          )}
        </div>
      </header>

      {relQuery.isPending && (
        <p className="sdm-cmdb-graph-state" data-testid="cmdb-graph-loading">
          {t("cmdb.relationships.loading")}
        </p>
      )}
      {relQuery.isError && (
        <p
          className="sdm-cmdb-graph-state sdm-cmdb-graph-state--error"
          data-testid="cmdb-graph-error"
          role="alert"
        >
          {t("cmdb.relationships.error")}
        </p>
      )}

      {payload && total === 0 && (
        <p className="sdm-cmdb-graph-state" data-testid="cmdb-graph-empty">
          {t("cmdb.relationships.empty")}
        </p>
      )}

      {payload && total > 0 && (
        <>
          {mode === "graph" ? (
            <div className="sdm-cmdb-graph-wrapper">
              <Suspense
                fallback={
                  <p className="sdm-cmdb-graph-state" data-testid="cmdb-graph-chunk-loading">
                    {t("cmdb.relationships.chunkLoading")}
                  </p>
                }
              >
                <CmdbGraph elements={elements} layout={layout} centerCiId={detail.id} />
              </Suspense>
              <GraphLegend />
            </div>
          ) : (
            <GraphListFallback
              centerCiId={detail.id}
              centerLabel={detail.name}
              centerClass={detail.class}
              relationships={visibleRelationships}
              neighbours={payload.neighbours}
            />
          )}

          {overLimit && (
            <div className="sdm-cmdb-graph-overflow" data-testid="cmdb-graph-overflow">
              <p>{t("cmdb.relationships.overflow", { shown: cap, total })}</p>
              <button
                type="button"
                data-testid="cmdb-graph-show-more"
                onClick={() => setCap((c) => Math.min(c * 2, total))}
                className="sdm-cmdb-graph-show-more"
              >
                {t("cmdb.relationships.showMore")}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default RelationshipGraph;
