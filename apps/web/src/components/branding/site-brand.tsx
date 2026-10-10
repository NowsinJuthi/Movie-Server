"use client";

import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { createContext, useContext, type ReactNode } from "react";
import type { PublicBranding } from "@movie-server/shared";
import { DEFAULT_PUBLIC_BRANDING, brandingHeadLinks } from "@/lib/branding-head";
import { settingsApi } from "@/lib/settings-api";
import { themeLogoSrc } from "@/lib/theme-logo";

const DEFAULT = DEFAULT_PUBLIC_BRANDING;

const BrandingContext = createContext<PublicBranding>(DEFAULT);

export function useBranding() {
  return useContext(BrandingContext);
}

/** Logo for the current light/dark theme (from System settings uploads). */
export function useThemeLogo(bust?: number | string) {
  const branding = useBranding();
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? "dark" : resolvedTheme === "light" ? "light" : undefined;
  return themeLogoSrc(branding, theme, bust);
}

/** React-owned head nodes only — never mutate document.head imperatively (breaks React 19 hoistables). */
function faviconHref(base: string, bust?: number) {
  if (base !== "/favicon.ico" || bust == null) return base;
  return `/favicon.ico?v=${bust}`;
}

function FaviconAndTitle({ branding, faviconBust }: { branding: PublicBranding; faviconBust?: number }) {
  const head = brandingHeadLinks(branding);
  return (
    <>
      <title>{head.title}</title>
      {head.icons.map((icon) => (
        <link
          key={icon.key}
          rel={icon.rel}
          href={faviconHref(icon.href, branding.faviconUrl ? faviconBust : undefined)}
          sizes={icon.sizes}
          type={icon.type}
        />
      ))}
    </>
  );
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const query = useQuery({
    queryKey: ["public-branding"],
    queryFn: settingsApi.branding,
    staleTime: 60_000,
  });
  const branding = query.data ?? DEFAULT;

  return (
    <BrandingContext.Provider value={branding}>
      <FaviconAndTitle branding={branding} faviconBust={query.dataUpdatedAt} />
      {children}
    </BrandingContext.Provider>
  );
}

export function SiteBrand({
  className,
  href,
  showAdminSuffix = false,
}: {
  className?: string;
  href?: string;
  showAdminSuffix?: boolean;
}) {
  const { siteName } = useBranding();
  const src = useThemeLogo();
  const content = (
    <>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={siteName} className="h-9 w-auto max-w-[180px] object-contain sm:h-10 sm:max-w-[200px]" />
      ) : (
        <span>
          {siteName}
          {showAdminSuffix ? <span className="opacity-70"> Admin</span> : null}
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <a href={href} className={className}>
        {content}
      </a>
    );
  }
  return <span className={className}>{content}</span>;
}
