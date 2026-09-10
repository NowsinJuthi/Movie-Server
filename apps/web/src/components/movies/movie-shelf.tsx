"use client";

import type { PublicMovie } from "@movie-server/shared";
import { MovieCard } from "./movie-card";

export function MovieShelf({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: PublicMovie[];
}) {
  return (
    <section>
      <h2 className="mb-4 text-xl font-medium">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {items.map((movie) => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      )}
    </section>
  );
}
