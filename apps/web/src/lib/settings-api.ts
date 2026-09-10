import type {
  AdminSiteSettings,
  PublicBranding,
  SmtpTestResult,
  UpdateSiteSettingsInput,
} from "@movie-server/shared";
import { apiFetch } from "./api";

export const settingsApi = {
  branding: () => apiFetch<PublicBranding>("/settings/branding"),
  get: () => apiFetch<{ settings: AdminSiteSettings }>("/admin/settings"),
  update: (input: UpdateSiteSettingsInput) =>
    apiFetch<{ settings: AdminSiteSettings }>("/admin/settings", {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  uploadLogo: async (file: File) => {
    const body = new FormData();
    body.set("file", file);
    return apiFetch<{ settings: AdminSiteSettings }>("/admin/settings/logo", {
      method: "POST",
      body,
    });
  },
  uploadFavicon: async (file: File) => {
    const body = new FormData();
    body.set("file", file);
    return apiFetch<{ settings: AdminSiteSettings }>("/admin/settings/favicon", {
      method: "POST",
      body,
    });
  },
  clearLogo: () =>
    apiFetch<{ settings: AdminSiteSettings }>("/admin/settings/logo", { method: "DELETE" }),
  clearFavicon: () =>
    apiFetch<{ settings: AdminSiteSettings }>("/admin/settings/favicon", { method: "DELETE" }),
  testSmtp: (to: string) =>
    apiFetch<SmtpTestResult>("/admin/settings/smtp/test", {
      method: "POST",
      body: JSON.stringify({ to }),
    }),
};

/** Cache-bust uploaded branding URLs after mutations. */
export function brandingAssetSrc(path: string | null | undefined, bust?: number | string) {
  if (!path) return null;
  const sep = path.includes("?") ? "&" : "?";
  return bust != null ? `${path}${sep}v=${bust}` : path;
}
