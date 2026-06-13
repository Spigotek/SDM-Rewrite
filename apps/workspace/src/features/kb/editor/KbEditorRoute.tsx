import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@sdm/i18n";
import { tenantId as toTenantId } from "@sdm/domain";
import {
  Button,
  Card,
  Skeleton,
  Toast,
  ToastViewport,
  usePageTransition,
} from "@sdm/design-system";
import { useSession } from "../../../shell/session-context";
import { kbCategoriesQuery } from "../api";
import { createArticle, kbEditorArticleQuery, publishArticle, updateArticle } from "./api";
import { EditorShell } from "./components/EditorShell";
import { VisibilitySelector } from "./components/VisibilitySelector";
import { PublishModal } from "./components/PublishModal";
import { DraftAutoSave } from "./components/DraftAutoSave";
import { uploadKbImage, AttachmentError } from "./upload";
import type { Editor } from "@tiptap/react";

import type { KbVisibility } from "./types";
import "../kb.css";
import "./editor.css";

/**
 * `/kb/editor` + `/kb/editor/:id` — K.3.E polish:
 *
 * - The editor surface is now wrapped in a `<Card>` so the chrome inherits DS
 *   tokens (surface + border + radius) and the dark theme picks up correctly.
 * - Toolbar above the editor: title input + DS "Save" / "Publish" buttons.
 * - Auto-save status pill (existing `DraftAutoSave` `data-status`) lives next
 *   to the title; the design-system DraftAutoSave label is the small status
 *   indicator per the K.3.E checklist.
 * - On save / publish success we surface a 5 s `Toast` in the top-right via
 *   the DS `ToastViewport` primitive (local state — no global toast bus yet).
 * - Skeleton placeholder for the loading state when editing an existing
 *   article (`isLoading`).
 * - `usePageTransition` honours the K.1 brief crossfade rule.
 */
const TENANT_PLACEHOLDER = toTenantId("__pending__");

type ToastEntry = {
  readonly id: string;
  readonly intent: "success" | "info";
  readonly title: string;
};

export default function KbEditorRoute() {
  const { t } = useTranslation("workspace");
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useSession();
  const tenantId = session?.tenantId ?? TENANT_PLACEHOLDER;
  const params = useParams<{ id?: string }>();
  const articleId = params.id ?? null;
  const { ref: pageRef } = usePageTransition(location.pathname);

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
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [toasts, setToasts] = useState<ReadonlyArray<ToastEntry>>([]);
  const editorRef = useRef<Editor | null>(null);
  const queryClient = useQueryClient();

  const pushToast = useCallback((entry: Omit<ToastEntry, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { ...entry, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const onEditorReady = useCallback((ed: Editor) => {
    editorRef.current = ed;
  }, []);

  const onImageFile = useCallback(
    async (file: File) => {
      setUploadError(null);
      setUploading(true);
      try {
        const result = await uploadKbImage(file);
        editorRef.current?.commands.setImage({ src: result.url, alt: file.name });
      } catch (err) {
        if (err instanceof AttachmentError) {
          const codeMap: Record<string, string> = {
            ATTACHMENT_TOO_LARGE: t("kb.editor.upload.error.size"),
            ATTACHMENT_UNSUPPORTED_MIME: t("kb.editor.upload.error.mime"),
            ATTACHMENT_MIME_MISMATCH: t("kb.editor.upload.error.mime"),
            ATTACHMENT_SVG_REJECTED: t("kb.editor.upload.error.svg"),
          };
          setUploadError(codeMap[err.code] ?? t("kb.editor.upload.error.generic"));
        } else {
          setUploadError(t("kb.editor.upload.error.generic"));
        }
      } finally {
        setUploading(false);
      }
    },
    [t],
  );

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
      pushToast({ intent: "success", title: t("kb.editor.toast.saved") });
      navigate(`/kb/editor/${encodeURIComponent(created.id)}`, { replace: true });
    },
    onError: () => setServerError(t("kb.editor.errors.save")),
  });

  const updateMutation = useMutation({
    mutationFn: () => updateArticle(articleId!, { title, body, categoryId, visibility, tags }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kb-browse"] });
      queryClient.invalidateQueries({ queryKey: ["kb-editor-article", tenantId, articleId] });
      pushToast({ intent: "success", title: t("kb.editor.toast.saved") });
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
      pushToast({ intent: "success", title: t("kb.editor.toast.published") });
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
  const showSkeleton = article.isLoading && articleId !== null;

  return (
    <section
      className="sdm-kb-editor-page"
      data-testid="workspace-kb-editor"
      ref={pageRef as React.RefObject<HTMLElement>}
    >
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
      {uploadError ? (
        <p role="alert" className="sdm-kb-editor-error" data-testid="kb-editor-upload-error">
          {uploadError}
        </p>
      ) : null}

      {showSkeleton ? (
        <Card variant="surface" className="sdm-kb-editor-skeleton" data-testid="kb-editor-loading">
          <Skeleton variant="text" width="60%" height={20} />
          <Skeleton variant="block" width="100%" height={320} />
        </Card>
      ) : (
        <div className="sdm-kb-editor-grid">
          <Card variant="surface" className="sdm-kb-editor-main-card">
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
            <div className="sdm-kb-editor-shell-wrapper">
              {uploading ? (
                <div
                  className="sdm-kb-editor-upload-overlay"
                  data-testid="kb-editor-uploading"
                  aria-live="polite"
                >
                  {t("kb.editor.upload.uploading")}
                </div>
              ) : null}
              <EditorShell
                value={body}
                onMarkdownChange={setBody}
                placeholder={t("kb.editor.body.placeholder")}
                onEditorReady={onEditorReady}
                onImageFile={onImageFile}
              />
            </div>
          </Card>

          <Card
            variant="surface"
            className="sdm-kb-editor-side-card"
            aria-label={t("kb.editor.side.aria")}
          >
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
          </Card>
        </div>
      )}

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

      <ToastViewport>
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            intent={toast.intent}
            title={toast.title}
            id={toast.id}
            onDismiss={() => dismissToast(toast.id)}
          />
        ))}
      </ToastViewport>
    </section>
  );
}
