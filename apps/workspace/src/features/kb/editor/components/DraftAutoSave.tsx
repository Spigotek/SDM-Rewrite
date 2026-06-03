import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@sdm/i18n";
import { saveDraft } from "../api";
import { sanitizeMarkdown } from "../lib/sanitizer";

/**
 * Debounced 5s draft auto-save. Pushes `body` to `PATCH /api/kb/articles/:id/draft`
 * with a stable trailing-edge debounce window; only one in-flight save at
 * a time (concurrent edits reuse the latest body).
 *
 * Renders a `role="status"` live region with the localized "Saving…" /
 * "Saved {relativeTime}" message per the wireframe a11y note.
 */
const DEBOUNCE_MS = 5_000;

export interface DraftAutoSaveProps {
  readonly articleId: string | null;
  readonly body: string;
  /** Pass-through hook for unit testing — defaults to wall-clock now. */
  readonly nowFn?: () => number;
}

type Status = "idle" | "saving" | "saved" | "error";

function relativeTime(
  savedAt: number,
  now: number,
  t: (k: string, v?: Record<string, unknown>) => string,
): string {
  const delta = Math.max(0, Math.round((now - savedAt) / 1000));
  if (delta < 60) return t("kb.editor.autosave.savedJustNow");
  if (delta < 3600)
    return t("kb.editor.autosave.savedMinutesAgo", { minutes: Math.round(delta / 60) });
  return t("kb.editor.autosave.savedHoursAgo", { hours: Math.round(delta / 3600) });
}

export function DraftAutoSave({ articleId, body, nowFn }: DraftAutoSaveProps) {
  const { t } = useTranslation("workspace");
  const [status, setStatus] = useState<Status>("idle");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedBodyRef = useRef<string>(body);
  const now = nowFn ?? Date.now;

  // Schedule a debounced save whenever the body changes (and there's an id).
  useEffect(() => {
    if (!articleId) return;
    if (body === lastSavedBodyRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const sanitized = sanitizeMarkdown(body);
      setStatus("saving");
      saveDraft(articleId, sanitized)
        .then(() => {
          lastSavedBodyRef.current = body;
          setStatus("saved");
          setSavedAt(now());
        })
        .catch(() => {
          setStatus("error");
        });
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [articleId, body, now]);

  // Ticker re-renders the relative-time label once a minute.
  useEffect(() => {
    if (status !== "saved") return;
    const handle = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(handle);
  }, [status]);

  // Suppress unused-warning for `tick` (it's only here to retrigger render).
  void tick;

  let label: string;
  if (status === "saving") label = t("kb.editor.autosave.saving");
  else if (status === "error") label = t("kb.editor.autosave.error");
  else if (status === "saved" && savedAt !== null) label = relativeTime(savedAt, now(), t);
  else label = t("kb.editor.autosave.idle");

  return (
    <span
      role="status"
      aria-live="polite"
      className="sdm-kb-editor-autosave"
      data-testid="kb-editor-autosave"
      data-status={status}
    >
      {label}
    </span>
  );
}
