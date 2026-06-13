import { Skeleton } from "@sdm/design-system";

/**
 * Loading placeholder for the changes table. Renders N skeleton rows at the
 * same 32-px density as the real table so the dashboard below doesn't shift
 * when the query resolves.
 */
export function ChangesTableSkeleton({ rows = 8 }: { readonly rows?: number }) {
  return (
    <div
      className="sdm-changes-table-skeleton"
      data-testid="changes-table-skeleton"
      aria-hidden="true"
    >
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="sdm-changes-skeleton-row">
          <Skeleton variant="text" width={64} height={14} />
          <Skeleton variant="text" width={48} height={14} />
          <Skeleton variant="text" width={96} height={14} />
          <Skeleton variant="text" width="40%" height={14} />
          <Skeleton variant="text" width={80} height={14} />
          <Skeleton variant="text" width={64} height={14} />
        </div>
      ))}
    </div>
  );
}
