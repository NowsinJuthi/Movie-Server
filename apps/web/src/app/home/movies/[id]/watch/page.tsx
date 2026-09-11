"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { VideoQuality } from "@movie-server/shared";
import { movieApi } from "@/lib/movie-api";
import { takeCachedPlayback } from "@/lib/playback-cache";
import { subscriptionApi } from "@/lib/subscription-api";
import { useAuthStore } from "@/stores/auth-store";
import { Alert } from "@/components/ui/alert";
import { ScreenMessage } from "@/components/profiles/pin-dialog";
import { StreamPlayer } from "@/components/player/stream-player";
import { ApiError } from "@/lib/api";

export default function MovieWatchPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { status } = useAuthStore();

  const query = useQuery({
    queryKey: ["movie", params.id],
    queryFn: () => movieApi.one(params.id),
    enabled: status === "authenticated" && Boolean(params.id),
    retry: false,
  });
  const entitlement = useQuery({
    queryKey: ["subscription-entitlement"],
    queryFn: subscriptionApi.entitlement,
    enabled: status === "authenticated",
  });

  useEffect(() => {
    if (status === "anonymous") router.replace("/login?next=/home");
  }, [status, router]);

  if (query.isError) {
    const message = query.error instanceof ApiError ? query.error.message : "This title is not available.";
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <Alert>{message}</Alert>
      </main>
    );
  }
  const movie = query.data?.movie;
  const quality = (entitlement.data?.entitlement.maxVideoQuality ?? "hd") as VideoQuality;

  if (!movie && query.isLoading) {
    return <ScreenMessage>Loading title...</ScreenMessage>;
  }

  return (
    <StreamPlayer
      title={movie?.title ?? "Loading..."}
      year={movie?.releaseYear}
      mediaInfo={
        movie
          ? {
              year: movie.releaseYear,
              description: movie.description,
              genres: movie.genres,
              runtimeMinutes: movie.runtimeMinutes,
              maturityRating: movie.maturityRating,
              certification: movie.certification,
              cast: movie.cast,
              directors: movie.directors,
              writers: movie.writers,
              ratings: movie.ratings,
              posterUrl: movie.posterUrl,
            }
          : undefined
      }
      backHref={movie ? `/home/movies/${movie.id}` : "/home"}
      preferredQuality={quality}
      startPlayback={(requested) => {
        const cached = takeCachedPlayback(params.id);
        if (cached) {
          return Promise.resolve({
            session: cached.session,
            markers: cached.markers,
            resumeSeconds: cached.resumeSeconds,
          });
        }
        return movieApi.playback(params.id, requested).then((body) => ({
          session: body.session,
          markers: body.markers,
          resumeSeconds: body.resumeSeconds,
        }));
      }}
      saveProgress={(progressSeconds, durationSeconds) =>
        movieApi.progress(params.id, progressSeconds, durationSeconds).then(() => undefined)
      }
    />
  );
}
