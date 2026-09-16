"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useProfileStore } from "@/stores/profile-store";
import { subscriptionApi } from "@/lib/subscription-api";
import { Button } from "@/components/ui/button";
import { ScreenMessage } from "@/components/profiles/pin-dialog";

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
  const profile = useProfileStore((state) => state.activeProfile);

  const entitlementQuery = useQuery({
    queryKey: ["subscription-entitlement"],
    queryFn: subscriptionApi.entitlement,
    enabled: Boolean(user),
  });
  const entitled = Boolean(entitlementQuery.data?.entitlement.entitled);

  if (status === "loading") {
    return <ScreenMessage>Loading your library...</ScreenMessage>;
  }

  if (!user) {
    return <ScreenMessage>Redirecting to sign in...</ScreenMessage>;
  }

  if (!profile) {
    return <ScreenMessage>Loading your profile...</ScreenMessage>;
  }

  return (
    <main className="min-h-screen bg-background">
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
