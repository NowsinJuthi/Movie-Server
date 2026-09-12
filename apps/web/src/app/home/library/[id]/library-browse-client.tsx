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
      if (merged.quality) params.set("quality", merged.quality);
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
  const isTvLibrary = library?.kind === "tv";
  const filteredItems = useMemo(() => filterAndSortLibraryItems(items, filters), [items, filters]);

  if (status === "loading" || status === "idle" || !user || !profile) {
    return <ScreenMessage>Loading your library...</ScreenMessage>;
  }

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
          <div className="mx-auto max-w-[1400px] space-y-6">
            <div>
              <p className="text-sm uppercase tracking-wide text-muted-foreground">
                {isTvLibrary ? "TV Shows" : "Movies"}
              </p>
              <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">{library?.name ?? "Library"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Browse titles from this media library. Use filters to narrow the list.
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
              <>
                <LibraryBrowseFilters
                  items={items}
                  isTvLibrary={isTvLibrary}
                  filters={filters}
                  onChange={updateFilters}
                  onClear={clearFilters}
                  filteredCount={filteredItems.length}
                  totalCount={items.length}
                />

                {filteredItems.length === 0 ? (
                  <div className="rounded-xl border border-border/80 bg-card/30 px-4 py-10 text-center">
                    <p className="text-sm text-muted-foreground">No titles match your filters.</p>
                    <Button className="mt-4" variant="outline" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
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
          </div>
        )}
      </section>
    </main>
  );
}
