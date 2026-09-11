"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { seriesApi } from "@/lib/series-api";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ScreenMessage } from "@/components/profiles/pin-dialog";
import { ApiError } from "@/lib/api";
import { MyListButton } from "@/components/home/my-list-button";
import { PersonalizationControls } from "@/components/home/personalization-controls";
import { SimilarTitles } from "@/components/search/similar-titles";
import { invalidatePersonalization } from "@/components/home/use-personalization";
import { rememberPlayerReturn } from "@/lib/player-return";

export default function SeriesDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { status } = useAuthStore();
  const queryClient = useQueryClient();
  const [seasonId, setSeasonId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["series", params.id],
    queryFn: () => seriesApi.one(params.id),
    enabled: status === "authenticated" && Boolean(params.id),
    retry: false,
  });

  useEffect(() => {
    if (status === "anonymous") router.replace("/login?next=/home");
  }, [status, router]);

  const resolvedSeasonId = seasonId ?? query.data?.seasons[0]?.id ?? null;

  const seasonQuery = useQuery({
    queryKey: ["season", params.id, resolvedSeasonId],
    queryFn: () => seriesApi.season(params.id, resolvedSeasonId!),
    enabled: Boolean(resolvedSeasonId),
  });

  if (status === "loading" || status === "idle") {
    return <ScreenMessage>Loading series...</ScreenMessage>;
  }
  if (query.isError) {
    const message =
      query.error instanceof ApiError && query.error.statusCode === 403
        ? "An active subscription is required to view this series."
        : "This series is not available.";
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <Alert>{message}</Alert>
        <Button className="mt-6" variant="outline" onClick={() => router.push("/home")}>
          Back to catalog
        </Button>
      </main>
    );
  }
  if (!query.data) return <ScreenMessage>Loading series...</ScreenMessage>;

  const { series, seasons, continueEpisode } = query.data;
  const playId = continueEpisode?.id ?? seasonQuery.data?.episodes.find((item) => item.playable)?.id;

  return (
    <main className="min-h-screen bg-background">
      <div
        className="relative min-h-[320px] bg-cover bg-center"
        style={
          series.backdropUrl || series.posterUrl
            ? { backgroundImage: `url(${series.backdropUrl || series.posterUrl})` }
            : undefined
        }
      >
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/30" />
        <div className="relative mx-auto max-w-none space-y-4 px-3 pb-12 pt-10 sm:px-4 md:px-5 lg:px-6">
          <Button variant="ghost" onClick={() => router.push("/home")}>
            ← Catalog
          </Button>
          <p className="text-sm uppercase tracking-widest text-muted-foreground">
            {series.firstAirYear}
            {series.lastAirYear ? `–${series.lastAirYear}` : ""} · {series.status} · {series.maturityRating}
          </p>
          <h1 className="text-4xl font-semibold">{series.title}</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{series.description}</p>
          <div className="flex flex-wrap gap-3">
          {playId ? (
            <Button
              onClick={() => {
                rememberPlayerReturn();
                router.push(`/home/series/${series.id}/watch/${playId}`);
              }}
            >
              {continueEpisode ? "Continue watching" : "Play"}
            </Button>
          ) : null}
          <MyListButton mediaId={series.id} title={series.title} kind="series" />
          </div>
          <PersonalizationControls mediaId={series.id} kind="series" />
        </div>
      </div>
      <section className="mx-auto space-y-6 px-3 py-10 sm:px-4 md:px-5 lg:px-6">
        <div className="flex flex-wrap gap-2">
          {seasons.map((season) => (
            <Button
              key={season.id}
              size="sm"
              variant={resolvedSeasonId === season.id ? "default" : "outline"}
              onClick={() => setSeasonId(season.id)}
            >
              {season.name}
            </Button>
          ))}
        </div>
        <ul className="space-y-2">
          {(seasonQuery.data?.episodes ?? []).map((episode) => (
            <li key={episode.id} className="flex items-center gap-2">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center justify-between rounded-md bg-secondary px-4 py-3 text-left"
                onClick={() => {
                  rememberPlayerReturn();
                  router.push(`/home/series/${series.id}/watch/${episode.id}`);
                }}
              >
                <span>
                  <span className="text-muted-foreground">E{episode.episodeNumber}.</span> {episode.title}
                  {episode.watched ? <span className="ml-2 text-xs text-primary">Watched</span> : null}
                </span>
                <span className="text-xs text-muted-foreground">{episode.runtimeMinutes}m</span>
              </button>
              <Button
                variant="ghost"
                size="sm"
                onClick={async (event) => {
                  event.preventDefault();
                  if (episode.watched) {
                    await seriesApi.markUnwatched(series.id, episode.id);
                  } else {
                    await seriesApi.markWatched(series.id, episode.id);
                  }
                  await Promise.all([
                    queryClient.invalidateQueries({ queryKey: ["season", params.id, resolvedSeasonId] }),
                    queryClient.invalidateQueries({ queryKey: ["series", params.id] }),
                    invalidatePersonalization(queryClient),
                  ]);
                }}
              >
                {episode.watched ? "Unwatch" : "Watched"}
              </Button>
            </li>
          ))}
        </ul>
      </section>
      <div className="pb-16">
        <SimilarTitles kind="series" id={series.id} />
      </div>
    </main>
  );
}
