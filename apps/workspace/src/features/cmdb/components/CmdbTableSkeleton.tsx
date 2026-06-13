import { Skeleton } from "@sdm/design-system";

/**
 * Loading placeholder for the CMDB table. Mirrors the dense 32-px row layout
 * so the page below doesn't reflow when the query resolves.
 */
export function CmdbTableSkeleton({ rows = 10 }: { readonly rows?: number }) {
  return (
    <div className="sdm-cmdb-table-skeleton" data-testid="cmdb-table-skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="sdm-cmdb-skeleton-row">
          <Skeleton variant="text" width={120} height={14} />
          <Skeleton variant="text" width="35%" height={14} />
          <Skeleton variant="text" width={120} height={14} />
          <Skeleton variant="text" width={84} height={14} />
          <Skeleton variant="text" width={120} height={14} />
          <Skeleton variant="text" width={96} height={14} />
        </div>
      ))}
    </div>
  );
}
