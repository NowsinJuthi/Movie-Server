import type {
  AdminLibrariesResponse,
  AdminLibraryItemsResponse,
  AdminLibraryResponse,
  AdminLibraryScanLogsResponse,
  AdminLibraryScanResponse,
  AdminLibraryScansResponse,
  LibraryItemStatus,
  LibraryKind,
  LibraryMatchType,
} from "@movie-server/shared";
import { apiFetch } from "./api";

export const libraryApi = {
  list: () => apiFetch<AdminLibrariesResponse>("/admin/libraries"),
  create: (body: { name: string; kind: LibraryKind; rootPath: string; enabled?: boolean; imageUrl?: string | null }) =>
    apiFetch<AdminLibraryResponse>("/admin/libraries", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: { name?: string; enabled?: boolean; rootPath?: string; imageUrl?: string | null }) =>
    apiFetch<AdminLibraryResponse>(`/admin/libraries/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: string) => apiFetch<{ deleted: boolean }>(`/admin/libraries/${id}`, { method: "DELETE" }),
  uploadImage: async (id: string, file: File) => {
    const body = new FormData();
    body.set("file", file);
    return apiFetch<AdminLibraryResponse>(`/admin/libraries/${id}/image`, { method: "POST", body });
  },
  items: (id: string, query: { status?: LibraryItemStatus; match?: LibraryMatchType; q?: string } = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    return apiFetch<AdminLibraryItemsResponse>(`/admin/libraries/${id}/items${qs ? `?${qs}` : ""}`);
  },
  startScan: (body: { libraryId?: string; full?: boolean } = {}) =>
    apiFetch<AdminLibraryScanResponse>("/admin/libraries/scans", { method: "POST", body: JSON.stringify(body) }),
  scans: () => apiFetch<AdminLibraryScansResponse>("/admin/libraries/scans"),
  scan: (id: string) => apiFetch<AdminLibraryScanResponse>(`/admin/libraries/scans/${id}`),
  cancel: (id: string) =>
    apiFetch<AdminLibraryScanResponse>(`/admin/libraries/scans/${id}/cancel`, { method: "POST" }),
  logs: (id: string) => apiFetch<AdminLibraryScanLogsResponse>(`/admin/libraries/scans/${id}/logs`),
};
