export const LICENSE_TRIAL_DAYS = 30;

/** Signed AmarPin license keys use this prefix (CV1.<payload>.<sig>). */
export const LICENSE_KEY_PREFIX = "CV1";

export function normalizeLicenseKeyInput(raw: string): string {
  return raw.trim().replace(/\s+/g, "");
}

/** Central license manager keys (license.amarpin.com), e.g. AMP-PRO-…. */
export function looksLikeCentralLicenseKey(raw: string): boolean {
  return /^AMP-[A-Z0-9]+(?:-[A-Z0-9]+)+$/i.test(normalizeLicenseKeyInput(raw));
}

/** @deprecated Use looksLikeCentralLicenseKey — same AMP- format. */
export function looksLikeProductSkuKey(raw: string): boolean {
  return looksLikeCentralLicenseKey(raw);
}

export function looksLikeSignedLicenseKey(raw: string): boolean {
  const normalized = normalizeLicenseKeyInput(raw);
  const parts = normalized.split(".");
  return parts.length === 3 && parts[0] === LICENSE_KEY_PREFIX;
}

/** Accept keys from license.amarpin.com (AMP-…) or offline CV1.… keys. */
export function isSupportedLicenseKeyFormat(raw: string): boolean {
  const normalized = normalizeLicenseKeyInput(raw);
  return looksLikeCentralLicenseKey(normalized) || looksLikeSignedLicenseKey(normalized);
}

export const LICENSE_KEY_FORMAT_HINT =
  "Enter your license.amarpin.com key (AMP-PRO-…) or a self-hosted CV1. key (three dot-separated parts).";

export const LICENSE_KEY_SKU_ERROR =
  "Enter a valid AMP-PRO-… key from license.amarpin.com, or a signed CV1. key for self-hosted installs.";

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
  /** True when a license key is bound to this install (may deactivate from admin). */
  canDeactivate: boolean;
  message: string;
};

export type LicenseActivateResponse = {
  ok: boolean;
  status: LicenseStatusResponse;
};
