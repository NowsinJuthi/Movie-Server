"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { PwaInstallPrompt } from "@/components/layout/pwa-install-prompt";
import { cn } from "@/lib/utils";
import { profileApi } from "@/lib/profile-api";
import { subscriptionApi } from "@/lib/subscription-api";
import { useAuthStore } from "@/stores/auth-store";
import { useProfileStore } from "@/stores/profile-store";

/** Fixed browse header shared across /home (and optional account) pages. */
export function HomeChrome({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status, user } = useAuthStore();
  const { activeProfile, setActiveProfile } = useProfileStore();
  const [scrolled, setScrolled] = useState(true);

  const isWatchRoute = Boolean(pathname?.includes("/watch"));
  const isHomeHero = pathname === "/home";

  const activeQuery = useQuery({
    queryKey: ["active-profile"],
    queryFn: profileApi.active,
    enabled: Boolean(user),
  });

  const entitlementQuery = useQuery({
    queryKey: ["subscription-entitlement"],
    queryFn: subscriptionApi.entitlement,
    enabled: Boolean(user),
  });

  useEffect(() => {
    if (status === "anonymous") {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/home")}`);
    }
  }, [status, router, pathname]);

  useEffect(() => {
    if (!activeQuery.data) return;
    setActiveProfile(activeQuery.data.profile);
    if (!activeQuery.data.profile && status === "authenticated" && pathname?.startsWith("/home")) {
      const next =
        pathname.includes("/watch") ? `?next=${encodeURIComponent(pathname)}` : "";
      router.replace(`/profiles${next}`);
    }
  }, [activeQuery.data, setActiveProfile, router, status, pathname]);

  useEffect(() => {
    if (isWatchRoute) return;
    if (!isHomeHero) {
      setScrolled(true);
      return;
    }
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHomeHero, isWatchRoute]);

  const profile = activeProfile ?? activeQuery.data?.profile ?? null;
  const plan = entitlementQuery.data?.entitlement;
  const planLabel = plan?.entitled
    ? plan.planSlug?.toUpperCase() ?? "Plan"
    : "Subscribe";

  return (
    <>
      {!isWatchRoute ? (
        <AppHeader profile={profile} planLabel={planLabel} scrolled={scrolled} variant="browse" />
      ) : null}
      <div
        className={cn(
          !isWatchRoute && "pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:pb-0",
        )}
      >
        {children}
      </div>
      {!isWatchRoute ? (
        <>
          <PwaInstallPrompt />
          <MobileNav />
        </>
      ) : null}
    </>
  );
}
