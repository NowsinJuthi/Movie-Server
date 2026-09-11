"use client";

import { hasMinimumRole, UserRole } from "@movie-server/shared";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { MediaCard } from "@/components/home/media-card";
import { useMyListToggle } from "@/components/home/use-my-list";
import { ScreenMessage } from "@/components/profiles/pin-dialog";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { publicLibraryApi } from "@/lib/public-library-api";
import { subscriptionApi } from "@/lib/subscription-api";
import { useAuthStore } from "@/stores/auth-store";
import { useProfileStore } from "@/stores/profile-store";

export default function LibraryBrowsePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
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

  const browseQuery = useQuery({
    queryKey: ["public-library", id],
    queryFn: () => publicLibraryApi.browse(id),
    enabled: canBrowse && Boolean(profile) && Boolean(id),
  });

  const listToggle = useMyListToggle(profile?.id);
  const error = browseQuery.error instanceof ApiError ? browseQuery.error.message : null;

  if (status === "loading" || status === "idle" || !user || !profile) {
    return <ScreenMessage>Loading your library...</ScreenMessage>;
  }

  const library = browseQuery.data?.library;
  const items = browseQuery.data?.items ?? [];

  return (
    <main className="min-h-screen bg-background">
      <section className="px-3 pb-24 pt-24 sm:px-4 md:px-5 lg:px-6">
        {!canBrowse ? (
          <div className="mx-auto max-w-xl space-y-4 pt-8">
            <h1 className="text-2xl font-semibold sm:text-3xl">{library?.name ?? "Library"}</h1>
            <p className="text-sm text-muted-foreground">Subscribe to browse this media library.</p>
            <Button onClick={() => router.push("/subscribe")}>See plans</Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <p className="text-sm uppercase tracking-wide text-muted-foreground">
                {library?.kind === "tv" ? "TV Shows" : "Movies"}
              </p>
              <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">{library?.name ?? "Library"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Titles matched from this media library directory.
              </p>
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            {!browseQuery.data && !error ? (
              <p className="text-sm text-muted-foreground">Loading titles...</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No published titles in this library yet. Scan the library in Admin and publish matches.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {items.map((card) => (
                  <div key={`${card.kind}-${card.id}`} className="w-full min-w-0 [&_article]:w-full">
                    <MediaCard
                      card={card}
                      onToggleList={listToggle.mutate}
                      listPending={listToggle.isPending}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
