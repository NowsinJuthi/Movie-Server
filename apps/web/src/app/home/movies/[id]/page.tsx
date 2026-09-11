"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { movieApi } from "@/lib/movie-api";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ScreenMessage } from "@/components/profiles/pin-dialog";
import { ApiError } from "@/lib/api";
import { MyListButton } from "@/components/home/my-list-button";
import { PersonalizationControls } from "@/components/home/personalization-controls";
import { SimilarTitles } from "@/components/search/similar-titles";
import { invalidatePersonalization } from "@/components/home/use-personalization";
import { toast } from "sonner";
import { rememberPlayerReturn } from "@/lib/player-return";

export default function MovieDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { status } = useAuthStore();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["movie", params.id],
    queryFn: () => movieApi.one(params.id),
    enabled: status === "authenticated" && Boolean(params.id),
    retry: false,
  });
  const watchedToggle = useMutation({
    mutationFn: async () => {
      const movie = query.data?.movie;
      if (!movie) throw new Error("Movie not loaded");
      return movie.watched ? movieApi.markUnwatched(movie.id) : movieApi.markWatched(movie.id);
    },
    onSuccess: async () => {
      const watched = query.data?.movie.watched;
      toast.success(watched ? "Marked unwatched" : "Marked watched");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["movie", params.id] }),
        invalidatePersonalization(queryClient),
      ]);
    },
  });

  useEffect(() => {
    if (status === "anonymous") {
      router.replace("/login?next=/home");
    }
  }, [status, router]);

  if (status === "loading" || status === "idle") {
    return <ScreenMessage>Loading title...</ScreenMessage>;
  }

  if (query.isError) {
    const message =
      query.error instanceof ApiError && query.error.statusCode === 403
        ? "An active subscription is required to view this title."
        : "This title is not available.";
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <Alert>{message}</Alert>
        <Button className="mt-6" variant="outline" onClick={() => router.push("/home")}>
          Back to catalog
        </Button>
      </main>
    );
  }

  if (!query.data) {
    return <ScreenMessage>Loading title...</ScreenMessage>;
  }

  const { movie, collection, versions, audioTracks, subtitleTracks } = query.data;
  return (
    <main className="min-h-screen bg-background">
      <div
        className="relative min-h-[360px] bg-cover bg-center"
        style={
          movie.backdropUrl || movie.posterUrl
            ? { backgroundImage: `url(${movie.backdropUrl || movie.posterUrl})` }
            : undefined
        }
      >
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/30" />
        <div className="relative mx-auto flex max-w-none flex-col gap-6 px-3 pb-12 pt-10 sm:px-4 md:flex-row md:px-5 lg:px-6">
          <div
            className="h-72 w-48 shrink-0 rounded-md bg-secondary bg-cover bg-center"
            style={movie.posterUrl ? { backgroundImage: `url(${movie.posterUrl})` } : undefined}
          />
          <div className="space-y-4">
            <Button variant="ghost" onClick={() => router.push("/home")}>
              ← Catalog
            </Button>
            <p className="text-sm uppercase tracking-widest text-muted-foreground">
              {movie.releaseYear} · {movie.runtimeMinutes} min · {movie.maturityRating}
              {movie.certification ? ` · ${movie.certification}` : ""}
            </p>
            <h1 className="text-4xl font-semibold">{movie.title}</h1>
            {movie.originalTitle && movie.originalTitle !== movie.title ? (
              <p className="text-muted-foreground">{movie.originalTitle}</p>
            ) : null}
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{movie.description}</p>
            <p className="text-sm">
              {movie.playable ? "Available to watch" : "Not currently playable on your plan"}
              {movie.maxResolution ? ` · up to ${movie.maxResolution}` : ""}
            </p>
            <div className="flex flex-wrap gap-3">
            {movie.playable ? (
              <Button
                onClick={() => {
                  rememberPlayerReturn();
                  router.push(`/home/movies/${movie.id}/watch`);
                }}
              >
                {movie.progressSeconds && movie.progressSeconds > 0 && !movie.watched
                  ? "Continue watching"
                  : movie.watched
                    ? "Watch again"
                    : "Play"}
              </Button>
            ) : null}
            <MyListButton mediaId={movie.id} title={movie.title} kind="movie" />
            <Button variant="outline" disabled={watchedToggle.isPending} onClick={() => watchedToggle.mutate()}>
              {movie.watched ? "Mark unwatched" : "Mark watched"}
            </Button>
            </div>
            <PersonalizationControls mediaId={movie.id} kind="movie" />
            {movie.trailerUrl ? (
              <a className="text-sm text-primary underline" href={movie.trailerUrl} target="_blank" rel="noreferrer">
                Watch trailer
              </a>
            ) : null}
          </div>
        </div>
      </div>
      <section className="mx-auto space-y-8 px-3 py-10 sm:px-4 md:px-5 lg:px-6">
        <div className="flex flex-wrap gap-2">
          {movie.genres.map((genre) => (
            <span key={genre} className="rounded-full bg-secondary px-3 py-1 text-xs capitalize">
              {genre}
            </span>
          ))}
        </div>
        {collection ? (
          <p className="text-sm text-muted-foreground">
            Collection: <span className="text-foreground">{collection.name}</span>
          </p>
        ) : null}
        <Meta label="Directors" values={movie.directors} />
        <Meta label="Writers" values={movie.writers} />
        <div>
          <h2 className="mb-3 text-lg font-medium">Cast</h2>
          {movie.cast.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cast listed.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {movie.cast.map((member) => (
                <li key={`${member.name}-${member.order}`} className="text-sm">
                  {member.name}
                  {member.character ? (
                    <span className="text-muted-foreground"> as {member.character}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <TrackList
          title="Video versions"
          empty="No video versions yet."
          items={versions.map((item) => ({
            id: item.id,
            label: `${item.quality ?? "unknown"} · ${item.status}${item.allowed ? "" : " · upgrade required"}`,
          }))}
        />
        <TrackList
          title="Audio tracks"
          empty="No audio tracks yet."
          items={audioTracks.map((item) => ({
            id: item.id,
            label: [
              item.label ?? item.language ?? "Audio",
              item.codec,
              item.channels ? `${item.channels} ch` : null,
              item.isDefault ? "default" : null,
            ]
              .filter(Boolean)
              .join(" · "),
          }))}
        />
        <TrackList
          title="Subtitles"
          empty="No subtitles yet."
          items={subtitleTracks.map((item) => ({
            id: item.id,
            label: [
              item.label ?? item.language ?? "Subtitle",
              item.format?.toUpperCase(),
              item.hearingImpaired ? "HI" : null,
              item.forced ? "forced" : null,
              item.status,
            ]
              .filter(Boolean)
              .join(" · "),
          }))}
        />
      </section>
      <div className="pb-16">
        <SimilarTitles kind="movie" id={movie.id} />
      </div>
    </main>
  );
}

function Meta({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <p className="text-sm">
      <span className="text-muted-foreground">{label}: </span>
      {values.join(", ")}
    </p>
  );
}

function TrackList({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: Array<{ id: string; label: string }>;
}) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-medium">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {items.map((item) => (
            <li key={item.id} className="rounded-md bg-secondary px-3 py-2">
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
