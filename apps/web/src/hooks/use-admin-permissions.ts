"use client";

import { useQuery } from "@tanstack/react-query";
import { hasMinimumRole, UserRole, type AdminPermissions, type PermissionKey } from "@movie-server/shared";
import { useAuthStore } from "@/stores/auth-store";
import { rolePermissionsApi } from "@/lib/role-permissions-api";

export function hasAdminPermission(
  permissions: AdminPermissions | undefined,
  key: PermissionKey,
): boolean {
  return Boolean(permissions?.[key]);
}

export function useAdminPermissions() {
  const { user, status } = useAuthStore();
  const isStaff = Boolean(user && hasMinimumRole(user.role, UserRole.Admin));

  const query = useQuery({
    queryKey: ["admin-permissions"],
    queryFn: rolePermissionsApi.me,
    enabled: status === "authenticated" && isStaff,
    staleTime: 60_000,
  });

  const can = (key: PermissionKey) => {
    if (user?.role === UserRole.SuperAdmin) return true;
    return hasAdminPermission(query.data, key);
  };

  return {
    permissions: query.data,
    isLoading: query.isLoading,
    can,
    canAccessAdminPanel: can("admin_panel_access"),
  };
}
