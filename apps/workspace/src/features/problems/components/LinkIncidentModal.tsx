import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@sdm/i18n";
import { Button } from "@sdm/design-system";
import { incidentSearchQuery, type ProblemId } from "../api";
import { useLinkIncidents } from "../hooks";

/**
 * LinkIncidentModal — search box + multi-select list. The plan calls for a
 * "Combobox async load" but the design-system doesn't ship a Combobox primitive
 * and the MVP fixture only has ~40 incidents per tenant, so we fetch the full
 * list once (cached 30 s) and filter client-side. The same component will
 * graduate to async-search the moment the BFF gains a `/api/incidents?q=` hit.
 *
 * Already-linked incidents are pre-checked and disabled so the agent can't
 * double-link, while the visible row keeps the "current linkage" affordance.
 */
export interface LinkIncidentModalProps {
  readonly problemId: ProblemId;
  readonly alreadyLinkedIds: ReadonlyArray<string>;
  readonly onClose: () => void;
}

export function LinkIncidentModal({
  problemId,
  alreadyLinkedIds,
  onClose,
}: LinkIncidentModalProps) {
  const { t } = useTranslation("workspace");
  const link = useLinkIncidents(problemId);
  const incidentsQuery = useQuery(incidentSearchQuery());

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ReadonlyArray<string>>([]);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  const linkedSet = useMemo(() => new Set(alreadyLinkedIds), [alreadyLinkedIds]);

  const filtered = useMemo(() => {
    const all = incidentsQuery.data ?? [];
    const needle = search.trim().toLowerCase();
    if (!needle) return all;
    return all.filter(
      (i) => i.ref.toLowerCase().includes(needle) || i.summary.toLowerCase().includes(needle),
    );
  }, [incidentsQuery.data, search]);

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const onSubmit = () => {
    if (selected.length === 0) return;
    link.mutate(selected, { onSuccess: () => onClose() });
  };

  return (
    <div className="sdm-modal-overlay" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="problem-link-modal-title"
        className="sdm-modal-dialog"
        data-testid="problem-link-modal"
      >
        <h2 id="problem-link-modal-title" className="sdm-modal-title">
          {t("problems.linkModal.title")}
        </h2>
        <p className="sdm-modal-body">{t("problems.linkModal.body")}</p>

        <input
          type="search"
          className="sdm-link-modal-search"
          placeholder={t("problems.linkModal.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t("problems.linkModal.searchLabel")}
          data-testid="problem-link-modal-search"
        />

        {filtered.length === 0 ? (
          <p className="sdm-link-modal-empty" data-testid="problem-link-modal-empty">
            {t("problems.linkModal.noMatches")}
          </p>
        ) : (
          <ul className="sdm-link-modal-list">
            {filtered.map((i) => {
              const isLinked = linkedSet.has(i.id);
              const isSelected = selected.includes(i.id);
              return (
                <li key={i.id}>
                  <label
                    className="sdm-link-modal-option"
                    style={{ cursor: isLinked ? "not-allowed" : "pointer" }}
                  >
                    <input
                      type="checkbox"
                      checked={isLinked || isSelected}
                      disabled={isLinked}
                      onChange={() => toggle(i.id)}
                      data-testid={`problem-link-modal-option-${i.id}`}
                    />
                    <span className="sdm-link-modal-option-ref">#{i.ref}</span>
                    <span className="sdm-link-modal-option-summary" title={i.summary}>
                      {i.summary}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        <p className="sdm-link-modal-selected" data-testid="problem-link-modal-selected-count">
          {t("problems.linkModal.selected", { count: selected.length })}
        </p>

        <div className="sdm-modal-actions">
          <Button
            ref={cancelRef}
            variant="secondary"
            onClick={onClose}
            data-testid="problem-link-modal-cancel"
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={onSubmit}
            loading={link.isPending}
            disabled={selected.length === 0}
            data-testid="problem-link-modal-submit"
          >
            {t("problems.linkModal.submit")}
          </Button>
        </div>
      </div>
    </div>
  );
}
