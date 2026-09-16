"use client";

import Link from "next/link";
import { useState } from "react";
import type { PublicMovie } from "@movie-server/shared";
import { MediaInfoDialog, movieToInfoTarget } from "@/components/home/media-info-dialog";
import { autoplayPlayerHref, rememberPlayerReturn } from "@/lib/player-return";

export function MovieCard({ movie }: { movie: PublicMovie }) {
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <article className="overflow-hidden rounded-md bg-secondary">
      <Link
        href={autoplayPlayerHref(`/home/movies/${movie.id}/watch`)}
        className="group block"
        aria-label={`Play ${movie.title}`}
        onClick={() => rememberPlayerReturn()}
      >
        <div
          className="aspect-[2/3] bg-cover bg-center transition group-hover:opacity-90"
          style={
            movie.posterUrl
              ? { backgroundImage: `url(${movie.posterUrl})` }
              : { background: "linear-gradient(160deg, #2a3142, #161922)" }
          }
        />
      </Link>
      <div className="space-y-0.5 p-2 text-center">
        <button
          type="button"
          className="line-clamp-2 w-full text-sm font-medium leading-snug text-white hover:underline"
          onClick={() => setInfoOpen(true)}
        >
          {movie.title}
        </button>
        <button
          type="button"
          className="text-xs text-white/60 hover:underline"
          onClick={() => setInfoOpen(true)}
        >
          {movie.releaseYear}
        </button>
      </div>
      {infoOpen ? (
        <MediaInfoDialog target={movieToInfoTarget(movie)} onClose={() => setInfoOpen(false)} />
      ) : null}
    </article>
  );
}
