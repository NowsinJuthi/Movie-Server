"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { HomeCard } from "@movie-server/shared";
import { profileApi } from "@/lib/profile-api";
import { ApiError } from "@/lib/api";
import { toast } from "sonner";

export function useMyListToggle(profileId: string | undefined) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (card: HomeCard) => {
      if (!profileId) throw new Error("No profile");
      if (card.inMyList) {
        await profileApi.removeFromList(profileId, card.id);
        return { id: card.id, added: false };
      }
      await profileApi.addToList(profileId, card.id);
      return { id: card.id, added: true };
    },
    onSuccess: async (result) => {
      toast.success(result.added ? "Added to My List" : "Removed from My List");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["home"] }),
        queryClient.invalidateQueries({ queryKey: ["mylist"] }),
        queryClient.invalidateQueries({ queryKey: ["personalization"] }),
        queryClient.invalidateQueries({ queryKey: ["search"] }),
        queryClient.invalidateQueries({ queryKey: ["search-similar"] }),
      ]);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.statusCode === 409) {
        toast.message("Already in My List");
        return;
      }
      toast.error(error instanceof Error ? error.message : "Could not update My List.");
    },
  });
  return mutation;
}
