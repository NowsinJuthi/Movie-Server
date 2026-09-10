"use client";

import type { PublicSeries } from "@movie-server/shared";
import { SeriesCard } from "./series-card";

export function SeriesShelf({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: PublicSeries[];
}) {
  return (
    <section>
      <h2 className="mb-4 text-xl font-medium">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {items.map((series) => (
            <SeriesCard key={series.id} series={series} />
          ))}
        </div>
      )}
    </section>
  );
}
