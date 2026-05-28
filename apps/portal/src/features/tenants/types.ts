import type { TenantEnvironment } from "../../bootstrap/session";

export type { TenantEnvironment };

/**
 * The mutation hook + switcher operate on the same TenantOption shape that
 * `useSession()` exposes. The session-context module owns the canonical
 * declaration; this file just re-exports the relevant aliases so feature code
 * doesn't need to reach into `shell/`.
 */
