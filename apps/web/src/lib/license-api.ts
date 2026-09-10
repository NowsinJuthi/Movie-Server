import type { LicenseActivateResponse, LicenseStatusResponse } from "@movie-server/shared";
import { apiFetch } from "./api";

export const licenseApi = {
  status: () => apiFetch<LicenseStatusResponse>("/license/status"),
  activate: (licenseKey: string) =>
    apiFetch<LicenseActivateResponse>("/license/activate", {
      method: "POST",
      body: JSON.stringify({ licenseKey }),
    }),
};
