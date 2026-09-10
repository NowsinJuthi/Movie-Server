"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useProfileStore } from "@/stores/profile-store";
import { profileApi } from "@/lib/profile-api";
import { subscriptionApi } from "@/lib/subscription-api";
import { Button } from "@/components/ui/button";
import { ScreenMessage } from "@/components/profiles/pin-dialog";
import { BrowseHeader } from "@/components/home/browse-header";

export function BrowseShell({
  heading,
  actions,
  children,
}: {
  heading: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const { user, status } = useAuthStore();
  const { activeProfile, setActiveProfile } = useProfileStore();
  const [scrolled, setScrolled] = useState(false);

  const activeQuery = useQuery({
    queryKey: ["active-profile"],
    queryFn: profileApi.active,
    enabled: status === "authenticated",
  });

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (activeQuery.data) {
      setActiveProfile(activeQuery.data.profile);
      if (!activeQuery.data.profile && status === "authenticated") {
        router.replace("/profiles");
      }
    }
  }, [activeQuery.data, setActiveProfile, router, status]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const profile = activeProfile ?? activeQuery.data?.profile ?? null;
  const entitlementQuery = useQuery({
    queryKey: ["subscription-entitlement"],
    queryFn: subscriptionApi.entitlement,
    enabled: status === "authenticated",
  });
  const entitled = Boolean(entitlementQuery.data?.entitlement.entitled);

  if (status === "loading" || status === "idle" || !user || !profile) {
    return <ScreenMessage>Loading your library...</ScreenMessage>;
  }

  const plan = entitlementQuery.data?.entitlement;
  const planLabel = plan?.entitled ? plan.planSlug?.toUpperCase() ?? "Plan" : "Subscribe";

  return (
    <main className="min-h-screen bg-background">
      <BrowseHeader profile={profile} planLabel={planLabel} scrolled={scrolled} />
      <section className="px-3 pb-24 pt-24 sm:px-4 md:px-5 lg:px-6">
        <div className="space-y-6 rounded-xl border border-border bg-card/40 p-4 sm:p-5">
        {!entitled ? (
          <div className="max-w-xl space-y-4">
            <h1 className="text-2xl font-semibold sm:text-3xl">{heading}</h1>
            <p className="text-sm text-muted-foreground">Subscribe to use watch history and personalization.</p>
            <Button onClick={() => router.push("/subscribe")}>See plans</Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h1 className="text-2xl font-semibold sm:text-3xl">{heading}</h1>
              {actions}
            </div>
            {children}
          </>
        )}
        </div>
      </section>
    </main>
  );
}
