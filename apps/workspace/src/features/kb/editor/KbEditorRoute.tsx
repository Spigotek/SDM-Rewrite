import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@sdm/i18n";
import { tenantId as toTenantId } from "@sdm/domain";
import { Button } from "@sdm/design-system";
import { useSession } from "../../../shell/session-context";
import { kbCategoriesQuery } from "../api";
import { createArticle, kbEditorArticleQuery, publishArticle, updateArticle } from "./api";
import { EditorShell } from "./components/EditorShell";
import { VisibilitySelector } from "./components/VisibilitySelector";
import { PublishModal } from "./components/PublishModal";
import { DraftAutoSave } from "./components/DraftAutoSave";
import type { KbVisibility } from "./types";
import "../kb.css";
import "./editor.css";

/**
 * `/kb/editor` (new) + `/kb/editor/:id` (edit existing) — KB authoring route.
 *
 * Layout: left column for the TipTap editor + title; right column for
 * metadata (category, language, visibility, tags). Below the editor, a
 * sticky action bar exposes Save / Publish.
 *
 * The editor body is held in local state (canonical markdown); auto-save
 * fires 5 s after the last edit. Publishing routes through `<PublishModal>`
 * which lets the agent re-confirm visibility + tags.
 */
const TENANT_PLACEHOLDER = toTenantId("__pending__");

export default function KbEditorRoute() {
  const { t } = useTranslation("workspace");
  const navigate = useNavigate();
  const { session } = useSession();
  const tenantId = session?.tenantId ?? TENANT_PLACEHOLDER;
  const params = useParams<{ id?: string }>();
  const articleId = params.id ?? null;

  const article = useQuery({
    ...kbEditorArticleQuery(tenantId, articleId ?? ""),
    enabled: !!articleId && session !== null,
  });

  const categories = useQuery({
    ...kbCategoriesQuery(tenantId),
    enabled: session !== null,
  });

  const [title, setTitle] = useState<string>("");
  const [body, setBody] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<KbVisibility>("tenant");
  const [tags, setTags] = useState<readonly string[]>([]);
  const [publishOpen, setPublishOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Hydrate local form state once per loaded article. `useRef` keyed on the
  // article id avoids re-hydrating when the user edits subsequent fields.
  const hydratedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!article.data) return;
    if (hydratedFor.current === article.data.id) return;
    hydratedFor.current = article.data.id;
    setTitle(article.data.title);
    setBody(article.data.draftBody ?? article.data.body ?? "");
    setCategoryId(article.data.categoryId);
    setVisibility(article.data.visibility);
    setTags(article.data.tags);
  }, [article.data]);

  const createMutation = useMutation({
    mutationFn: () =>
      createArticle({
        title,
        body,
        categoryId,
        visibility,
        tags,
        language: "sk",
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["kb-browse"] });
      navigate(`/kb/editor/${encodeURIComponent(created.id)}`, { replace: true });
    },
    onError: () => setServerError(t("kb.editor.errors.save")),
  });

  const updateMutation = useMutation({
    mutationFn: () => updateArticle(articleId!, { title, body, categoryId, visibility, tags }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kb-browse"] });
      queryClient.invalidateQueries({ queryKey: ["kb-editor-article", tenantId, articleId] });
    },
    onError: () => setServerError(t("kb.editor.errors.save")),
  });

  const publishMutation = useMutation({
    mutationFn: ({
      visibility: v,
      tags: ts,
    }: {
      visibility: KbVisibility;
      tags: readonly string[];
    }) => publishArticle(articleId!, { visibility: v, tags: ts }),
    onSuccess: () => {
      setPublishOpen(false);
      queryClient.invalidateQueries({ queryKey: ["kb-browse"] });
      queryClient.invalidateQueries({ queryKey: ["kb-editor-article", tenantId, articleId] });
      navigate(`/kb/article/${encodeURIComponent(articleId!)}`);
    },
    onError: () => setServerError(t("kb.editor.errors.publish")),
  });

  const onSave = () => {
    setServerError(null);
    if (articleId) updateMutation.mutate();
    else createMutation.mutate();
  };

  const onPublish = () => {
    if (!articleId) {
      setServerError(t("kb.editor.errors.publishNoId"));
      return;
    }
    setPublishOpen(true);
  };

  const saving = createMutation.isPending || updateMutation.isPending;
  const newArticle = articleId === null;

  return (
    <section className="sdm-kb-editor-page" data-testid="workspace-kb-editor">
      <header className="sdm-kb-editor-header">
        <div className="sdm-kb-editor-header-left">
          <h1 className="sdm-kb-editor-title">
            {newArticle ? t("kb.editor.titleNew") : t("kb.editor.titleEdit")}
          </h1>
          <DraftAutoSave articleId={articleId} body={body} />
        </div>
        <div className="sdm-kb-editor-header-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate("/kb")}
            data-testid="kb-editor-back"
          >
            {t("kb.editor.back")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onSave}
            loading={saving}
            data-testid="kb-editor-save"
          >
            {newArticle ? t("kb.editor.create") : t("kb.editor.save")}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={onPublish}
            disabled={newArticle}
            data-testid="kb-editor-publish"
          >
            {t("kb.editor.publish")}
          </Button>
        </div>
      </header>

      {serverError ? (
        <p role="alert" className="sdm-kb-editor-error" data-testid="kb-editor-error">
          {serverError}
        </p>
      ) : null}

      <div className="sdm-kb-editor-grid">
        <div className="sdm-kb-editor-main">
          <label className="sdm-kb-editor-title-row">
            <span>{t("kb.editor.fields.title")}</span>
            <input
              type="text"
              data-testid="kb-editor-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("kb.editor.fields.titlePlaceholder")}
              required
            />
          </label>
          <EditorShell
            value={body}
            onMarkdownChange={setBody}
            placeholder={t("kb.editor.body.placeholder")}
          />
        </div>

        <aside className="sdm-kb-editor-side" aria-label={t("kb.editor.side.aria")}>
          <fieldset className="sdm-kb-editor-fieldset">
            <legend>{t("kb.editor.fields.category")}</legend>
            <select
              data-testid="kb-editor-category"
              value={categoryId ?? ""}
              onChange={(e) => setCategoryId(e.target.value || null)}
            >
              <option value="">{t("kb.editor.fields.categoryNone")}</option>
              {(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </fieldset>

          <VisibilitySelector value={visibility} onChange={setVisibility} />

          <fieldset className="sdm-kb-editor-fieldset">
            <legend>{t("kb.editor.fields.tags")}</legend>
            <input
              type="text"
              data-testid="kb-editor-tags"
              value={tags.join(", ")}
              onChange={(e) =>
                setTags(
                  e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0),
                )
              }
              placeholder={t("kb.editor.fields.tagsPlaceholder")}
            />
          </fieldset>
        </aside>
      </div>

      {publishOpen ? (
        <PublishModal
          title={title}
          defaultVisibility={visibility}
          defaultTags={tags}
          busy={publishMutation.isPending}
          onConfirm={(input) => publishMutation.mutate(input)}
          onCancel={() => setPublishOpen(false)}
        />
      ) : null}
    </section>
  );
}
