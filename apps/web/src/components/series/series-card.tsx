"use client";

import Link from "next/link";
import type { PublicSeries } from "@movie-server/shared";

export function SeriesCard({ series }: { series: PublicSeries }) {
  return (
    <Link href={`/home/series/${series.id}`} className="group block overflow-hidden rounded-md bg-secondary">
      <div
        className="aspect-[2/3] bg-cover bg-center"
        style={
          series.posterUrl
            ? { backgroundImage: `url(${series.posterUrl})` }
            : { background: "linear-gradient(160deg, #243044, #141820)" }
        }
      />
      <div className="space-y-0.5 p-2 text-center">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-white">{series.title}</p>
        <p className="text-xs text-white/60">{series.firstAirYear}</p>
      </div>
    </Link>
  );
}
