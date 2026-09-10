"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { profileApi } from "@/lib/profile-api";
import { useProfileStore } from "@/stores/profile-store";
import { useMyListToggle } from "./use-my-list";

export function MyListButton({
  mediaId,
  title,
  kind = "movie",
}: {
  mediaId: string;
  title: string;
  kind?: "movie" | "series";
}) {
  const stored = useProfileStore((state) => state.activeProfile);
  const activeQuery = useQuery({
    queryKey: ["active-profile"],
    queryFn: profileApi.active,
  });
  const profile = stored ?? activeQuery.data?.profile ?? null;
  const listQuery = useQuery({
    queryKey: ["mylist", profile?.id],
    queryFn: () => profileApi.myList(profile!.id),
    enabled: Boolean(profile),
  });
  const inMyList = Boolean(listQuery.data?.items.some((item) => item.mediaId === mediaId));
  const toggle = useMyListToggle(profile?.id);

  if (!profile) return null;

  return (
    <Button
      variant="outline"
      disabled={toggle.isPending}
      onClick={() =>
        toggle.mutate({
          id: mediaId,
          kind,
          title,
          year: 0,
          description: "",
          posterUrl: null,
          backdropUrl: null,
          maturityRating: "mature",
          certification: null,
          genres: [],
          ratings: { imdb: null, tmdb: null, critics: null, audience: null },
          maxResolution: null,
          playable: true,
          featured: false,
          trending: false,
          popular: false,
          badges: [],
          href: "",
          watchHref: null,
          progressRatio: null,
          episodeLabel: null,
          inMyList,
        })
      }
    >
      {inMyList ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      {inMyList ? "In My List" : "My List"}
    </Button>
  );
}
