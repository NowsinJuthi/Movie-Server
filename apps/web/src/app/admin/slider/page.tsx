"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Film, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { PublicMovie } from "@movie-server/shared";
import { AdminPage } from "@/components/admin/admin-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminApi } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import { movieApi } from "@/lib/movie-api";

const MAX_SLIDER = 6;

export default function AdminSliderPage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Live search: 1–2 characters typed → results appear (debounced).
  useEffect(() => {
    const value = q.trim();
    if (value.length < 1) {
      setSearch("");
      return;
    }
    const timer = window.setTimeout(() => setSearch(value), 180);
    return () => window.clearTimeout(timer);
  }, [q]);

  const heroQuery = useQuery({ queryKey: ["admin-home-hero"], queryFn: adminApi.homeHero });
  const itemIds = heroQuery.data?.hero.itemIds ?? [];

  const selectedQuery = useQuery({
    queryKey: ["admin-slider-movies", itemIds.join(",")],
    queryFn: async () => {
      if (itemIds.length === 0) return [] as PublicMovie[];
      const results = await Promise.all(
        itemIds.map(async (id) => {
          try {
            const detail = await movieApi.adminOne(id);
            return detail.movie;
          } catch {
            return null;
          }
        }),
      );
      return results.filter((movie): movie is PublicMovie => Boolean(movie));
    },
    enabled: itemIds.length > 0,
  });

  const searchQuery = useQuery({
    queryKey: ["admin-slider-search", search],
    queryFn: () => movieApi.adminList({ q: search, limit: 36 }),
    enabled: search.length >= 1,
  });

  const save = useMutation({
    mutationFn: (nextIds: string[]) =>
      adminApi.updateHomeHero({
        enabled: nextIds.length > 0,
        mediaKind: nextIds.length ? "movie" : null,
        mediaId: nextIds[0] ?? null,
        itemIds: nextIds,
      }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-home-hero"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-slider-movies"] });
      void queryClient.invalidateQueries({ queryKey: ["home"] });
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : "Could not save slider."),
  });

  const selected = useMemo(() => {
    const byId = new Map((selectedQuery.data ?? []).map((movie) => [movie.id, movie]));
    return itemIds.map((id) => byId.get(id)).filter((movie): movie is PublicMovie => Boolean(movie));
  }, [itemIds, selectedQuery.data]);

  const selectedSet = useMemo(() => new Set(itemIds), [itemIds]);

  function updateIds(next: string[]) {
    save.mutate(next.slice(0, MAX_SLIDER));
  }

  function addMovie(id: string) {
    if (selectedSet.has(id)) return;
    if (itemIds.length >= MAX_SLIDER) {
      setError(`Slider already has ${MAX_SLIDER} movies.`);
      return;
    }
    updateIds([...itemIds, id]);
  }

  function removeMovie(id: string) {
    updateIds(itemIds.filter((item) => item !== id));
  }

  function move(id: string, direction: -1 | 1) {
    const index = itemIds.indexOf(id);
    if (index < 0) return;
    const next = [...itemIds];
    const swap = index + direction;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap]!, next[index]!];
    updateIds(next);
  }

  const loadError =
    heroQuery.error instanceof ApiError
      ? heroQuery.error.message
      : selectedQuery.error instanceof ApiError
        ? selectedQuery.error.message
        : error;

  return (
    <AdminPage
      title="Home slider"
      description={`Pick up to ${MAX_SLIDER} movies for the home page hero slider. Drag order with the arrows — first item shows first.`}
      error={loadError}
    >
      <section className="admin-card mb-4 sm:mb-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Selected ({itemIds.length}/{MAX_SLIDER})</h2>
            <p className="text-sm text-muted-foreground">
              {heroQuery.data?.hero.enabled
                ? "Slider is enabled on the home page."
                : "Add at least one movie to enable the slider."}
            </p>
          </div>
          {itemIds.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={save.isPending}
              onClick={() => updateIds([])}
            >
              <X className="h-4 w-4" />
              Clear all
            </Button>
          ) : null}
        </div>

        {itemIds.length === 0 ? (
          <p className="text-sm text-muted-foreground">No movies yet. Search below and add up to {MAX_SLIDER}.</p>
        ) : (
          <ul className="space-y-2">
            {itemIds.map((id, index) => {
              const movie = selected.find((item) => item.id === id);
              return (
                <li
                  key={id}
                  className="flex items-center gap-3 rounded-lg border border-border/80 bg-background/40 px-3 py-2"
                >
                  <span className="w-6 text-center text-xs font-bold text-muted-foreground">{index + 1}</span>
                  <span className="inline-flex h-14 w-10 shrink-0 overflow-hidden rounded bg-secondary">
                    {movie?.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={movie.posterUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-muted-foreground">
                        <Film className="h-4 w-4" />
                      </span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{movie?.title ?? id}</p>
                    <p className="text-xs text-muted-foreground">
                      {movie ? `${movie.year} · ${movie.id}` : "Loading…"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={index === 0 || save.isPending}
                      onClick={() => move(id, -1)}
                      aria-label="Move up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={index === itemIds.length - 1 || save.isPending}
                      onClick={() => move(id, 1)}
                      aria-label="Move down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-rose-300 hover:text-rose-200"
                      disabled={save.isPending}
                      onClick={() => removeMovie(id)}
                      aria-label="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="admin-card">
        <h2 className="text-lg font-semibold">Add movies</h2>
        <div className="mt-3">
          <Label htmlFor="slider-search">Search catalog</Label>
          <Input
            id="slider-search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search movies…"
            autoComplete="off"
          />
        </div>

        {search ? (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-3">
            {(searchQuery.data?.items ?? []).map((movie) => {
              const already = selectedSet.has(movie.id);
              const full = itemIds.length >= MAX_SLIDER && !already;
              return (
                <div
                  key={movie.id}
                  className="flex items-center gap-3 rounded-lg border border-border/80 bg-background/40 px-3 py-2"
                >
                  <span className="inline-flex h-14 w-10 shrink-0 overflow-hidden rounded bg-secondary">
                    {movie.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={movie.posterUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="grid h-full w-full place-items-center">
                        <Film className="h-4 w-4 text-muted-foreground" />
                      </span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{movie.title}</p>
                    <p className="text-xs text-muted-foreground">{movie.year}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={already ? "outline" : "default"}
                    disabled={already || full || save.isPending}
                    onClick={() => addMovie(movie.id)}
                  >
                    <Plus className="h-4 w-4" />
                    {already ? "Added" : "Add"}
                  </Button>
                </div>
              );
            })}
            {searchQuery.isFetched && (searchQuery.data?.items.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground sm:col-span-2 xl:col-span-3">No movies matched.</p>
            ) : null}
          </div>
        ) : null}
      </section>
    </AdminPage>
  );
}
