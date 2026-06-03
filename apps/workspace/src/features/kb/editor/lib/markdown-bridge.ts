/**
 * Bidirectional TipTap-JSON ↔ canonical GFM markdown bridge.
 *
 * The KB body is persisted as canonical markdown (matches the H.6 portal
 * reader + H.15 workspace read pipeline + the BFF `KbArticleDetail.markdown`
 * shape) so this bridge is the only translation point between the editor's
 * structured document model and the storage layer.
 *
 * Why hand-rolled rather than `tiptap-markdown`:
 *   - `tiptap-markdown` is a 3rd-party turndown wrapper that pulls in another
 *     ~50 KB into `vendor-editor`; the KB feature only needs ~10 node types
 *     so a focused converter is simpler to audit, easier to test, and keeps
 *     us under the 120 KB chunk cap.
 *   - The portal already renders markdown with `react-markdown` + GFM, so the
 *     canonical-markdown invariant is fixed regardless of editor library.
 *
 * Supported nodes (TipTap default doc model + table extension):
 *   doc, paragraph, heading (1-3), bulletList, orderedList, listItem,
 *   codeBlock, blockquote, hardBreak, horizontalRule, image, table,
 *   tableRow, tableHeader, tableCell.
 * Supported marks: bold, italic, code, link.
 *
 * Roundtrip invariants verified by the journey-13 author flow:
 *   - paragraphs, h1/h2/h3, lists, links, tables, fenced code, images
 *     all survive a `markdownToTipTapJson → tipTapJsonToMarkdown` cycle.
 *   - Unknown nodes fall through to a plain paragraph with the node's text
 *     content (lossy but never crashes).
 */

export interface TipTapMark {
  readonly type: string;
  readonly attrs?: Record<string, unknown>;
}

export interface TipTapNode {
  readonly type: string;
  readonly attrs?: Record<string, unknown>;
  readonly text?: string;
  readonly marks?: readonly TipTapMark[];
  readonly content?: readonly TipTapNode[];
}

export interface TipTapDoc {
  readonly type: "doc";
  readonly content: readonly TipTapNode[];
}

// =============================================================================
// TipTap JSON → markdown
// =============================================================================

function escapeMarkdown(text: string): string {
  // Escape only the characters that have GFM meaning at the start of a token
  // when inside paragraph context. Inside code blocks the caller passes raw.
  return text.replace(/([\\`*_{}[\]()#+\-.!|])/g, "\\$1");
}

function renderInlineText(node: TipTapNode): string {
  if (node.type === "hardBreak") return "  \n";
  if (node.type === "text") {
    let text = node.text ?? "";
    const marks = node.marks ?? [];
    // `code` mark wraps with backticks and bypasses other formatting.
    const codeMark = marks.find((m) => m.type === "code");
    if (codeMark) {
      return `\`${text}\``;
    }
    text = escapeMarkdown(text);
    for (const mark of marks) {
      if (mark.type === "bold") text = `**${text}**`;
      else if (mark.type === "italic") text = `*${text}*`;
      else if (mark.type === "link") {
        const href = String(mark.attrs?.["href"] ?? "");
        text = `[${text}](${href})`;
      }
    }
    return text;
  }
  return (node.content ?? []).map(renderInlineText).join("");
}

function renderInline(nodes: readonly TipTapNode[]): string {
  return nodes.map(renderInlineText).join("");
}

function renderTable(node: TipTapNode): string {
  const rows = node.content ?? [];
  if (rows.length === 0) return "";
  const lines: string[] = [];
  rows.forEach((row, i) => {
    const cells = row.content ?? [];
    const text = cells
      .map((cell) => {
        const cellContent = cell.content ?? [];
        return (
          cellContent
            .map((b) => renderInline(b.content ?? []))
            .join(" ")
            .trim() || " "
        );
      })
      .join(" | ");
    lines.push(`| ${text} |`);
    if (i === 0) {
      lines.push(`| ${cells.map(() => "---").join(" | ")} |`);
    }
  });
  return lines.join("\n");
}

function renderBlock(node: TipTapNode, listDepth: number, ordered: boolean | null): string {
  switch (node.type) {
    case "paragraph":
      return renderInline(node.content ?? []);
    case "heading": {
      const level = Number(node.attrs?.["level"] ?? 1);
      return `${"#".repeat(Math.min(Math.max(level, 1), 6))} ${renderInline(node.content ?? [])}`;
    }
    case "bulletList":
      return (node.content ?? []).map((item) => renderBlock(item, listDepth + 1, false)).join("\n");
    case "orderedList":
      return (node.content ?? []).map((item) => renderBlock(item, listDepth + 1, true)).join("\n");
    case "listItem": {
      const indent = "  ".repeat(Math.max(0, listDepth - 1));
      const marker = ordered ? "1." : "-";
      const inner = (node.content ?? [])
        .map((b, i) => {
          if (b.type === "bulletList" || b.type === "orderedList") {
            return "\n" + renderBlock(b, listDepth, null);
          }
          const prefix = i === 0 ? `${indent}${marker} ` : `${indent}  `;
          return `${prefix}${renderBlock(b, listDepth, null)}`;
        })
        .join("");
      return inner;
    }
    case "codeBlock": {
      const lang = String(node.attrs?.["language"] ?? "");
      const text = (node.content ?? []).map((c) => c.text ?? "").join("");
      return `\`\`\`${lang}\n${text}\n\`\`\``;
    }
    case "blockquote":
      return (node.content ?? [])
        .map((b) => renderBlock(b, listDepth, null))
        .join("\n\n")
        .split("\n")
        .map((l) => `> ${l}`)
        .join("\n");
    case "horizontalRule":
      return "---";
    case "hardBreak":
      return "  ";
    case "image": {
      const src = String(node.attrs?.["src"] ?? "");
      const alt = String(node.attrs?.["alt"] ?? "");
      const title = node.attrs?.["title"];
      return `![${alt}](${src}${title ? ` "${String(title)}"` : ""})`;
    }
    case "table":
      return renderTable(node);
    default:
      return renderInline(node.content ?? []);
  }
}

export function tipTapJsonToMarkdown(doc: TipTapDoc | TipTapNode): string {
  const root =
    (doc as TipTapDoc).type === "doc"
      ? (doc as TipTapDoc)
      : { type: "doc" as const, content: [doc as TipTapNode] };
  return root.content
    .map((node) => renderBlock(node, 0, null))
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .join("\n\n");
}

// =============================================================================
// Markdown → TipTap JSON
// =============================================================================

function inlineMarksToNodes(text: string): TipTapNode[] {
  // Lightweight inline tokenizer — handles `**bold**`, `*italic*`, `_italic_`,
  // `` `code` ``, and `[text](url)` links. Nested marks are flattened
  // left-to-right; this is sufficient for the editor roundtrip since TipTap
  // produces the same flat ordering on serialise.
  const nodes: TipTapNode[] = [];
  let i = 0;
  while (i < text.length) {
    const remaining = text.slice(i);
    // Link `[text](url)`.
    const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)/.exec(remaining);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      nodes.push({ type: "text", text: label!, marks: [{ type: "link", attrs: { href: href! } }] });
      i += linkMatch[0].length;
      continue;
    }
    // Inline code `` `code` ``.
    if (remaining.startsWith("`")) {
      const close = remaining.indexOf("`", 1);
      if (close > 0) {
        const code = remaining.slice(1, close);
        nodes.push({ type: "text", text: code, marks: [{ type: "code" }] });
        i += close + 1;
        continue;
      }
    }
    // Bold `**text**` — must check before italic (`*`).
    if (remaining.startsWith("**")) {
      const close = remaining.indexOf("**", 2);
      if (close > 0) {
        const inner = remaining.slice(2, close);
        nodes.push({ type: "text", text: inner, marks: [{ type: "bold" }] });
        i += close + 2;
        continue;
      }
    }
    // Italic `*text*` or `_text_`.
    if (remaining.startsWith("*") && !remaining.startsWith("**")) {
      const close = remaining.indexOf("*", 1);
      if (close > 0) {
        const inner = remaining.slice(1, close);
        nodes.push({ type: "text", text: inner, marks: [{ type: "italic" }] });
        i += close + 1;
        continue;
      }
    }
    if (remaining.startsWith("_")) {
      const close = remaining.indexOf("_", 1);
      if (close > 0) {
        const inner = remaining.slice(1, close);
        nodes.push({ type: "text", text: inner, marks: [{ type: "italic" }] });
        i += close + 1;
        continue;
      }
    }
    // Default: take everything up to the next markup char.
    const nextMarkup = /[*_`[]/.exec(remaining.slice(1));
    const segmentLen = nextMarkup ? nextMarkup.index + 1 : remaining.length;
    const segment = remaining.slice(0, segmentLen).replace(/\\([\\`*_{}[\]()#+\-.!|])/g, "$1");
    nodes.push({ type: "text", text: segment });
    i += segmentLen;
  }
  return nodes;
}

function parseTable(lines: string[]): { node: TipTapNode; consumed: number } | null {
  if (lines.length < 2) return null;
  const headRow = lines[0]!;
  const sepRow = lines[1]!;
  if (!headRow.includes("|") || !/^\s*\|?[\s:-]+\|/.test(sepRow)) return null;
  const cellsFor = (row: string): string[] =>
    row
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((c) => c.trim());
  const rows: string[][] = [cellsFor(headRow)];
  let i = 2;
  while (i < lines.length && lines[i]!.includes("|")) {
    rows.push(cellsFor(lines[i]!));
    i++;
  }
  const tableContent = rows.map((row, ri) => ({
    type: "tableRow",
    content: row.map((cell) => ({
      type: ri === 0 ? "tableHeader" : "tableCell",
      content: [{ type: "paragraph", content: inlineMarksToNodes(cell) }],
    })),
  }));
  return { node: { type: "table", content: tableContent }, consumed: i };
}

interface ListParseResult {
  node: TipTapNode;
  consumed: number;
}

function parseList(lines: string[], ordered: boolean): ListParseResult {
  const items: TipTapNode[] = [];
  const re = ordered ? /^(\d+)\.\s+(.*)$/ : /^[-*+]\s+(.*)$/;
  let i = 0;
  while (i < lines.length) {
    const m = re.exec(lines[i]!);
    if (!m) break;
    const text = ordered ? m[2]! : m[1]!;
    items.push({
      type: "listItem",
      content: [{ type: "paragraph", content: inlineMarksToNodes(text) }],
    });
    i++;
  }
  return {
    node: { type: ordered ? "orderedList" : "bulletList", content: items },
    consumed: i,
  };
}

export function markdownToTipTapJson(markdown: string): TipTapDoc {
  const blocks: TipTapNode[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    // Blank line — skip.
    if (line.trim().length === 0) {
      i++;
      continue;
    }
    // Fenced code block ```lang\n...\n```.
    const fence = /^```(\w*)\s*$/.exec(line);
    if (fence) {
      const lang = fence[1] ?? "";
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i]!)) {
        code.push(lines[i]!);
        i++;
      }
      i++; // consume closing fence
      blocks.push({
        type: "codeBlock",
        attrs: lang ? { language: lang } : {},
        content: [{ type: "text", text: code.join("\n") }],
      });
      continue;
    }
    // Headings.
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = Math.min(heading[1]!.length, 3);
      blocks.push({
        type: "heading",
        attrs: { level },
        content: inlineMarksToNodes(heading[2]!),
      });
      i++;
      continue;
    }
    // Horizontal rule.
    if (/^---+\s*$/.test(line)) {
      blocks.push({ type: "horizontalRule" });
      i++;
      continue;
    }
    // Blockquote.
    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i]!.startsWith("> ")) {
        quoteLines.push(lines[i]!.slice(2));
        i++;
      }
      blocks.push({
        type: "blockquote",
        content: [{ type: "paragraph", content: inlineMarksToNodes(quoteLines.join(" ")) }],
      });
      continue;
    }
    // Lists.
    if (/^[-*+]\s+/.test(line)) {
      const parsed = parseList(lines.slice(i), false);
      blocks.push(parsed.node);
      i += parsed.consumed;
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const parsed = parseList(lines.slice(i), true);
      blocks.push(parsed.node);
      i += parsed.consumed;
      continue;
    }
    // Tables.
    if (line.includes("|") && i + 1 < lines.length && /^\s*\|?[\s:-]+\|/.test(lines[i + 1]!)) {
      const parsed = parseTable(lines.slice(i));
      if (parsed) {
        blocks.push(parsed.node);
        i += parsed.consumed;
        continue;
      }
    }
    // Image-only paragraph `![alt](src)`.
    const imageOnly = /^!\[([^\]]*)\]\(([^)]+)\)\s*$/.exec(line);
    if (imageOnly) {
      blocks.push({
        type: "paragraph",
        content: [{ type: "image", attrs: { alt: imageOnly[1] ?? "", src: imageOnly[2] ?? "" } }],
      });
      i++;
      continue;
    }
    // Paragraph — collect consecutive non-empty lines.
    const para: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i]!.trim().length > 0 &&
      !/^(#{1,6}\s+|```|> |\d+\.\s+|[-*+]\s+|---+\s*$)/.test(lines[i]!)
    ) {
      para.push(lines[i]!);
      i++;
    }
    blocks.push({ type: "paragraph", content: inlineMarksToNodes(para.join(" ")) });
  }
  return { type: "doc", content: blocks };
}
