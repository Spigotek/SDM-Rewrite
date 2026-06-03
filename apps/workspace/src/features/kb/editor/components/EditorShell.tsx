import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { useEffect } from "react";
import { useTranslation } from "@sdm/i18n";
import { EditorToolbar } from "./EditorToolbar";
import { markdownToTipTapJson, tipTapJsonToMarkdown, type TipTapDoc } from "../lib/markdown-bridge";

/** TipTap's `Content` API expects mutable JSONContent; structural clone keeps
 *  the bridge `readonly` while satisfying the editor type. */
function toMutableJson(doc: TipTapDoc): JSONContent {
  return JSON.parse(JSON.stringify(doc)) as JSONContent;
}

/**
 * TipTap editor wrapper. Owns the editor instance lifecycle and exposes
 * `onMarkdownChange` so the parent route can debounce auto-save without
 * dragging the editor state up into RHF (TipTap manages document state
 * internally — RHF would fight it).
 *
 * `value` is canonical markdown; the bridge converts to/from the structured
 * TipTap doc model on mount + serialise. Subsequent edits stay in the
 * structured form until the parent asks for markdown (debounced).
 */
export interface EditorShellProps {
  readonly value: string;
  readonly onMarkdownChange: (markdown: string) => void;
  readonly placeholder?: string;
  readonly testId?: string;
}

export function EditorShell({ value, onMarkdownChange, placeholder, testId }: EditorShellProps) {
  const { t } = useTranslation("workspace");
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link.configure({
        openOnClick: false,
        autolink: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Image.configure({ inline: false, allowBase64: false }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content: value.trim().length > 0 ? toMutableJson(markdownToTipTapJson(value)) : "",
    editorProps: {
      attributes: {
        class: "sdm-kb-editor-prose",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": placeholder ?? t("kb.editor.body.aria"),
        "data-testid": testId ?? "kb-editor-body",
      },
    },
    onUpdate: ({ editor: ed }) => {
      const json = ed.getJSON() as TipTapDoc;
      onMarkdownChange(tipTapJsonToMarkdown(json));
    },
  });

  // Reset the editor body when the upstream `value` swaps (e.g. switching
  // articles). Skip when the editor's current markdown already matches —
  // avoids infinite onUpdate loops caused by minor whitespace drift.
  useEffect(() => {
    if (!editor) return;
    const current = tipTapJsonToMarkdown(editor.getJSON() as TipTapDoc);
    if (current.trim() === value.trim()) return;
    editor.commands.setContent(
      value.trim().length > 0 ? toMutableJson(markdownToTipTapJson(value)) : "",
      false,
    );
  }, [value, editor]);

  return (
    <div className="sdm-kb-editor-shell" data-testid="kb-editor-shell">
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
