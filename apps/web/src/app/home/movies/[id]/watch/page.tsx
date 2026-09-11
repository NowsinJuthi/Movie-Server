"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { VideoQuality } from "@movie-server/shared";
import { movieApi } from "@/lib/movie-api";
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
  if (!query.data) return <ScreenMessage>Loading title...</ScreenMessage>;

  const { movie } = query.data;
  const quality = (entitlement.data?.entitlement.maxVideoQuality ?? "sd") as VideoQuality;

  return (
    <StreamPlayer
      title={movie.title}
      year={movie.releaseYear}
      mediaInfo={{
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
      }}
      backHref={`/home/movies/${movie.id}`}
      preferredQuality={quality}
      startPlayback={(requested) =>
        movieApi.playback(params.id, requested).then((body) => ({
          session: body.session,
          markers: body.markers,
          resumeSeconds: body.resumeSeconds,
        }))
      }
      saveProgress={(progressSeconds, durationSeconds) =>
        movieApi.progress(params.id, progressSeconds, durationSeconds).then(() => undefined)
      }
    />
  );
}
