import type { Editor } from "@tiptap/react";
import { useTranslation } from "@sdm/i18n";
import { Button } from "@sdm/design-system";

/**
 * KB editor toolbar — the minimum command set the journey-13 spec exercises:
 * bold / italic / code mark, h1-h3 toggles, bullet + ordered list, code
 * block, blockquote, horizontal rule, link insert (prompt-based; same UX as
 * the existing Composer for incident comments), image-by-URL insert (no
 * file upload per I.4 scope), and table insert.
 *
 * Every action is keyboard-accessible (TipTap's own keymap handles the
 * keyboard shortcuts; the buttons are click-only redundancy).
 */
export interface EditorToolbarProps {
  readonly editor: Editor | null;
}

function isActive(editor: Editor | null, name: string, attrs?: Record<string, unknown>): boolean {
  if (!editor) return false;
  return attrs ? editor.isActive(name, attrs) : editor.isActive(name);
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const { t } = useTranslation("workspace");
  if (!editor) return null;

  const promptForLink = () => {
    const prev = (editor.getAttributes("link")["href"] as string) ?? "";
    const url = window.prompt(t("kb.editor.toolbar.linkPrompt"), prev);
    if (url === null) return;
    if (url.trim().length === 0) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  const promptForImage = () => {
    const url = window.prompt(t("kb.editor.toolbar.imagePrompt"), "");
    if (!url || url.trim().length === 0) return;
    editor.chain().focus().setImage({ src: url.trim() }).run();
  };

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  return (
    <div className="sdm-kb-editor-toolbar" role="toolbar" aria-label={t("kb.editor.toolbar.aria")}>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        data-active={isActive(editor, "bold") || undefined}
        data-testid="kb-editor-bold"
        onClick={() => editor.chain().focus().toggleBold().run()}
        aria-pressed={isActive(editor, "bold")}
      >
        {t("kb.editor.toolbar.bold")}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        data-active={isActive(editor, "italic") || undefined}
        data-testid="kb-editor-italic"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        aria-pressed={isActive(editor, "italic")}
      >
        {t("kb.editor.toolbar.italic")}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        data-active={isActive(editor, "heading", { level: 1 }) || undefined}
        data-testid="kb-editor-h1"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        H1
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        data-active={isActive(editor, "heading", { level: 2 }) || undefined}
        data-testid="kb-editor-h2"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        H2
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        data-active={isActive(editor, "heading", { level: 3 }) || undefined}
        data-testid="kb-editor-h3"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        H3
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        data-active={isActive(editor, "bulletList") || undefined}
        data-testid="kb-editor-bullet"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        {t("kb.editor.toolbar.bulletList")}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        data-active={isActive(editor, "orderedList") || undefined}
        data-testid="kb-editor-ordered"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        {t("kb.editor.toolbar.orderedList")}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        data-active={isActive(editor, "codeBlock") || undefined}
        data-testid="kb-editor-code"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        {t("kb.editor.toolbar.codeBlock")}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        data-active={isActive(editor, "blockquote") || undefined}
        data-testid="kb-editor-quote"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        {t("kb.editor.toolbar.blockquote")}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        data-active={isActive(editor, "link") || undefined}
        data-testid="kb-editor-link"
        onClick={promptForLink}
      >
        {t("kb.editor.toolbar.link")}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        data-testid="kb-editor-image"
        onClick={promptForImage}
      >
        {t("kb.editor.toolbar.image")}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        data-testid="kb-editor-table"
        onClick={insertTable}
      >
        {t("kb.editor.toolbar.table")}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        data-testid="kb-editor-hr"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        {t("kb.editor.toolbar.hr")}
      </Button>
    </div>
  );
}
