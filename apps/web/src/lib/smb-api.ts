import type {
  AdminLibraryResponse,
  AdminSmbBrowseResponse,
  AdminSmbServerResponse,
  AdminSmbServersResponse,
  AdminSmbTestResponse,
  AdminSmbUploadResponse,
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
  saveCredentials: (id: string, password: string) =>
    apiFetch<AdminSmbServerResponse>(`/admin/smb-servers/${id}/credentials`, {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
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
  upload: (
    id: string,
    file: File,
    path = "",
    options: { scan?: boolean; onProgress?: (percent: number) => void } = {},
  ) =>
    new Promise<AdminSmbUploadResponse>((resolve, reject) => {
      const params = new URLSearchParams();
      if (path) params.set("path", path);
      if (options.scan === false) params.set("scan", "false");

      const xhr = new XMLHttpRequest();
      // Dedicated Next route streams to the API (avoids /api/v1 rewrite 10MB body limit).
      xhr.open("POST", `/api/smb-upload/${id}${params.size ? `?${params}` : ""}`);
      xhr.withCredentials = true;

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || !options.onProgress) return;
        options.onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      };

      xhr.onload = () => {
        let body: AdminSmbUploadResponse | { message?: string } | null = null;
        const text = xhr.responseText.trim();
        if (text) {
          try {
            body = JSON.parse(text) as AdminSmbUploadResponse | { message?: string };
          } catch {
            body = null;
          }
        }

        if (xhr.status >= 200 && xhr.status < 300 && body && "ok" in body && body.ok) {
          resolve(body);
          return;
        }

        const nested =
          body && "message" in body && typeof body.message === "string" ? body.message : null;
        const message =
          nested ||
          (xhr.status === 499 || xhr.status === 408
            ? "Upload was interrupted. Keep this page open until the upload completes."
            : `Upload failed (HTTP ${xhr.status}).`);
        reject(new Error(message));
      };

      xhr.onerror = () =>
        reject(
          new Error(
            "Upload failed — network error. Keep this page open and ensure the web and API servers are running.",
          ),
        );
      xhr.onabort = () => reject(new Error("Upload cancelled."));
      xhr.timeout = 0;

      const form = new FormData();
      form.set("file", file);
      xhr.send(form);
    }),
};
