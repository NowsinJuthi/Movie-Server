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

export default function HistoryPage() {
  const profile = useProfileStore((state) => state.activeProfile);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["watch-history", profile?.id],
    queryFn: () => profileApi.history(profile!.id),
    enabled: Boolean(profile),
  });

  const remove = useMutation({
    mutationFn: (mediaId: string) => profileApi.removeHistory(profile!.id, mediaId),
    onSuccess: async () => {
      toast.success("Removed from watch history");
      await invalidatePersonalization(queryClient);
    },
  });

  const clear = useMutation({
    mutationFn: () => profileApi.clearHistory(profile!.id),
    onSuccess: async () => {
      toast.success("Watch history cleared");
      await invalidatePersonalization(queryClient);
    },
  });

  const items = query.data?.items ?? [];

  return (
    <BrowseShell
      heading="Watch History"
      actions={
        items.length > 0 ? (
          <Button
            variant="outline"
            disabled={clear.isPending}
            onClick={() => {
              if (window.confirm("Clear all watch history for this profile?")) {
                clear.mutate();
              }
            }}
          >
            Clear all
          </Button>
        ) : null
      }
    >
      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading history...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing watched on this profile yet.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const ratio =
              item.durationSeconds > 0 ? Math.min(1, item.progressSeconds / item.durationSeconds) : 0;
            const href = item.href ?? "/home";
            return (
              <li
                key={item.id || item.mediaId}
                className="flex items-center gap-4 rounded-md bg-secondary/60 p-3"
              >
                <Link href={href} className="flex min-w-0 flex-1 items-center gap-4">
                  <div className="h-20 w-14 shrink-0 overflow-hidden rounded bg-black/40">
                    <PosterImage src={item.posterUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.title ?? "Untitled"}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.completed ? "Watched" : `${Math.round(ratio * 100)}% watched`}
                      {item.year ? ` · ${item.year}` : ""}
                    </p>
                    <div className="mt-2 h-1 w-40 overflow-hidden rounded bg-white/10">
                      <div className="h-full bg-primary" style={{ width: `${Math.round(ratio * 100)}%` }} />
                    </div>
                  </div>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(item.mediaId)}
                >
                  Remove
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </BrowseShell>
  );
}
