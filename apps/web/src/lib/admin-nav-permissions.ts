import type { PermissionKey } from "@movie-server/shared";

/** Minimum permission required to open an admin route. */
export const ADMIN_ROUTE_PERMISSIONS: Record<string, PermissionKey> = {
  "/admin": "dashboard_analytics",
  "/admin/menu": "admin_panel_access",
  "/admin/health": "manage_settings",
  "/admin/settings": "manage_settings",
  "/admin/settings/roles": "manage_roles_permissions",
  "/admin/license": "manage_license",
  "/admin/jobs": "manage_jobs",
  "/admin/audit": "view_audit_logs",
  "/admin/slider": "manage_home_curation",
  "/admin/users": "view_users",
  "/admin/profiles": "view_profiles",
  "/admin/plans": "manage_plans",
  "/admin/subscriptions": "view_subscriptions",
  "/admin/billing": "manage_billing",
  "/admin/movies": "view_movies",
  "/admin/series": "view_series",
  "/admin/collections": "manage_collections",
  "/admin/series-collections": "manage_collections",
  "/admin/tracks": "manage_genres_tags",
  "/admin/genres": "manage_genres_tags",
  "/admin/tags": "manage_genres_tags",
  "/admin/featured": "manage_home_curation",
  "/admin/home": "manage_home_curation",
  "/admin/libraries": "manage_libraries",
  "/admin/file-manager": "manage_smb_files",
  "/admin/sessions": "view_stream_sessions",
};

export function permissionForAdminRoute(href: string): PermissionKey {
  if (href.startsWith("/admin/menu/")) {
    return "manage_home_curation";
  }
  if (ADMIN_ROUTE_PERMISSIONS[href]) {
    return ADMIN_ROUTE_PERMISSIONS[href];
  }
  const match = Object.keys(ADMIN_ROUTE_PERMISSIONS)
    .filter((key) => key !== "/admin" && href.startsWith(`${key}/`))
    .sort((a, b) => b.length - a.length)[0];
  return match ? ADMIN_ROUTE_PERMISSIONS[match]! : "admin_panel_access";
}

/** Routes that open when the user has any one of these permissions. */
const ROUTE_ANY_PERMISSIONS: Partial<Record<string, PermissionKey[]>> = {
  "/admin/subscriptions": ["view_subscriptions", "manage_subscriptions"],
};

export function canAccessAdminRoute(
  href: string,
  can: (key: PermissionKey) => boolean,
): boolean {
  const any = ROUTE_ANY_PERMISSIONS[href];
  if (any?.some((key) => can(key))) {
    return true;
  }
  return can(permissionForAdminRoute(href));
}
