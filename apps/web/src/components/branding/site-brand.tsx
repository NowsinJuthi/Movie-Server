"use client";

import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { PublicBranding } from "@movie-server/shared";
import { brandingAssetSrc, settingsApi } from "@/lib/settings-api";

const DEFAULT: PublicBranding = {
  siteName: "CineVault",
  logoUrl: null,
  faviconUrl: null,
};

const BrandingContext = createContext<PublicBranding>(DEFAULT);

export function useBranding() {
  return useContext(BrandingContext);
}

function FaviconAndTitle({ branding }: { branding: PublicBranding }) {
  useEffect(() => {
    document.title = branding.siteName;

    const href = brandingAssetSrc(branding.faviconUrl, branding.siteName);
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!href) {
      if (link) link.remove();
      return;
    }
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = href;
  }, [branding.faviconUrl, branding.siteName]);

  return null;
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
        <img src={src} alt={siteName} className="h-7 w-auto max-w-[160px] object-contain" />
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
