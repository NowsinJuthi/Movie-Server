import type { PublicBranding } from "@movie-server/shared";
import { brandingAssetSrc } from "@/lib/settings-api";

/** Pick logo URL for the active color scheme (with cross-theme fallback). */
export function resolveThemeLogoUrl(
  branding: Pick<PublicBranding, "logoLightUrl" | "logoDarkUrl" | "logoUrl">,
  theme: "light" | "dark" | undefined,
): string | null {
  const isDark = theme === "dark";
  if (isDark) {
    return branding.logoDarkUrl ?? branding.logoLightUrl ?? branding.logoUrl;
  }
  return branding.logoLightUrl ?? branding.logoDarkUrl ?? branding.logoUrl;
}

export function themeLogoSrc(
  branding: Pick<PublicBranding, "logoLightUrl" | "logoDarkUrl" | "logoUrl">,
  theme: "light" | "dark" | undefined,
  bust?: number | string,
) {
  return brandingAssetSrc(resolveThemeLogoUrl(branding, theme), bust);
}
