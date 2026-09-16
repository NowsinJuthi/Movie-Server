"use client";

import type { HomeCard, PublicMovie } from "@movie-server/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Info, Play, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DragSlider } from "@/components/ui/drag-slider";
import { movieApi } from "@/lib/movie-api";
import { seriesApi } from "@/lib/series-api";
import {
  autoplayPlayerHref,
  markMobileAutoplayTap,
  rememberPlayerReturn,
} from "@/lib/player-return";
import { isCoarsePointerMobile } from "@/lib/device-playback";
import { MyListButton } from "./my-list-button";
import { PersonalizationControls } from "./personalization-controls";
import { invalidatePersonalization } from "./use-personalization";
import { PosterImage } from "./poster-image";

type MediaInfoTarget = {
  id: string;
  kind: "movie" | "series";
  title: string;
  href: string;
  watchHref?: string | null;
};

export function MediaInfoDialog({
  target,
  onClose,
}: {
  target: MediaInfoTarget | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const open = Boolean(target);

  const movieQuery = useQuery({
    queryKey: ["media-info", "movie", target?.id],
    queryFn: () => movieApi.one(target!.id),
    enabled: open && target?.kind === "movie",
  });

  const seriesQuery = useQuery({
    queryKey: ["media-info", "series", target?.id],
    queryFn: () => seriesApi.one(target!.id),
    enabled: open && target?.kind === "series",
  });

  const watchedToggle = useMutation({
    mutationFn: async () => {
      const movie = movieQuery.data?.movie;
      if (!movie || target?.kind !== "movie") throw new Error("Movie not loaded");
      return movie.watched ? movieApi.markUnwatched(movie.id) : movieApi.markWatched(movie.id);
    },
    onSuccess: async () => {
      const watched = movieQuery.data?.movie.watched;
      toast.success(watched ? "Marked unwatched" : "Marked watched");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["media-info", "movie", target?.id] }),
        queryClient.invalidateQueries({ queryKey: ["movie", target?.id] }),
        invalidatePersonalization(queryClient),
      ]);
    },
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!target) return null;

  const movie = movieQuery.data?.movie ?? null;
  const series = seriesQuery.data?.series ?? null;
  const continueEpisode = seriesQuery.data?.continueEpisode ?? null;
  const loading =
    (target.kind === "movie" && movieQuery.isLoading) ||
    (target.kind === "series" && seriesQuery.isLoading);

  const title = movie?.title ?? series?.title ?? target.title;
  const originalTitle = movie?.originalTitle ?? series?.originalTitle ?? null;
  const year = movie?.releaseYear ?? series?.firstAirYear ?? null;
  const runtime = movie?.runtimeMinutes ?? null;
  const description = movie?.description ?? series?.description ?? "";
  const posterUrl = movie?.posterUrl ?? series?.posterUrl ?? null;
  const backdropUrl = movie?.backdropUrl ?? series?.backdropUrl ?? posterUrl;
  const genres = movie?.genres ?? series?.genres ?? [];
  const tags = movie?.tags ?? series?.tags ?? [];
  const directors = movie?.directors ?? series?.directors ?? [];
  const writers = movie?.writers ?? [];
  const cast = movie?.cast ?? series?.cast ?? [];
  const ratings = movie?.ratings ?? series?.ratings;
  const rating = ratings?.imdb ?? ratings?.tmdb ?? ratings?.audience ?? null;
  const maturity = movie?.maturityRating ?? series?.maturityRating ?? null;
  const certification = movie?.certification ?? series?.certification ?? null;
  const playable =
    target.kind === "movie"
      ? Boolean(movie?.playable ?? target.watchHref)
      : Boolean(continueEpisode?.id || target.watchHref || series);
  const maxResolution = movie?.maxResolution ?? null;
  const trailerUrl = movie?.trailerUrl ?? null;
  const collection = movieQuery.data?.collection ?? seriesQuery.data?.collection ?? null;
  const versions = movieQuery.data?.versions ?? [];
  const audioTracks = movieQuery.data?.audioTracks ?? [];
  const subtitleTracks = movieQuery.data?.subtitleTracks ?? [];
  const seasonCount = series?.seasonCount ?? seriesQuery.data?.seasons?.length ?? 0;
  const episodeCount = series?.episodeCount ?? null;

  const watchHref =
    target.kind === "movie"
      ? (target.watchHref ?? `/home/movies/${target.id}/watch`)
      : continueEpisode
        ? `/home/series/${target.id}/watch/${continueEpisode.id}`
        : (target.watchHref ?? target.href);

  const playLabel =
    target.kind === "movie"
      ? movie?.progressSeconds && movie.progressSeconds > 0 && !movie.watched
        ? "Continue watching"
        : movie?.watched
          ? "Watch again"
          : "Play"
      : continueEpisode
        ? "Continue watching"
        : "Play";

  const play = () => {
    rememberPlayerReturn();
    if (isCoarsePointerMobile()) {
      markMobileAutoplayTap();
    }
    router.push(autoplayPlayerHref(watchHref));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:mx-4 sm:rounded-2xl">
        <div className="relative h-36 shrink-0 overflow-hidden sm:h-44">
          {backdropUrl ? (
            <PosterImage src={backdropUrl} alt="" className="absolute inset-0 h-full w-full object-cover object-top" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-secondary to-background" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/75 to-black/25" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgb(38_191_176/0.22),transparent_55%)]" />
          <button
            type="button"
            className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/70 text-foreground hover:bg-secondary"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative -mt-14 min-h-0 flex-1 overflow-y-auto brand-scrollbar px-4 pb-6 sm:-mt-16 sm:px-6 sm:pb-7">
          <div className="flex items-start gap-4 sm:gap-5">
            <div className="w-28 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary shadow-[0_12px_40px_-16px_rgb(38_191_176/0.45)] sm:w-36">
              <div className="aspect-[2/3]">
                {posterUrl ? (
                  <PosterImage src={posterUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-xs text-muted-foreground">No poster</div>
                )}
              </div>
            </div>

            <div className="min-w-0 flex-1 space-y-3 pt-1">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                  {target.kind === "series" ? "Series" : "Movie"}
                </p>
                <h2 className="mt-1 text-xl font-bold leading-tight text-foreground sm:text-3xl">{title}</h2>
                {originalTitle && originalTitle !== title ? (
                  <p className="mt-1 text-sm text-muted-foreground">{originalTitle}</p>
                ) : null}
                <p className="mt-2 text-sm text-muted-foreground">
                  {[
                    year,
                    runtime ? `${runtime} min` : null,
                    maturity,
                    certification,
                    rating != null ? `${rating.toFixed(1)} ★` : null,
                    maxResolution,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>

              {!loading && genres.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {genres.map((genre) => (
                    <span
                      key={genre}
                      className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[11px] capitalize text-primary"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-5 space-y-5">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading details…</p>
            ) : (
              <>
                {description ? (
                  <p className="text-sm leading-6 text-foreground/85 whitespace-pre-wrap">{description}</p>
                ) : null}

                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {playable ? (
                      <Button onClick={play}>
                        <Play className="h-4 w-4 fill-current" />
                        {playLabel}
                      </Button>
                    ) : null}
                    <MyListButton mediaId={target.id} title={title} kind={target.kind} />
                    {target.kind === "movie" && movie ? (
                      <Button
                        variant="outline"
                        disabled={watchedToggle.isPending}
                        onClick={() => watchedToggle.mutate()}
                      >
                        {movie.watched ? "Mark unwatched" : "Mark watched"}
                      </Button>
                    ) : null}
                  </div>

                  <PersonalizationControls mediaId={target.id} kind={target.kind} />

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        router.push(target.href);
                        onClose();
                      }}
                    >
                      <Info className="h-4 w-4" />
                      Full page
                    </Button>
                    {trailerUrl ? (
                      <Button variant="outline" size="sm" asChild>
                        <a href={trailerUrl} target="_blank" rel="noreferrer">
                          Trailer
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </div>

                {(tags.length || collection || target.kind === "series") && (
                  <div className="grid gap-3 rounded-xl border border-border bg-secondary/40 p-3 text-sm sm:grid-cols-2">
                    {tags.length ? <Meta label="Tags" values={tags} /> : null}
                    {collection ? <Meta label="Collection" values={[collection.name]} /> : null}
                    {target.kind === "series" ? (
                      <Meta
                        label="Seasons"
                        values={[
                          `${seasonCount} season${seasonCount === 1 ? "" : "s"}${
                            episodeCount != null ? ` · ${episodeCount} episodes` : ""
                          }`,
                        ]}
                      />
                    ) : null}
                  </div>
                )}

                {directors.length || writers.length || cast.length ? (
                  <section className="space-y-4 border-t border-border pt-5">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                      Cast &amp; Crew
                      {cast.length > 3 ? (
                        <span
                          className="inline-flex items-center gap-0.5 rounded-full bg-[#d4af37] px-2 py-0.5 text-[#1a1408] shadow-sm"
                          title="Scroll for more"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.75} />
                          <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.75} />
                        </span>
                      ) : null}
                    </h3>

                    {directors.length || writers.length ? (
                      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                        {directors.length ? (
                          <p>
                            <span className="text-muted-foreground">Directors · </span>
                            <span className="text-foreground/90">{directors.join(", ")}</span>
                          </p>
                        ) : null}
                        {writers.length ? (
                          <p>
                            <span className="text-muted-foreground">Writers · </span>
                            <span className="text-foreground/90">{writers.join(", ")}</span>
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    {cast.length ? (
                      <DragSlider>
                        {cast.map((member) => (
                          <li
                            key={`${member.name}-${member.order}`}
                            className="w-[7.5rem] shrink-0 text-center sm:w-[9rem] md:w-[10rem]"
                          >
                            {member.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={member.imageUrl}
                                alt=""
                                draggable={false}
                                className="pointer-events-none mx-auto aspect-[2/3] w-full rounded-xl border border-border bg-secondary object-cover"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="mx-auto flex aspect-[2/3] w-full items-center justify-center rounded-xl border border-border bg-secondary text-xl font-semibold text-primary">
                                {initials(member.name)}
                              </div>
                            )}
                            <p className="mt-2.5 truncate text-sm font-semibold text-foreground sm:text-base">
                              {member.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground sm:text-sm">
                              {member.character || "—"}
                            </p>
                          </li>
                        ))}
                      </DragSlider>
                    ) : (
                      <p className="text-sm text-muted-foreground">No cast information available.</p>
                    )}
                  </section>
                ) : null}

                {target.kind === "movie" ? (
                  <div className="grid gap-2 border-t border-border pt-4 text-xs text-muted-foreground sm:grid-cols-3">
                    <p>Video: {versions.length || "—"}</p>
                    <p>Audio: {audioTracks.length || "—"}</p>
                    <p>Subtitles: {subtitleTracks.length || "—"}</p>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-foreground/90">{values.join(", ")}</p>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

export function homeCardToInfoTarget(card: HomeCard): MediaInfoTarget {
  return {
    id: card.id,
    kind: card.kind,
    title: card.title,
    href: card.href,
    watchHref: card.watchHref,
  };
}

export function movieToInfoTarget(movie: PublicMovie): MediaInfoTarget {
  return {
    id: movie.id,
    kind: "movie",
    title: movie.title,
    href: `/home/movies/${movie.id}`,
    watchHref: `/home/movies/${movie.id}/watch`,
  };
}
