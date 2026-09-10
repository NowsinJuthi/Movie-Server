"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PersonalizationMediaKind, PersonalizationState } from "@movie-server/shared";
import { profileApi } from "@/lib/profile-api";
import { useProfileStore } from "@/stores/profile-store";

export const PERSONALIZATION_QUERY_KEYS = [
  ["personalization"],
  ["home"],
  ["favorites"],
  ["mylist"],
  ["watch-history"],
  ["recommendations"],
] as const;

export async function invalidatePersonalization(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all(PERSONALIZATION_QUERY_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey: [...queryKey] })));
}

export function usePersonalization() {
  const stored = useProfileStore((state) => state.activeProfile);
  const activeQuery = useQuery({
    queryKey: ["active-profile"],
    queryFn: profileApi.active,
  });
  const profile = stored ?? activeQuery.data?.profile ?? null;
  const query = useQuery({
    queryKey: ["personalization", profile?.id],
    queryFn: () => profileApi.personalization(profile!.id),
    enabled: Boolean(profile),
  });
  return { profile, state: query.data as PersonalizationState | undefined, isLoading: query.isLoading };
}

export function useFavoriteToggle(mediaId: string, kind: PersonalizationMediaKind) {
  const queryClient = useQueryClient();
  const { profile, state } = usePersonalization();
  const favorited = Boolean(state?.favoriteIds.includes(mediaId));
  const mutation = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error("No profile");
      if (favorited) {
        await profileApi.removeFavorite(profile.id, mediaId);
        return false;
      }
      await profileApi.addFavorite(profile.id, mediaId, kind);
      return true;
    },
    onSuccess: () => invalidatePersonalization(queryClient),
  });
  return { favorited, toggle: mutation.mutate, pending: mutation.isPending };
}
