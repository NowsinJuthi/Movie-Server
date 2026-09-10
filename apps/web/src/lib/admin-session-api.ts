import { ADMIN_ROUTES, type AdminSessionMonitor } from "@movie-server/shared";
import { apiFetch } from "./api";

export const adminSessionApi = {
  monitor: () => apiFetch<AdminSessionMonitor>(ADMIN_ROUTES.Sessions),
  revokeSession: (id: string) =>
    apiFetch<{ revoked: boolean }>(ADMIN_ROUTES.RevokeSession.replace(":id", id), {
      method: "DELETE",
    }),
  revokeDevice: (id: string) =>
    apiFetch<{ revoked: boolean }>(ADMIN_ROUTES.RevokeDevice.replace(":id", id), {
      method: "DELETE",
    }),
};
