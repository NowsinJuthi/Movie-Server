"use client";

import type { HomeCard } from "@movie-server/shared";
import { ChevronLeft, ChevronRight, Info, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { rememberPlayerReturn } from "@/lib/player-return";
import { cn } from "@/lib/utils";
import { PosterImage } from "./poster-image";

export function HeroBanner({
  card,
  cards,
  onToggleList,
}: {
  card?: HomeCard | null;
  cards?: HomeCard[];
  onToggleList?: (card: HomeCard) => void;
}) {
  const router = useRouter();
  const slides = (cards?.length ? cards : card ? [card] : []).slice(0, 6);
  const [index, setIndex] = useState(0);

  const slideKey = slides.map((item) => item.id).join("|");

  useEffect(() => {
    setIndex(0);
  }, [slideKey]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((value) => (value + 1) % slides.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [slides.length, slideKey]);

  const active = slides[index] ?? null;
  if (!active) return null;

  const rating = active.ratings.imdb ?? active.ratings.tmdb ?? active.ratings.audience;

  const play = () => {
    rememberPlayerReturn();
    router.push(active.watchHref ?? active.href);
  };

  return (
    <section className="relative min-h-[78vw] w-full overflow-hidden md:min-h-[56vw] lg:min-h-[42vw]">
      {slides.map((slide, slideIndex) => (
        <div
          key={slide.id}
          className={cn(
            "absolute inset-0 transition-opacity duration-700",
            slideIndex === index ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          aria-hidden={slideIndex !== index}
        >
          <PosterImage
            src={slide.backdropUrl ?? slide.posterUrl}
            alt=""
            priority={slideIndex === 0}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      ))}
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-black/40" />
      <div className="relative flex min-h-[78vw] max-w-3xl flex-col justify-end px-3 pb-16 pt-28 sm:px-4 md:min-h-[56vw] md:px-5 lg:min-h-[42vw] lg:px-6 lg:pb-24">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          {slides.length > 1 ? `Featured · ${index + 1}/${slides.length}` : "Featured"}
        </p>
        <h1 className="mt-3 max-w-xl text-4xl font-bold leading-tight md:text-6xl">{active.title}</h1>
        <p className="mt-3 text-sm text-white/80">
          {active.year}
          {rating ? ` · ${rating.toFixed(1)}` : ""}
          {active.certification ? ` · ${active.certification}` : ` · ${active.maturityRating}`}
          {active.maxResolution ? ` · ${active.maxResolution}` : ""}
          {active.kind === "series" ? " · Series" : ""}
        </p>
        <p className="mt-4 line-clamp-3 max-w-xl text-sm leading-6 text-white/80 md:text-base">
          {active.description}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button className="h-12 min-w-32 bg-white text-black hover:bg-white/90" onClick={play}>
            <Play className="h-4 w-4 fill-current" />
            Play
          </Button>
          <Button variant="secondary" className="h-12 min-w-32" onClick={() => router.push(active.href)}>
            <Info className="h-4 w-4" />
            More info
          </Button>
          {onToggleList ? (
            <Button variant="outline" className="h-12" onClick={() => onToggleList(active)}>
              {active.inMyList ? "Remove from My List" : "Add to My List"}
            </Button>
          ) : null}
        </div>
      </div>

      {slides.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="Previous slide"
            className="absolute left-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/65 md:inline-flex"
            onClick={() => setIndex((value) => (value - 1 + slides.length) % slides.length)}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Next slide"
            className="absolute right-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/65 md:inline-flex"
            onClick={() => setIndex((value) => (value + 1) % slides.length)}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-2">
            {slides.map((slide, slideIndex) => (
              <button
                key={slide.id}
                type="button"
                aria-label={`Go to slide ${slideIndex + 1}`}
                className="inline-flex h-10 w-10 touch-manipulation items-center justify-center"
                onClick={() => setIndex(slideIndex)}
              >
                <span
                  className={cn(
                    "rounded-full transition-all",
                    slideIndex === index ? "h-2 w-6 bg-primary" : "h-2 w-2 bg-white/45",
                  )}
                />
              </button>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
