import type { ReactNode } from "react";
import { hasPermission } from "@sdm/domain";
import type { Permission, RoleCode } from "@sdm/domain";

export interface CanProps {
  readonly roles: readonly RoleCode[];
  readonly permission: Permission;
  readonly fallback?: ReactNode;
  readonly children: ReactNode;
}

export function Can({ roles, permission, fallback = null, children }: CanProps) {
  return hasPermission(roles, permission) ? <>{children}</> : <>{fallback}</>;
}

export interface RouteGuardProps {
  readonly roles: readonly RoleCode[];
  readonly require: Permission;
  readonly onDenied: () => ReactNode;
  readonly children: ReactNode;
}

export function RouteGuard({ roles, require, onDenied, children }: RouteGuardProps) {
  return hasPermission(roles, require) ? <>{children}</> : <>{onDenied()}</>;
}
