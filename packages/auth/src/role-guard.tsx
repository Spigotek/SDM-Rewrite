import type { ReactNode } from "react";
import {
  canAccessScreen,
  canEditScreen,
  hasPermission,
  type Permission,
  type ScreenId,
  type UIRole,
} from "@sdm/domain";

export interface CanProps {
  readonly roles: readonly UIRole[];
  readonly permission: Permission;
  readonly fallback?: ReactNode;
  readonly children: ReactNode;
}

export function Can({ roles, permission, fallback = null, children }: CanProps) {
  return hasPermission(roles, permission) ? <>{children}</> : <>{fallback}</>;
}

export interface RouteGuardProps {
  readonly roles: readonly UIRole[];
  readonly require: Permission;
  readonly onDenied: () => ReactNode;
  readonly children: ReactNode;
}

export function RouteGuard({ roles, require, onDenied, children }: RouteGuardProps) {
  return hasPermission(roles, require) ? <>{children}</> : <>{onDenied()}</>;
}

export interface ScreenGuardProps {
  readonly roles: readonly UIRole[];
  readonly screen: ScreenId;
  /** "view" lets readonly roles render; "edit" requires fully-visible access. */
  readonly mode?: "view" | "edit";
  readonly onDenied: () => ReactNode;
  readonly children: ReactNode;
}

export function ScreenGuard({
  roles,
  screen,
  mode = "view",
  onDenied,
  children,
}: ScreenGuardProps) {
  const allowed = mode === "edit" ? canEditScreen(roles, screen) : canAccessScreen(roles, screen);
  return allowed ? <>{children}</> : <>{onDenied()}</>;
}
