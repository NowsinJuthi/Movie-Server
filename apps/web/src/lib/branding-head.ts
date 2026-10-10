import type { Metadata } from "next";
import type { PublicBranding } from "@movie-server/shared";

export const DEFAULT_PUBLIC_BRANDING: PublicBranding = {
  siteName: "AmarPin",
  logoLightUrl: null,
  logoDarkUrl: null,
  logoUrl: null,
  faviconUrl: null,
};

export async function loadPublicBranding(): Promise<PublicBranding> {
  const api = process.env.API_INTERNAL_URL || "http://127.0.0.1:4000";
  try {
    const res = await fetch(`${api}/api/v1/settings/branding`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return DEFAULT_PUBLIC_BRANDING;
    return (await res.json()) as PublicBranding;
  } catch {
    return DEFAULT_PUBLIC_BRANDING;
  }
}

export function brandingIcons(branding: PublicBranding): NonNullable<Metadata["icons"]> {
  if (branding.faviconUrl) {
    return {
      icon: [{ url: "/favicon.ico" }],
      apple: [{ url: "/favicon.ico", sizes: "180x180" }],
      shortcut: "/favicon.ico",
    };
  }

  return {
    icon: [
      { url: "/favicon.ico", sizes: "256x256", type: "image/x-icon" },
      { url: "/icon", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
    shortcut: "/favicon.ico",
  };
}

type BrandingHeadLink = {
  rel: "icon" | "apple-touch-icon" | "shortcut icon";
  href: string;
  key: string;
  sizes?: string;
  type?: string;
};

/** React 19 head nodes — must always include icon links or server metadata icons get stripped on hydrate. */
export function brandingHeadLinks(branding: PublicBranding): {
  title: string;
  icons: BrandingHeadLink[];
} {
  if (branding.faviconUrl) {
    const href = "/favicon.ico";
    return {
      title: branding.siteName,
      icons: [
        { rel: "icon", href, key: "icon-custom" },
        { rel: "apple-touch-icon", href, key: "apple-custom" },
        { rel: "shortcut icon", href, key: "shortcut-custom" },
      ],
    };
  }

  return {
    title: branding.siteName,
    icons: [
      {
        rel: "icon",
        href: "/favicon.ico",
        sizes: "256x256",
        type: "image/x-icon",
        key: "icon-ico",
      },
      {
        rel: "icon",
        href: "/icon",
        sizes: "512x512",
        type: "image/png",
        key: "icon-png",
      },
      {
        rel: "apple-touch-icon",
        href: "/apple-icon",
        sizes: "180x180",
        key: "apple-icon",
      },
    ],
  };
}
