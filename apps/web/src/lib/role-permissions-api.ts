import type {
  AdminPermissions,
  RolePermissionProfile,
  RolePermissionsOverview,
} from "@movie-server/shared";
import { apiFetch } from "./api";

export const rolePermissionsApi = {
  me: () => apiFetch<AdminPermissions>("/role-permissions/me"),

  overview: () => apiFetch<RolePermissionsOverview>("/role-permissions/admin"),

  updateRole: (roleId: string, permissions: Record<string, boolean>) =>
    apiFetch<RolePermissionProfile>(`/role-permissions/admin/roles/${encodeURIComponent(roleId)}`, {
      method: "PATCH",
      body: JSON.stringify({ permissions }),
    }),

  resetRole: (roleId: string) =>
    apiFetch<RolePermissionProfile>(
      `/role-permissions/admin/roles/${encodeURIComponent(roleId)}/reset`,
      { method: "POST" },
    ),

  resetAll: () =>
    apiFetch<RolePermissionsOverview>("/role-permissions/admin/reset", { method: "POST" }),
};
