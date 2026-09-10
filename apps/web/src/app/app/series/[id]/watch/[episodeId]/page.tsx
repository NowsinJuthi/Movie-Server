"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { VideoQuality } from "@movie-server/shared";
import { seriesApi } from "@/lib/series-api";
import { subscriptionApi } from "@/lib/subscription-api";
import { useAuthStore } from "@/stores/auth-store";
import { Alert } from "@/components/ui/alert";
import { ScreenMessage } from "@/components/profiles/pin-dialog";
import { StreamPlayer } from "@/components/player/stream-player";
import { ApiError } from "@/lib/api";

export default function EpisodeWatchPage() {
  const params = useParams<{ id: string; episodeId: string }>();
  const router = useRouter();
  const { status } = useAuthStore();

  const query = useQuery({
    queryKey: ["episode", params.id, params.episodeId],
    queryFn: () => seriesApi.episode(params.id, params.episodeId),
    enabled: status === "authenticated",
    retry: false,
  });
  const entitlement = useQuery({
    queryKey: ["subscription-entitlement"],
    queryFn: subscriptionApi.entitlement,
    enabled: status === "authenticated",
  });

  useEffect(() => {
    if (status === "anonymous") router.replace("/login?next=/app");
  }, [status, router]);

  if (query.isError) {
    const message = query.error instanceof ApiError ? query.error.message : "Episode unavailable.";
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <Alert>{message}</Alert>
      </main>
    );
  }
  if (!query.data) return <ScreenMessage>Loading episode...</ScreenMessage>;

  const { series, episode, previous, next, autoPlayNext } = query.data;
  const quality = (entitlement.data?.entitlement.maxVideoQuality ?? "sd") as VideoQuality;

  return (
    <StreamPlayer
      title={episode.title}
      year={series.firstAirYear}
      subtitle={`${series.title} · S${episode.seasonNumber}E${episode.episodeNumber}`}
      mediaInfo={{
        year: series.firstAirYear,
        description: episode.description || series.description,
        genres: series.genres,
        maturityRating: series.maturityRating,
        certification: series.certification,
        cast: series.cast,
        directors: series.directors,
        ratings: series.ratings,
        posterUrl: series.posterUrl,
      }}
      backHref={`/app/series/${series.id}`}
      preferredQuality={quality}
      autoPlayNext={autoPlayNext}
      previous={
        previous
          ? {
              id: previous.id,
              title: previous.title,
              href: `/app/series/${series.id}/watch/${previous.id}`,
            }
          : null
      }
      next={
        next
          ? {
              id: next.id,
              title: next.title,
              href: `/app/series/${series.id}/watch/${next.id}`,
            }
          : null
      }
      startPlayback={(requested) =>
        seriesApi.playback(params.id, params.episodeId, requested).then((body) => ({
          session: body.session,
          markers: body.markers,
          resumeSeconds: body.resumeSeconds,
        }))
      }
      saveProgress={(progressSeconds, durationSeconds) =>
        seriesApi.progress(params.id, params.episodeId, progressSeconds, durationSeconds).then(() => undefined)
      }
    />
  );
}
