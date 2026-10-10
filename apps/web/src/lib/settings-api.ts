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
  uploadLogoLight: async (file: File) => {
    const body = new FormData();
    body.set("file", file);
    return apiFetch<{ settings: AdminSiteSettings }>("/admin/settings/logo/light", {
      method: "POST",
      body,
    });
  },
  uploadLogoDark: async (file: File) => {
    const body = new FormData();
    body.set("file", file);
    return apiFetch<{ settings: AdminSiteSettings }>("/admin/settings/logo/dark", {
      method: "POST",
      body,
    });
  },
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
  clearLogoLight: () =>
    apiFetch<{ settings: AdminSiteSettings }>("/admin/settings/logo/light", { method: "DELETE" }),
  clearLogoDark: () =>
    apiFetch<{ settings: AdminSiteSettings }>("/admin/settings/logo/dark", { method: "DELETE" }),
  clearLogo: () =>
    apiFetch<{ settings: AdminSiteSettings }>("/admin/settings/logo", { method: "DELETE" }),
  clearFavicon: () =>
    apiFetch<{ settings: AdminSiteSettings }>("/admin/settings/favicon", { method: "DELETE" }),
  testSmtp: (to: string) =>
    apiFetch<SmtpTestResult>("/admin/settings/smtp/test", {
      method: "POST",
      body: JSON.stringify({ to }),
    }),
  recommendedEmailDomains: () =>
    apiFetch<{ domains: string[] }>("/admin/settings/recommended-email-domains"),
  registrationEmailPolicy: () =>
    apiFetch<import("@movie-server/shared").PublicRegistrationEmailPolicy>(
      "/settings/registration-email-policy",
    ),
};

/** Cache-bust uploaded branding URLs after mutations. */
export function brandingAssetSrc(path: string | null | undefined, bust?: number | string) {
  if (!path) return null;
  const sep = path.includes("?") ? "&" : "?";
  return bust != null ? `${path}${sep}v=${bust}` : path;
}
