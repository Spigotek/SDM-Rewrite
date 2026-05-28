import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@sdm/i18n";
import type { QueueColumnKey } from "../types";

export interface ColumnConfigProps {
  readonly visible: ReadonlyArray<QueueColumnKey>;
  readonly all: ReadonlyArray<QueueColumnKey>;
  readonly onToggle: (key: QueueColumnKey) => void;
  readonly onReset: () => void;
}

/**
 * Column visibility dropdown — checkable list bound to localStorage via the
 * `useColumnConfig` hook. Order matches `01-queue.md §Default columns`.
 */
export function ColumnConfig(props: ColumnConfigProps) {
  const { visible, all, onToggle, onReset } = props;
  const { t } = useTranslation("workspace");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div className="sdm-queue-columns" ref={rootRef} data-testid="column-config">
      <button
        type="button"
        className="sdm-queue-columns-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        data-testid="column-config-trigger"
      >
        {t("queue.columns.menu")}
      </button>
      {open ? (
        <div className="sdm-queue-columns-menu" role="menu">
          <ul>
            {all.map((key) => {
              const checked = visible.includes(key);
              return (
                <li key={key}>
                  <label className="sdm-queue-columns-item">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(key)}
                      data-testid={`column-toggle-${key}`}
                    />
                    {t(`queue.columns.${key}`)}
                  </label>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            className="sdm-queue-columns-reset"
            onClick={() => {
              onReset();
              setOpen(false);
            }}
            data-testid="column-config-reset"
          >
            {t("queue.columns.reset")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
