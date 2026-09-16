"use client";

import { hasMinimumRole, UserRole } from "@movie-server/shared";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { LibraryBrowseFilters } from "@/components/browse/library-browse-filters";
import { MediaCard } from "@/components/home/media-card";
import { useMyListToggle } from "@/components/home/use-my-list";
import { ScreenMessage } from "@/components/profiles/pin-dialog";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import {
  filterAndSortLibraryItems,
  readLibraryBrowseFilters,
  type LibraryBrowseFilters as LibraryBrowseFilterState,
} from "@/lib/library-browse-filters";
import { publicLibraryApi } from "@/lib/public-library-api";
import { subscriptionApi } from "@/lib/subscription-api";
import { useAuthStore } from "@/stores/auth-store";
import { useProfileStore } from "@/stores/profile-store";

export function LibraryBrowseClient() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, status } = useAuthStore();
  const profile = useProfileStore((state) => state.activeProfile);

  const filters = useMemo(() => readLibraryBrowseFilters(searchParams), [searchParams]);

  const updateFilters = useCallback(
    (next: Partial<LibraryBrowseFilterState>) => {
      const merged = { ...filters, ...next };
      const params = new URLSearchParams();
      if (merged.q) params.set("q", merged.q);
      if (merged.genre) params.set("genre", merged.genre);
      if (merged.year) params.set("year", String(merged.year));
      if (merged.minRating != null) params.set("minRating", String(merged.minRating));
      if (merged.sort) params.set("sort", merged.sort);
      const query = params.toString();
      router.replace(query ? `/home/library/${id}?${query}` : `/home/library/${id}`, { scroll: false });
    },
    [filters, id, router],
  );

  const clearFilters = useCallback(() => {
    router.replace(`/home/library/${id}`, { scroll: false });
  }, [id, router]);

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

  const library = browseQuery.data?.library;
  const items = browseQuery.data?.items ?? [];
  const filteredItems = useMemo(() => filterAndSortLibraryItems(items, filters), [items, filters]);

  if (status === "loading" || status === "idle" || !user || !profile) {
    return <ScreenMessage>Loading your library...</ScreenMessage>;
  }

  return (
    <main className="min-h-screen w-full bg-background">
      {!canBrowse ? (
        <section className="flex min-h-[calc(100vh-4rem)] flex-col justify-center px-3 pb-24 pt-24 sm:px-4 md:px-5 lg:px-6">
          <div className="mx-auto w-full max-w-xl space-y-4">
            <h1 className="text-3xl font-semibold sm:text-4xl">{library?.name ?? "Library"}</h1>
            <p className="text-sm text-muted-foreground">Subscribe to browse this media library.</p>
            <Button onClick={() => router.push("/subscribe")}>See plans</Button>
          </div>
        </section>
      ) : (
        <>
          <section className="px-3 pb-4 pt-24 sm:px-4 md:px-5 lg:px-6">
            <h1 className="text-xl font-semibold text-[#f8fafc] md:text-2xl">
              {library?.name ?? "Library"}
            </h1>
          </section>

          <section className="w-full space-y-6 px-3 pb-24 sm:px-4 md:px-5 lg:px-6">
            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            {!browseQuery.data && !error ? (
              <p className="text-sm text-muted-foreground">Loading titles...</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No published titles in this library yet. Scan the library in Admin and publish matches.
              </p>
            ) : (
              <>
                <LibraryBrowseFilters
                  items={items}
                  filters={filters}
                  onChange={updateFilters}
                  onClear={clearFilters}
                />

                {filteredItems.length === 0 ? (
                  <div className="rounded-xl border border-[rgb(14_40_50/0.72)] bg-[linear-gradient(180deg,rgb(3_26_34/0.98)_0%,rgb(1_19_26/0.99)_100%)] px-4 py-10 text-center">
                    <p className="text-sm text-[rgb(148_163_184/0.85)]">No titles match your filters.</p>
                    <Button className="mt-4" variant="outline" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  </div>
                ) : (
                  <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
                    {filteredItems.map((card) => (
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
              </>
            )}
          </section>
        </>
      )}
    </main>
  );
}
