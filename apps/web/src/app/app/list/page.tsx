"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrowseShell } from "@/components/browse/browse-shell";
import { profileApi } from "@/lib/profile-api";
import { useProfileStore } from "@/stores/profile-store";
import { invalidatePersonalization } from "@/components/home/use-personalization";
import { toast } from "sonner";
import { PosterImage } from "@/components/home/poster-image";

export default function MyListPage() {
  const profile = useProfileStore((state) => state.activeProfile);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["mylist", profile?.id],
    queryFn: () => profileApi.myList(profile!.id),
    enabled: Boolean(profile),
  });

  const remove = useMutation({
    mutationFn: (mediaId: string) => profileApi.removeFromList(profile!.id, mediaId),
    onSuccess: async () => {
      toast.success("Removed from My List");
      await invalidatePersonalization(queryClient);
    },
  });

  const items = query.data?.items ?? [];
  const titles = query.data?.titles ?? [];

  return (
    <BrowseShell heading="My List">
      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading My List...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Titles you save will show up here.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => {
            const title = titles[index];
            const href = title?.href ?? "/app";
            return (
              <li key={item.id} className="overflow-hidden rounded-md bg-secondary/60">
                <Link href={href} className="block">
                  <div className="aspect-[2/3] bg-black/40">
                    <PosterImage src={title?.posterUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="space-y-1 p-3">
                    <p className="truncate font-medium">{title?.title ?? "Untitled"}</p>
                    <p className="text-xs text-muted-foreground">{title?.year ?? ""}</p>
                  </div>
                </Link>
                <div className="px-3 pb-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(item.mediaId)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </BrowseShell>
  );
}
