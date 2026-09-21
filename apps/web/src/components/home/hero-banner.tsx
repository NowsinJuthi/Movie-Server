"use client";

import type { HomeCard } from "@movie-server/shared";
import { ChevronLeft, ChevronRight, Info, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { autoplayPlayerHref, rememberPlayerReturn } from "@/lib/player-return";
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
    router.push(autoplayPlayerHref(active.watchHref ?? active.href));
  };

  return (
    <section className="relative min-h-[72vw] w-full overflow-hidden md:min-h-[56vw] lg:min-h-[42vw] lg:-mt-[var(--site-header-offset)]">
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
      <div className="absolute inset-0 z-0 bg-gradient-to-r from-black via-black/70 to-transparent max-md:from-black/50 max-md:via-black/20 md:max-lg:via-black/55" />
      <div className="absolute inset-x-0 bottom-0 z-0 h-[45%] bg-gradient-to-t from-background from-[12%] via-background/55 via-[42%] to-transparent" />
      <div className="relative z-[2] flex min-h-[72vw] max-w-3xl flex-col justify-end px-3 pb-6 pt-4 sm:px-4 md:min-h-[56vw] md:px-5 md:pb-16 md:pt-8 lg:min-h-[42vw] lg:px-6 lg:pb-24 lg:pt-[calc(var(--site-header-offset)+0.5rem)]">
        <p className="hidden text-xs font-semibold uppercase tracking-[0.2em] text-primary md:block">
          {slides.length > 1 ? `Featured · ${index + 1}/${slides.length}` : "Featured"}
        </p>
        <h1 className="max-w-xl text-xl font-bold leading-snug sm:text-2xl md:mt-3 md:text-4xl md:leading-tight lg:text-6xl">
          {active.title}
        </h1>
        <p className="mt-1 text-sm text-white/80 md:mt-3">
          <span className="md:hidden">{active.year}</span>
          <span className="hidden md:inline">
            {active.year}
            {rating ? ` · ${rating.toFixed(1)}` : ""}
            {active.certification ? ` · ${active.certification}` : ` · ${active.maturityRating}`}
            {active.maxResolution ? ` · ${active.maxResolution}` : ""}
            {active.kind === "series" ? " · Series" : ""}
          </span>
        </p>
        <p className="mt-4 hidden max-w-xl text-sm leading-6 text-white/80 md:line-clamp-3 md:block md:text-base">
          {active.description}
        </p>
        <div className="relative mt-3 flex w-full items-center gap-2 md:hidden">
          <button
            type="button"
            aria-label="Play"
            onClick={play}
            className="relative z-10 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-black shadow-[0_4px_16px_rgba(0,0,0,0.35)] active:scale-[0.96]"
          >
            <Play className="ml-px h-4 w-4 fill-current" />
          </button>
          <button
            type="button"
            aria-label="More info"
            onClick={() => router.push(active.href)}
            className="relative z-10 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/12 text-white ring-1 ring-white/25 backdrop-blur-md active:scale-[0.96]"
          >
            <Info className="h-4 w-4" />
          </button>
          {slides.length > 1 ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="pointer-events-auto flex items-center gap-1">
                {slides.map((slide, slideIndex) => (
                  <button
                    key={slide.id}
                    type="button"
                    aria-label={`Go to slide ${slideIndex + 1}`}
                    className="inline-flex h-8 w-3.5 shrink-0 touch-manipulation items-center justify-center"
                    onClick={() => setIndex(slideIndex)}
                  >
                    <span
                      className={cn(
                        "rounded-full transition-all",
                        slideIndex === index ? "h-1.5 w-4 bg-primary" : "h-1.5 w-1.5 bg-white/45",
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <div className="mt-6 hidden flex-wrap gap-3 md:flex">
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
          <div className="absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 gap-2 md:flex">
            {slides.map((slide, slideIndex) => (
              <button
                key={slide.id}
                type="button"
                aria-label={`Go to slide ${slideIndex + 1}`}
                className="inline-flex h-8 w-8 touch-manipulation items-center justify-center md:h-10 md:w-10"
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
