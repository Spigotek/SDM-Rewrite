import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

/**
 * Workspace markdown renderer — mirror of the portal H.6 implementation
 * (`apps/portal/src/features/kb/components/MarkdownRenderer.tsx`). Read-only,
 * sanitized markdown using `react-markdown` + `remark-gfm` + `rehype-sanitize`
 * per `owasp-mitigations.md §Markdown sanitizer whitelist`.
 *
 * Exported as a default React component so the parent can `React.lazy()` this
 * module — the markdown stack lands in the `vendor-markdown` chunk and the
 * rest of the workspace pays zero markdown cost up front.
 *
 * Never use the `unsafe` flag; the allowlist must be the only path from
 * authored content to the DOM. The schema extends `defaultSchema` to allow
 * `className` on `code`/`pre` so syntax-highlight wrappers survive — every
 * other element stays inside the default allowlist.
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
