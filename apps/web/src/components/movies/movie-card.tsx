"use client";

import Link from "next/link";
import type { PublicMovie } from "@movie-server/shared";

export function MovieCard({ movie }: { movie: PublicMovie }) {
  return (
    <Link
      href={`/home/movies/${movie.id}`}
      className="group block overflow-hidden rounded-md bg-secondary"
    >
      <div
        className="aspect-[2/3] bg-cover bg-center"
        style={
          movie.posterUrl
            ? { backgroundImage: `url(${movie.posterUrl})` }
            : { background: "linear-gradient(160deg, #2a3142, #161922)" }
        }
      />
      <div className="space-y-0.5 p-2 text-center">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-white">{movie.title}</p>
        <p className="text-xs text-white/60">{movie.releaseYear}</p>
      </div>
    </Link>
  );
}
