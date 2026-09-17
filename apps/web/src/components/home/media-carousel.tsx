"use client";

import type { HomeCard, HomeRow } from "@movie-server/shared";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { MediaCard } from "./media-card";

export function MediaCarousel({
  row,
  onToggleList,
  listPending,
}: {
  row: HomeRow;
  onToggleList?: (card: HomeCard) => void;
  listPending?: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const isContinue = row.kind === "continue" || row.kind === "recently_watched";
  const rowHref =
    row.kind === "library" && row.libraryId
      ? `/home/library/${row.libraryId}`
      : row.id === "mylist"
        ? "/home/list"
        : row.id === "favorites"
          ? "/home/favorites"
          : row.id === "recently-watched" || row.id === "continue"
            ? "/home/history"
            : null;

  const scroll = (dir: number) => {
    const node = scroller.current;
    if (!node) return;
    node.scrollBy({ left: dir * Math.max(node.clientWidth * 0.85, 240), behavior: "smooth" });
  };

  return (
    <section className="relative">
      <div className="mb-3 flex items-end justify-between px-3 sm:px-4 md:px-5 lg:px-6">
        {rowHref ? (
          <Link href={rowHref} className="text-lg font-semibold hover:underline md:text-xl">
            {row.title}
          </Link>
        ) : (
          <h2 className="text-lg font-semibold md:text-xl">{row.title}</h2>
        )}
      </div>
      <div className="group/row relative">
        <button
          type="button"
          className="absolute left-0 top-0 z-10 hidden h-full w-10 items-center justify-center bg-gradient-to-r from-background to-transparent text-white md:flex md:opacity-0 md:group-hover/row:opacity-100"
          onClick={() => scroll(-1)}
          aria-label={`Scroll ${row.title} left`}
        >
          <ChevronLeft className="h-8 w-8" />
        </button>
        <div
          ref={scroller}
          className="no-scrollbar flex snap-x gap-2 overflow-x-auto px-3 pb-16 pt-2 sm:px-4 md:gap-3 md:px-5 lg:px-6"
        >
          {row.items.map((card, cardIndex) => (
            <MediaCard
              key={`${row.id}-${card.kind}-${card.id}`}
              card={card}
              progress={isContinue}
              imagePriority={cardIndex < 8}
              onToggleList={onToggleList}
              listPending={listPending}
            />
          ))}
        </div>
        <button
          type="button"
          className="absolute right-0 top-0 z-10 hidden h-full w-10 items-center justify-center bg-gradient-to-l from-background to-transparent text-white md:flex md:opacity-0 md:group-hover/row:opacity-100"
          onClick={() => scroll(1)}
          aria-label={`Scroll ${row.title} right`}
        >
          <ChevronRight className="h-8 w-8" />
        </button>
      </div>
    </section>
  );
}
