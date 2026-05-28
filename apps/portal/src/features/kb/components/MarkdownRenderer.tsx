import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

/**
 * KB article body renderer — read-only, sanitized markdown.
 *
 * Stack: `react-markdown` + `remark-gfm` + `rehype-sanitize` per
 * `owasp-mitigations.md §Markdown sanitizer whitelist` (synchronized with
 * `components.md §MarkdownRenderer` r2 final).
 *
 * The sanitization schema starts from `defaultSchema` (already strips
 * `script`, `style`, `iframe`, `form`, `object`, `embed`, every `on*`
 * attribute, and `javascript:` URIs) and extends it with `className` on
 * `code`/`pre` so syntax-highlight wrappers survive — every other element
 * stays inside the default allowlist. **Never** use the `unsafe` flag;
 * the allowlist must be the only path from authored content to the DOM.
 *
 * Imported as a separate React.lazy chunk by `ArticleBody.tsx` so the
 * search list (and every non-article portal route) pays zero markdown
 * bundle cost up front.
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
