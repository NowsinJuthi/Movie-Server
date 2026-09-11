"use client";

import { hasMinimumRole, UserRole } from "@movie-server/shared";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { useProfileStore } from "@/stores/profile-store";
import { subscriptionApi } from "@/lib/subscription-api";
import { homeApi } from "@/lib/home-api";
import { Button } from "@/components/ui/button";
import { ScreenMessage } from "@/components/profiles/pin-dialog";
import { HeroBanner } from "@/components/home/hero-banner";
import { MediaCarousel } from "@/components/home/media-carousel";
import { LazyMount } from "@/components/home/lazy-mount";
import { useMyListToggle } from "@/components/home/use-my-list";

export default function AppHomePage() {
  const router = useRouter();
  const { user, status } = useAuthStore();
  const profile = useProfileStore((state) => state.activeProfile);

  const entitlementQuery = useQuery({
    queryKey: ["subscription-entitlement"],
    queryFn: subscriptionApi.entitlement,
    enabled: status === "authenticated",
  });
  const entitled = Boolean(entitlementQuery.data?.entitlement.entitled);
  const staff = Boolean(user && hasMinimumRole(user.role, UserRole.Admin));
  const canBrowse = entitled || staff;
  const homeQuery = useQuery({
    queryKey: ["home", profile?.id],
    queryFn: homeApi.browse,
    enabled: canBrowse && Boolean(profile),
    staleTime: 45_000,
  });
  const listToggle = useMyListToggle(profile?.id);

  if (status === "loading" || status === "idle" || !user || !profile) {
    return <ScreenMessage>Loading your library...</ScreenMessage>;
  }

  return (
    <main className="min-h-screen bg-background">
      {!canBrowse ? (
        <section className="flex min-h-screen flex-col justify-end bg-gradient-to-t from-background to-black px-3 pb-24 pt-32 sm:px-4 md:px-5 lg:px-6">
          <h1 className="max-w-2xl text-4xl font-bold md:text-6xl">Unlimited movies and series, on your terms.</h1>
          <p className="mt-4 max-w-xl text-muted-foreground">
            Subscribe to start watching. Playback is authorized on the server for this profile.
          </p>
          <Button className="mt-6 w-fit" onClick={() => router.push("/subscribe")}>
            See plans
          </Button>
        </section>
      ) : homeQuery.isLoading ? (
        <HomeSkeleton />
      ) : homeQuery.isError ? (
        <section className="px-3 pb-10 pt-28 sm:px-4 md:px-5 lg:px-6">
          <h1 className="text-3xl font-semibold">Could not load your home feed</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {homeQuery.error instanceof Error ? homeQuery.error.message : "Please refresh and try again."}
          </p>
          <Button className="mt-6 w-fit" variant="outline" onClick={() => void homeQuery.refetch()}>
            Retry
          </Button>
        </section>
      ) : (
        <>
          {homeQuery.data?.hero || (homeQuery.data?.slider?.length ?? 0) > 0 ? (
            <HeroBanner
              card={homeQuery.data?.hero}
              cards={homeQuery.data?.slider?.length ? homeQuery.data.slider : undefined}
              onToggleList={listToggle.mutate}
            />
          ) : (
            <section className="px-3 pb-10 pt-28 sm:px-4 md:px-5 lg:px-6">
              <h1 className="text-3xl font-semibold">Welcome back, {profile.name}</h1>
              {(homeQuery.data?.rows.length ?? 0) === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {hasMinimumRole(user.role, UserRole.Admin)
                    ? "Add a media folder in Libraries and scan, or publish titles from Movies."
                    : "Nothing to watch yet."}
                </p>
              ) : null}
            </section>
          )}
          <div className="relative z-10 -mt-8 space-y-2 pb-16 md:-mt-16">
            {(homeQuery.data?.rows ?? []).map((row, index) => (
              <LazyMount key={row.id} eager={index < 4}>
                <MediaCarousel row={row} onToggleList={listToggle.mutate} listPending={listToggle.isPending} />
              </LazyMount>
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function HomeSkeleton() {
  return (
    <div className="pt-16">
      <div className="h-[56vw] animate-pulse bg-secondary lg:h-[42vw]" />
      <div className="space-y-8 px-3 py-8 sm:px-4 md:px-5 lg:px-6">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-40 animate-pulse rounded-md bg-secondary/70" />
        ))}
      </div>
    </div>
  );
}
