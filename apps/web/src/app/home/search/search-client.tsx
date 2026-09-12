"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SearchKind, SearchQuery, SearchResponse, SearchSort } from "@movie-server/shared";
import { useAuthStore } from "@/stores/auth-store";
import { useProfileStore } from "@/stores/profile-store";
import { subscriptionApi } from "@/lib/subscription-api";
import { searchApi } from "@/lib/search-api";
import { ScreenMessage } from "@/components/profiles/pin-dialog";
import { FilterQuickPill } from "@/components/filters/filter-ui";
import { SearchFilters } from "@/components/search/search-filters";
import { EpisodeResults, PeopleResults, SearchGroupGrid } from "@/components/search/search-results";
import { MediaCarousel } from "@/components/home/media-carousel";
import { useMyListToggle } from "@/components/home/use-my-list";
import { HomeRowKind, HomeRowSource } from "@movie-server/shared";
import { Button } from "@/components/ui/button";

function readQuery(params: URLSearchParams): SearchQuery {
  const year = params.get("year");
  const minRating = params.get("minRating");
  return {
    q: params.get("q") ?? undefined,
    kind: (params.get("kind") as SearchKind | null) ?? undefined,
    genre: params.get("genre") ?? undefined,
    tag: params.get("tag") ?? undefined,
    year: year ? Number(year) : undefined,
    minRating: minRating ? Number(minRating) : undefined,
    language: params.get("language") ?? undefined,
    audio: params.get("audio") ?? undefined,
    quality: params.get("quality") ?? undefined,
    sort: (params.get("sort") as SearchSort | null) ?? undefined,
  };
}

function mergePages(pages: SearchResponse[]): SearchResponse | null {
  if (pages.length === 0) {
    return null;
  }
  const first = pages[0];
  const last = pages[pages.length - 1];
  const movieIds = new Set<string>();
  const seriesIds = new Set<string>();
  const episodeIds = new Set<string>();
  return {
    ...last,
    q: first.q,
    movies: {
      ...last.movies,
      total: first.movies.total,
      items: pages.flatMap((page) => page.movies.items).filter((item) => {
        if (movieIds.has(item.id)) return false;
        movieIds.add(item.id);
        return true;
      }),
    },
    series: {
      ...last.series,
      total: first.series.total,
      items: pages.flatMap((page) => page.series.items).filter((item) => {
        if (seriesIds.has(item.id)) return false;
        seriesIds.add(item.id);
        return true;
      }),
    },
    episodes: {
      ...last.episodes,
      total: first.episodes.total,
      items: pages.flatMap((page) => page.episodes.items).filter((item) => {
        if (episodeIds.has(item.id)) return false;
        episodeIds.add(item.id);
        return true;
      }),
    },
    people: first.people,
    recommendations: first.recommendations,
    total: first.total,
  };
}

export function SearchPageClient() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, status } = useAuthStore();
  const profile = useProfileStore((state) => state.activeProfile);
  const queryClient = useQueryClient();
  const filters = useMemo(() => readQuery(params), [params]);
  const filterKey = params.toString();
  const [paging, setPaging] = useState<{ key: string; page: number; pages: SearchResponse[] }>({
    key: filterKey,
    page: 1,
    pages: [],
  });
  const sentinel = useRef<HTMLDivElement>(null);
  if (paging.key !== filterKey) {
    setPaging({ key: filterKey, page: 1, pages: [] });
  }
  const page = paging.page;
  const pages = paging.pages;

  const entitlementQuery = useQuery({
    queryKey: ["subscription-entitlement"],
    queryFn: subscriptionApi.entitlement,
    enabled: status === "authenticated",
  });
  const entitled = Boolean(entitlementQuery.data?.entitlement.entitled);
  const q = filters.q?.trim() ?? "";
  const emptyDiscovery =
    !q &&
    !filters.genre &&
    !filters.year &&
    !filters.language &&
    !filters.audio &&
    !filters.quality &&
    !filters.minRating &&
    (!filters.kind || filters.kind === "all");
  const searchQuery = useQuery({
    queryKey: ["search", filterKey, page, profile?.id],
    queryFn: async () => {
      const data = await searchApi.query({
        ...filters,
        page,
        limit: 12,
        commit: page === 1 && q.length >= 2,
      });
      setPaging((current) => {
        if (page === 1) return { ...current, pages: [data] };
        if (current.pages.some((item) => item.movies.page === data.movies.page && item.q === data.q)) {
          return current;
        }
        return { ...current, pages: [...current.pages, data] };
      });
      if (page === 1 && q.length >= 2) {
        await queryClient.invalidateQueries({ queryKey: ["search-history"] });
        await queryClient.invalidateQueries({ queryKey: ["search-trending"] });
      }
      return data;
    },
    enabled: entitled && Boolean(profile) && !emptyDiscovery,
    placeholderData: keepPreviousData,
  });

  const historyQuery = useQuery({
    queryKey: ["search-history", profile?.id],
    queryFn: () => searchApi.history(profile!.id),
    enabled: entitled && Boolean(profile),
  });
  const trendingQuery = useQuery({
    queryKey: ["search-trending"],
    queryFn: searchApi.trending,
    enabled: entitled && Boolean(profile),
    staleTime: 60_000,
  });
  const listToggle = useMyListToggle(profile?.id);
  const merged = mergePages(pages.length ? pages : searchQuery.data ? [searchQuery.data] : []);
  const canLoadMore = Boolean(
    merged && (merged.movies.nextPage || merged.series.nextPage || merged.episodes.nextPage),
  );

  useEffect(() => {
    if (!canLoadMore || !sentinel.current) return;
    const node = sentinel.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !searchQuery.isFetching) {
          setPaging((current) => ({ ...current, page: current.page + 1 }));
        }
      },
      { rootMargin: "600px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [canLoadMore, searchQuery.isFetching, filterKey]);

  const clearHistory = useMutation({
    mutationFn: async () => {
      if (!profile) return;
      await searchApi.clearHistory(profile.id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["search-history"] });
    },
  });

  const applyFilters = (next: Partial<SearchQuery>) => {
    const current = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value == null || value === "") current.delete(key);
      else current.set(key, String(value));
    }
    const encoded = current.toString();
    router.replace(encoded ? `/home/search?${encoded}` : "/home/search");
  };

  if (status === "loading" || status === "idle" || !user || !profile) {
    return <ScreenMessage>Loading search...</ScreenMessage>;
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="px-3 pb-24 pt-24 sm:px-4 md:px-5 lg:px-6">
        <div className="mx-auto max-w-[1400px] space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold sm:text-3xl">{q ? `Results for “${q}”` : "Search & Discover"}</h1>
            <p className="text-sm text-muted-foreground">Filter by genre, year, quality, and more.</p>
          </div>
          <SearchFilters query={filters} onChange={applyFilters} />

        {emptyDiscovery ? (
          <div className="space-y-8">
            {(historyQuery.data?.items.length ?? 0) > 0 ? (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Recent searches</h2>
                  <Button variant="ghost" size="sm" onClick={() => clearHistory.mutate()} disabled={clearHistory.isPending}>
                    Clear history
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {historyQuery.data?.items.map((item) => (
                    <FilterQuickPill key={item.id} label={item.query} onClick={() => applyFilters({ q: item.query })} />
                  ))}
                </div>
              </section>
            ) : null}
            {(trendingQuery.data?.items.length ?? 0) > 0 ? (
              <section className="space-y-3">
                <h2 className="text-xl font-semibold">Trending searches</h2>
                <div className="flex flex-wrap gap-2">
                  {trendingQuery.data?.items.map((item) => (
                    <FilterQuickPill key={item.query} label={item.query} onClick={() => applyFilters({ q: item.query })} />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        ) : null}

        {searchQuery.isLoading && pages.length === 0 ? (
          <p className="text-sm text-muted-foreground">Searching…</p>
        ) : merged && (merged.total > 0 || merged.people.length > 0) ? (
          <div className="space-y-10">
            <SearchGroupGrid
              title="Movies"
              group={merged.movies}
              onToggleList={listToggle.mutate}
              listPending={listToggle.isPending}
              onLoadMore={() => setPaging((current) => ({ ...current, page: current.page + 1 }))}
            />
            <SearchGroupGrid
              title="TV Series"
              group={merged.series}
              onToggleList={listToggle.mutate}
              listPending={listToggle.isPending}
              onLoadMore={() => setPaging((current) => ({ ...current, page: current.page + 1 }))}
            />
            <EpisodeResults group={merged.episodes} onLoadMore={() => setPaging((current) => ({ ...current, page: current.page + 1 }))} />
            <PeopleResults people={merged.people} />
            {canLoadMore ? <div ref={sentinel} className="h-8" /> : null}
          </div>
        ) : q ? (
          <div className="space-y-6">
            <p className="text-muted-foreground">No titles match that search. Try a different name, person, or genre.</p>
            {(merged?.recommendations.length ?? 0) > 0 ? (
              <MediaCarousel
                row={{
                  id: "search-empty-recs",
                  title: "You might like",
                  kind: HomeRowKind.Recommended,
                  source: HomeRowSource.Catalog,
                  items: merged!.recommendations,
                }}
                onToggleList={listToggle.mutate}
                listPending={listToggle.isPending}
              />
            ) : null}
          </div>
        ) : merged && merged.total > 0 ? (
          <div className="space-y-10">
            <SearchGroupGrid title="Movies" group={merged.movies} onToggleList={listToggle.mutate} listPending={listToggle.isPending} />
            <SearchGroupGrid title="TV Series" group={merged.series} onToggleList={listToggle.mutate} listPending={listToggle.isPending} />
          </div>
        ) : null}
        </div>
      </section>
    </main>
  );
}
