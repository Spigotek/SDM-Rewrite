/**
 * `routeGuard()` — wrap a lazily-loaded route component with `<RouteGuard>`
 * permission gating sourced from the active session.
 *
 * Usage in `createBrowserRouter(...)`:
 *
 *   { path: "tickets", lazy: () => guardedLazy(import("./placeholders/tickets"), "incident.read.own") }
 *
 * Returns a React component (not an element) so React Router can render it
 * directly. When `permission` is omitted the helper returns the bare
 * component — useful for anonymous-accessible routes like `/`.
 */

import type { Permission } from "@sdm/domain";
import { RouteGuard } from "@sdm/auth";
import { ForbiddenElement } from "./error-boundaries";
import { useSession } from "../shell/session-context";

type LazyImport = Promise<{ default: React.ComponentType }>;
type LazyModule = { Component: React.ComponentType };

export function withGuard(
  Component: React.ComponentType,
  permission?: Permission,
): React.ComponentType {
  if (!permission) return Component;
  return function Guarded() {
    const { session } = useSession();
    const roles = session?.roles ?? [];
    return (
      <RouteGuard roles={roles} require={permission} onDenied={() => <ForbiddenElement />}>
        <Component />
      </RouteGuard>
    );
  };
}

/**
 * Adapter for React Router's `lazy:` API — converts a default-export module
 * into the `{ Component }` shape expected by the data router, and wraps it
 * with `<RouteGuard>` when a permission is provided.
 */
export async function guardedLazy(
  module: LazyImport,
  permission?: Permission,
): Promise<LazyModule> {
  const { default: Component } = await module;
  return { Component: withGuard(Component, permission) };
}
