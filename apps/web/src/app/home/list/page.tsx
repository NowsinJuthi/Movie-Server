"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BrowseShell } from "@/components/browse/browse-shell";
import { MediaInfoDialog } from "@/components/home/media-info-dialog";
import { PosterImage } from "@/components/home/poster-image";
import { invalidatePersonalization } from "@/components/home/use-personalization";
import { profileApi } from "@/lib/profile-api";
import { useProfileStore } from "@/stores/profile-store";
import { toast } from "sonner";

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
        <ul className="flex flex-wrap gap-x-2 gap-y-5 sm:gap-x-3 sm:gap-y-6">
          {items.map((item, index) => {
            const title = titles[index];
            const kind = title?.kind === "series" ? "series" : "movie";
            return (
              <MyListPoster
                key={item.id}
                mediaId={item.mediaId}
                kind={kind}
                title={title?.title ?? "Untitled"}
                year={title?.year ?? null}
                posterUrl={title?.posterUrl ?? null}
                href={title?.href ?? "/home"}
                removing={remove.isPending}
                onRemove={() => remove.mutate(item.mediaId)}
              />
            );
          })}
        </ul>
      )}
    </BrowseShell>
  );
}

function MyListPoster({
  mediaId,
  kind,
  title,
  year,
  posterUrl,
  href,
  removing,
  onRemove,
}: {
  mediaId: string;
  kind: "movie" | "series";
  title: string;
  year: number | null;
  posterUrl: string | null;
  href: string;
  removing: boolean;
  onRemove: () => void;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const playHref = href.includes("/watch")
    ? href
    : kind === "movie"
      ? `${href}/watch`
      : href;

  return (
    <li className="w-[42vw] shrink-0 sm:w-[28vw] md:w-[18vw] lg:w-[14vw] xl:w-[12vw]">
      <div className="relative">
        <Link href={playHref} className="group block" aria-label={`Play ${title}`}>
          <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-gradient-to-br from-secondary to-black shadow-lg transition duration-200 group-hover:scale-[1.03] group-hover:shadow-2xl">
            <PosterImage src={posterUrl} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/25 group-hover:opacity-100">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-black shadow-lg">
                <Play className="h-5 w-5 fill-current" />
              </span>
            </div>
          </div>
        </Link>
        <button
          type="button"
          className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/75 text-white ring-1 ring-white/20 hover:bg-black/90"
          aria-label={`Remove ${title} from My List`}
          disabled={removing}
          onClick={onRemove}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-2 px-0.5 text-center">
        <button
          type="button"
          className="line-clamp-2 w-full text-sm font-medium leading-snug text-white hover:underline"
          onClick={() => setInfoOpen(true)}
        >
          {title}
        </button>
        {year ? (
          <button
            type="button"
            className="mt-0.5 text-xs text-white/60 hover:text-white/80 hover:underline"
            onClick={() => setInfoOpen(true)}
          >
            {year}
          </button>
        ) : null}
      </div>

      {infoOpen ? (
        <MediaInfoDialog
          target={{
            id: mediaId,
            kind,
            title,
            href: href.replace(/\/watch$/, "") || href,
            watchHref: kind === "movie" ? playHref : null,
          }}
          onClose={() => setInfoOpen(false)}
        />
      ) : null}
    </li>
  );
}
