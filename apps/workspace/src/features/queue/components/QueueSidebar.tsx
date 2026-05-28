import { useTranslation } from "@sdm/i18n";
import type { SavedView } from "../types";

/**
 * Left rail — saved-views list + delete affordance. The "all tickets" entry
 * resets every filter (active when no saved view matches the current URL
 * state). The wireframe also calls for hard-coded queues (My open, My team,
 * Unassigned, etc.) — those need the active-user identity, which v0 doesn't
 * persist outside the session context; the next chunk wires them in once the
 * session-keyed filter presets land.
 */

export interface QueueSidebarProps {
  readonly views: ReadonlyArray<SavedView>;
  readonly activeViewId: string | null;
  readonly onSelectView: (view: SavedView) => void;
  readonly onResetView: () => void;
  readonly onDeleteView: (id: string) => void;
}

export function QueueSidebar(props: QueueSidebarProps) {
  const { views, activeViewId, onSelectView, onResetView, onDeleteView } = props;
  const { t } = useTranslation("workspace");

  return (
    <nav
      className="sdm-queue-sidebar"
      data-testid="queue-sidebar"
      aria-label={t("queue.sidebar.ariaLabel")}
    >
      <section className="sdm-queue-sidebar-section">
        <h2 className="sdm-queue-sidebar-heading">{t("queue.sidebar.queues")}</h2>
        <ul className="sdm-queue-sidebar-list">
          <li>
            <button
              type="button"
              className={
                activeViewId === null
                  ? "sdm-queue-sidebar-item sdm-queue-sidebar-item--active"
                  : "sdm-queue-sidebar-item"
              }
              data-testid="queue-sidebar-all"
              onClick={onResetView}
            >
              {t("queue.sidebar.allTickets")}
            </button>
          </li>
        </ul>
      </section>

      <section className="sdm-queue-sidebar-section">
        <h2 className="sdm-queue-sidebar-heading">{t("queue.savedViews")}</h2>
        {views.length === 0 ? (
          <p className="sdm-queue-sidebar-empty">{t("queue.sidebar.noSavedViews")}</p>
        ) : (
          <ul className="sdm-queue-sidebar-list">
            {views.map((view) => {
              const isActive = view.id === activeViewId;
              return (
                <li key={view.id} className="sdm-queue-sidebar-row">
                  <button
                    type="button"
                    className={
                      isActive
                        ? "sdm-queue-sidebar-item sdm-queue-sidebar-item--active"
                        : "sdm-queue-sidebar-item"
                    }
                    data-testid={`queue-sidebar-view-${view.id}`}
                    onClick={() => onSelectView(view)}
                  >
                    {view.name}
                  </button>
                  <button
                    type="button"
                    className="sdm-queue-sidebar-delete"
                    aria-label={t("queue.sidebar.deleteView", { name: view.name })}
                    data-testid={`queue-sidebar-delete-${view.id}`}
                    onClick={() => onDeleteView(view.id)}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </nav>
  );
}
