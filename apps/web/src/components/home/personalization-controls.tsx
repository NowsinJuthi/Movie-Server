"use client";

import { Heart, Star, ThumbsDown, ThumbsUp } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MediaReaction, PersonalizationMediaKind } from "@movie-server/shared";
import { Button } from "@/components/ui/button";
import { profileApi } from "@/lib/profile-api";
import { ApiError } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { invalidatePersonalization, usePersonalization } from "./use-personalization";

export function PersonalizationControls({
  mediaId,
  kind,
}: {
  mediaId: string;
  kind: PersonalizationMediaKind;
}) {
  const queryClient = useQueryClient();
  const { profile, state } = usePersonalization();
  const favorited = Boolean(state?.favoriteIds.includes(mediaId));
  const reaction = state?.reactions.find((item) => item.mediaId === mediaId)?.reaction ?? null;
  const rating = state?.ratings.find((item) => item.mediaId === mediaId)?.rating ?? 0;

  const favorite = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error("No profile");
      if (favorited) {
        await profileApi.removeFavorite(profile.id, mediaId);
        return;
      }
      await profileApi.addFavorite(profile.id, mediaId, kind);
    },
    onSuccess: async () => {
      toast.success(favorited ? "Removed from Favorites" : "Added to Favorites");
      await invalidatePersonalization(queryClient);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.statusCode === 409) {
        toast.message("Already in Favorites");
        return;
      }
      toast.error(error instanceof Error ? error.message : "Could not update Favorites.");
    },
  });

  const react = useMutation({
    mutationFn: async (next: MediaReaction | "none") => {
      if (!profile) throw new Error("No profile");
      await profileApi.upsertReaction(profile.id, { mediaId, kind, reaction: next });
    },
    onSuccess: () => invalidatePersonalization(queryClient),
  });

  const rate = useMutation({
    mutationFn: async (value: number) => {
      if (!profile) throw new Error("No profile");
      if (value === rating) {
        await profileApi.removeRating(profile.id, mediaId);
        return;
      }
      await profileApi.upsertRating(profile.id, { mediaId, kind, rating: value });
    },
    onSuccess: () => invalidatePersonalization(queryClient),
  });

  if (!profile) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        disabled={favorite.isPending}
        onClick={() => favorite.mutate()}
        aria-pressed={favorited}
      >
        <Heart className={cn("h-4 w-4", favorited && "fill-primary text-primary")} />
        {favorited ? "In Favorites" : "Favorite"}
      </Button>
      <Button
        variant="outline"
        size="icon"
        disabled={react.isPending}
        aria-pressed={reaction === "like"}
        aria-label="Like"
        onClick={() => react.mutate(reaction === "like" ? "none" : "like")}
      >
        <ThumbsUp className={cn("h-4 w-4", reaction === "like" && "text-primary")} />
      </Button>
      <Button
        variant="outline"
        size="icon"
        disabled={react.isPending}
        aria-pressed={reaction === "dislike"}
        aria-label="Dislike"
        onClick={() => react.mutate(reaction === "dislike" ? "none" : "dislike")}
      >
        <ThumbsDown className={cn("h-4 w-4", reaction === "dislike" && "text-primary")} />
      </Button>
      <div className="flex items-center gap-1 pl-1" role="group" aria-label="Your rating">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            disabled={rate.isPending}
            className="rounded p-0.5 text-muted-foreground hover:text-primary"
            aria-label={`Rate ${value} of 5`}
            onClick={() => rate.mutate(value)}
          >
            <Star className={cn("h-4 w-4", rating >= value && "fill-primary text-primary")} />
          </button>
        ))}
      </div>
    </div>
  );
}
