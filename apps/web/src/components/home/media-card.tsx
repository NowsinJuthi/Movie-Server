"use client";

import type { HomeCard } from "@movie-server/shared";
import { Play } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { homeCardToInfoTarget, MediaInfoDialog } from "./media-info-dialog";
import { PosterImage } from "./poster-image";

export function MediaCard({
  card,
  progress,
}: {
  card: HomeCard;
  progress?: boolean;
  onToggleList?: (card: HomeCard) => void;
  listPending?: boolean;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const playHref = card.watchHref ?? card.href;

  return (
    <article className="w-[42vw] shrink-0 snap-start sm:w-[28vw] md:w-[18vw] lg:w-[14vw] xl:w-[12vw]">
      <Link href={playHref} className="group block" aria-label={`Play ${card.title}`}>
        <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-gradient-to-br from-secondary to-black shadow-lg transition duration-200 group-hover:scale-[1.03] group-hover:shadow-2xl">
          <PosterImage
            src={card.posterUrl ?? card.backdropUrl}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/25 group-hover:opacity-100">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-black shadow-lg">
              <Play className="h-5 w-5 fill-current" />
            </span>
          </div>
          <div className="absolute left-2 top-2 flex flex-wrap gap-1">
            {card.badges.slice(0, 2).map((badge) => (
              <span
                key={badge}
                className="rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
              >
                {badge}
              </span>
            ))}
          </div>
          {progress && card.progressRatio != null ? (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
              <div className="h-full bg-primary" style={{ width: `${Math.round(card.progressRatio * 100)}%` }} />
            </div>
          ) : null}
        </div>
      </Link>

      <div className="mt-2 px-0.5 text-center">
        <button
          type="button"
          className="line-clamp-2 w-full text-sm font-medium leading-snug text-white hover:underline"
          onClick={() => setInfoOpen(true)}
        >
          {card.title}
        </button>
        {card.year ? (
          <button
            type="button"
            className="mt-0.5 text-xs text-white/60 hover:text-white/80 hover:underline"
            onClick={() => setInfoOpen(true)}
          >
            {card.year}
          </button>
        ) : null}
      </div>

      {infoOpen ? (
        <MediaInfoDialog target={homeCardToInfoTarget(card)} onClose={() => setInfoOpen(false)} />
      ) : null}
    </article>
  );
}
