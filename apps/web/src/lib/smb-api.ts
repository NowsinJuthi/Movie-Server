import type {
  AdminLibraryResponse,
  AdminSmbBrowseResponse,
  AdminSmbServerResponse,
  AdminSmbServersResponse,
  AdminSmbTestResponse,
  LibraryKind,
} from "@movie-server/shared";
import { apiFetch } from "./api";

export type UpsertSmbServerInput = {
  name: string;
  host: string;
  port?: number;
  username: string;
  password: string;
  domain?: string;
  share: string;
  enabled?: boolean;
};

export const smbApi = {
  list: () => apiFetch<AdminSmbServersResponse>("/admin/smb-servers"),
  create: (body: UpsertSmbServerInput) =>
    apiFetch<AdminSmbServerResponse>("/admin/smb-servers", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: Partial<UpsertSmbServerInput>) =>
    apiFetch<AdminSmbServerResponse>(`/admin/smb-servers/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: string) => apiFetch<{ deleted: boolean }>(`/admin/smb-servers/${id}`, { method: "DELETE" }),
  test: (id: string) =>
    apiFetch<AdminSmbTestResponse>(`/admin/smb-servers/${id}/test`, { method: "POST" }),
  browse: (id: string, path = "") => {
    const qs = path ? `?path=${encodeURIComponent(path)}` : "";
    return apiFetch<AdminSmbBrowseResponse>(`/admin/smb-servers/${id}/browse${qs}`);
  },
  addLibrary: (body: { serverId: string; path: string; name: string; kind: LibraryKind }) =>
    apiFetch<AdminLibraryResponse>("/admin/smb-servers/libraries", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
