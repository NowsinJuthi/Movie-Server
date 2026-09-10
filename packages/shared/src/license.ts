export const LICENSE_TRIAL_DAYS = 30;

export type LicenseEdition = "trial" | "standard" | "pro";

export type LicenseStatusResponse = {
  ok: boolean;
  mode: "licensed" | "trial" | "locked";
  edition: LicenseEdition | null;
  licensed: boolean;
  trial: boolean;
  locked: boolean;
  installId: string;
  installedAt: string;
  trialEndsAt: string;
  trialDaysRemaining: number;
  licenseExpiresAt: string | null;
  activatedAt: string | null;
  message: string;
};

export type LicenseActivateResponse = {
  ok: boolean;
  status: LicenseStatusResponse;
};
