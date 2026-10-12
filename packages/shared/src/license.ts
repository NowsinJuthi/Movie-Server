export const LICENSE_TRIAL_DAYS = 30;

/** Signed AmarPin license keys use this prefix (CV1.<payload>.<sig>). */
export const LICENSE_KEY_PREFIX = "CV1";

export function normalizeLicenseKeyInput(raw: string): string {
  return raw.trim().replace(/\s+/g, "");
}

/** Product SKU style codes (AMP-PRO-…) are not cryptographic license keys. */
export function looksLikeProductSkuKey(raw: string): boolean {
  return /^AMP-/i.test(normalizeLicenseKeyInput(raw));
}

export function looksLikeSignedLicenseKey(raw: string): boolean {
  const normalized = normalizeLicenseKeyInput(raw);
  const parts = normalized.split(".");
  return parts.length === 3 && parts[0] === LICENSE_KEY_PREFIX;
}

export const LICENSE_KEY_SKU_ERROR =
  "This AMP- code is not an AmarPin license key. Ask your vendor for a signed key that starts with CV1. (three parts separated by dots), or generate one on the server with scripts/generate-license.mjs.";

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
