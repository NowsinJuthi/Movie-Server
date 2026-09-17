"use client";

import type { HomeCard } from "@movie-server/shared";
import { Play } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { autoplayPlayerHref, rememberPlayerReturn } from "@/lib/player-return";
import { homeCardToInfoTarget, MediaInfoDialog } from "./media-info-dialog";
import styles from "./media-card.module.css";
import { PosterImage } from "./poster-image";

export function MediaCard({
  card,
  progress,
  imagePriority = false,
}: {
  card: HomeCard;
  progress?: boolean;
  imagePriority?: boolean;
  onToggleList?: (card: HomeCard) => void;
  listPending?: boolean;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const playHref = autoplayPlayerHref(card.watchHref ?? card.href);

  return (
    <article className="w-[42vw] shrink-0 snap-start sm:w-[28vw] md:w-[18vw] lg:w-[14vw] xl:w-[12vw]">
      <Link
        href={playHref}
        className={styles.posterLink}
        aria-label={`Play ${card.title}`}
        onClick={() => rememberPlayerReturn()}
      >
        <div className={styles.posterFrame}>
          <PosterImage
            src={card.posterUrl ?? card.backdropUrl}
            alt=""
            className={styles.posterImage}
            priority={imagePriority}
          />
          <div className={styles.playOverlay} aria-hidden>
            <span className={styles.playButton}>
              <Play className={styles.playIcon} />
            </span>
          </div>
          {progress && card.progressRatio != null ? (
            <div className="absolute inset-x-0 bottom-0 z-[1] h-1 bg-white/20">
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
