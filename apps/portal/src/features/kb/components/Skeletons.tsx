import { Skeleton } from "@sdm/design-system";

/**
 * KB search loading placeholders. K.3.E swap-in for the "Loading..." text
 * the route used to show — keeps the layout stable while the network
 * round-trip completes (CLS budget 0.05). Driven by the shared
 * `<Skeleton>` shimmer (off automatically under `prefers-reduced-motion`).
 */
export function SearchResultRowSkeleton() {
  return (
    <li className="sdm-kb-result-skeleton" aria-hidden="true">
      <Skeleton variant="text" width="60%" height={20} />
      <Skeleton variant="text" width="90%" height={14} />
      <Skeleton variant="text" width="40%" height={12} />
    </li>
  );
}

/**
 * Full-article skeleton — header + 4 body lines. Used while
 * `kbArticleQuery` is pending so the route doesn't collapse to a single
 * "Loading article..." line.
 */
export function ArticleSkeleton() {
  return (
    <div className="sdm-kb-article-skeleton" aria-hidden="true">
      <Skeleton variant="text" width="70%" height={32} />
      <Skeleton variant="text" width="40%" height={14} />
      <Skeleton variant="text" width="100%" height={14} count={4} />
    </div>
  );
}
