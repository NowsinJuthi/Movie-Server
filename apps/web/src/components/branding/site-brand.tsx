"use client";

import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, type ReactNode } from "react";
import type { PublicBranding } from "@movie-server/shared";
import { DEFAULT_PUBLIC_BRANDING, brandingHeadLinks } from "@/lib/branding-head";
import { brandingAssetSrc, settingsApi } from "@/lib/settings-api";

const DEFAULT = DEFAULT_PUBLIC_BRANDING;

const BrandingContext = createContext<PublicBranding>(DEFAULT);

export function useBranding() {
  return useContext(BrandingContext);
}

/** React-owned head nodes only — never mutate document.head imperatively (breaks React 19 hoistables). */
function FaviconAndTitle({ branding }: { branding: PublicBranding }) {
  const head = brandingHeadLinks(branding);
  return (
    <>
      <title>{head.title}</title>
      {head.icons.map((icon) => (
        <link key={icon.key} rel={icon.rel} href={icon.href} sizes={icon.sizes} type={icon.type} />
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
      <FaviconAndTitle branding={branding} />
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
  const { siteName, logoUrl } = useBranding();
  const src = brandingAssetSrc(logoUrl);
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
