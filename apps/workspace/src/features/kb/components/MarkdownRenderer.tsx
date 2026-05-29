import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

/**
 * KB article body renderer — read-only, sanitized markdown. Mirror of
 * `apps/portal/src/features/kb/components/MarkdownRenderer.tsx` (H.6) and
 * `apps/workspace/src/features/changes/components/MarkdownRenderer.tsx` (H.9).
 *
 * Stack: `react-markdown` + `remark-gfm` + `rehype-sanitize` per
 * `owasp-mitigations.md §Markdown sanitizer whitelist`. The schema extends
 * `defaultSchema` to allow `className` on `code`/`pre` so syntax-highlight
 * wrappers survive — never the `unsafe` flag.
 *
 * Imported as a separate React.lazy chunk by `ArticleBody.tsx` so the
 * markdown stack lands in the `vendor-markdown` chunk and the workspace
 * shell + browse list pay zero markdown cost up front.
 */
const SCHEMA = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.["code"] ?? []), ["className", /^language-/]],
    pre: [...(defaultSchema.attributes?.["pre"] ?? []), ["className", /^language-/]],
  },
};

export default function MarkdownRenderer({ content }: { content: string }) {
  return (
    <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeSanitize, SCHEMA]]}>
      {content}
    </Markdown>
  );
}
