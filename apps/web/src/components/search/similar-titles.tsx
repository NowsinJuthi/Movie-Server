"use client";

import { useQuery } from "@tanstack/react-query";
import type { HomeCard } from "@movie-server/shared";
import { searchApi } from "@/lib/search-api";
import { MediaCarousel } from "@/components/home/media-carousel";
import { HomeRowKind, HomeRowSource } from "@movie-server/shared";
import { useMyListToggle } from "@/components/home/use-my-list";
import { useProfileStore } from "@/stores/profile-store";

export function SimilarTitles({
  kind,
  id,
  title = "More like this",
}: {
  kind: "movie" | "series";
  id: string;
  title?: string;
}) {
  const profileId = useProfileStore((state) => state.activeProfile?.id);
  const query = useQuery({
    queryKey: ["search-similar", kind, id],
    queryFn: () => (kind === "movie" ? searchApi.similarMovie(id) : searchApi.similarSeries(id)),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
  const listToggle = useMyListToggle(profileId);
  const items = query.data?.items ?? [];
  if (items.length === 0) {
    return null;
  }
  return (
    <MediaCarousel
      row={{
        id: `similar-${kind}-${id}`,
        title,
        kind: HomeRowKind.Recommended,
        source: HomeRowSource.Catalog,
        items,
      }}
      onToggleList={(card: HomeCard) => listToggle.mutate(card)}
      listPending={listToggle.isPending}
    />
  );
}
