"use client";

import type { HomeCard } from "@movie-server/shared";
import { Info, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { rememberPlayerReturn } from "@/lib/player-return";
import { PosterImage } from "./poster-image";

export function HeroBanner({ card, onToggleList }: { card: HomeCard; onToggleList?: (card: HomeCard) => void }) {
  const router = useRouter();
  const rating = card.ratings.imdb ?? card.ratings.tmdb ?? card.ratings.audience;

  const play = () => {
    rememberPlayerReturn();
    router.push(card.watchHref ?? card.href);
  };

  return (
    <section className="relative min-h-[78vw] w-full md:min-h-[56vw] lg:min-h-[42vw]">
      <PosterImage
        src={card.backdropUrl ?? card.posterUrl}
        alt=""
        priority
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-black/40" />
      <div className="relative flex min-h-[78vw] max-w-3xl flex-col justify-end px-3 pb-16 pt-28 sm:px-4 md:min-h-[56vw] md:px-5 lg:min-h-[42vw] lg:px-6 lg:pb-24">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Featured</p>
        <h1 className="mt-3 max-w-xl text-4xl font-bold leading-tight md:text-6xl">{card.title}</h1>
        <p className="mt-3 text-sm text-white/80">
          {card.year}
          {rating ? ` · ${rating.toFixed(1)}` : ""}
          {card.certification ? ` · ${card.certification}` : ` · ${card.maturityRating}`}
          {card.maxResolution ? ` · ${card.maxResolution}` : ""}
          {card.kind === "series" ? " · Series" : ""}
        </p>
        <p className="mt-4 line-clamp-3 max-w-xl text-sm leading-6 text-white/80 md:text-base">{card.description}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button className="h-12 min-w-32 bg-white text-black hover:bg-white/90" onClick={play}>
            <Play className="h-4 w-4 fill-current" />
            Play
          </Button>
          <Button variant="secondary" className="h-12 min-w-32" onClick={() => router.push(card.href)}>
            <Info className="h-4 w-4" />
            More info
          </Button>
          {onToggleList ? (
            <Button variant="outline" className="h-12" onClick={() => onToggleList(card)}>
              {card.inMyList ? "Remove from My List" : "Add to My List"}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
