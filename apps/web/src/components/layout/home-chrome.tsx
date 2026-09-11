"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { profileApi } from "@/lib/profile-api";
import { subscriptionApi } from "@/lib/subscription-api";
import { useAuthStore } from "@/stores/auth-store";
import { useProfileStore } from "@/stores/profile-store";

/** Fixed browse header shared across /home (and optional account) pages. */
export function HomeChrome({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useAuthStore();
  const { activeProfile, setActiveProfile } = useProfileStore();
  const [scrolled, setScrolled] = useState(true);

  const isWatchRoute = Boolean(pathname?.includes("/watch"));
  const isHomeHero = pathname === "/home";

  const activeQuery = useQuery({
    queryKey: ["active-profile"],
    queryFn: profileApi.active,
    enabled: status === "authenticated",
  });

  const entitlementQuery = useQuery({
    queryKey: ["subscription-entitlement"],
    queryFn: subscriptionApi.entitlement,
    enabled: status === "authenticated",
  });

  useEffect(() => {
    if (status === "anonymous") {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/home")}`);
    }
  }, [status, router, pathname]);

  useEffect(() => {
    if (!activeQuery.data) return;
    setActiveProfile(activeQuery.data.profile);
    if (
      !activeQuery.data.profile &&
      status === "authenticated" &&
      pathname?.startsWith("/home") &&
      !pathname.includes("/watch")
    ) {
      router.replace("/profiles");
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
      {children}
    </>
  );
}
