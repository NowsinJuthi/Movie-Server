"use client";

import type { HomeCard, SearchEpisodeHit, SearchGroupPage, SearchPersonHit } from "@movie-server/shared";
import { MediaCard } from "@/components/home/media-card";
import { PosterImage } from "@/components/home/poster-image";
import Link from "next/link";
import { rememberPlayerReturn } from "@/lib/player-return";

export function SearchGroupGrid({
  title,
  group,
  onLoadMore,
  onToggleList,
  listPending,
}: {
  title: string;
  group: SearchGroupPage<HomeCard>;
  onLoadMore?: () => void;
  onToggleList?: (card: HomeCard) => void;
  listPending?: boolean;
}) {
  if (group.total === 0 && group.items.length === 0) {
    return null;
  }
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">
        {title} <span className="text-sm font-normal text-muted-foreground">{group.total}</span>
      </h2>
      <div className="flex flex-wrap gap-3">
        {group.items.map((card) => (
          <MediaCard
            key={`${card.kind}-${card.id}`}
            card={card}
            onToggleList={onToggleList}
            listPending={listPending}
          />
        ))}
      </div>
      {group.nextPage ? (
        <button type="button" className="text-sm text-primary hover:underline" onClick={onLoadMore}>
          Load more {title.toLowerCase()}
        </button>
      ) : null}
    </section>
  );
}

export function EpisodeResults({
  group,
  onLoadMore,
}: {
  group: SearchGroupPage<SearchEpisodeHit>;
  onLoadMore?: () => void;
}) {
  if (group.total === 0 && group.items.length === 0) {
    return null;
  }
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">
        Episodes <span className="text-sm font-normal text-muted-foreground">{group.total}</span>
      </h2>
      <ul className="space-y-2">
        {group.items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.watchHref ?? item.href}
              onClick={() => rememberPlayerReturn()}
              className="flex items-center gap-3 rounded-md bg-secondary/70 px-3 py-2 hover:bg-secondary"
            >
              <div className="h-16 w-12 shrink-0 overflow-hidden rounded bg-black/40">
                <PosterImage src={item.posterUrl} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {item.seriesTitle} · S{item.seasonNumber}:E{item.episodeNumber}
                  {item.year ? ` · ${item.year}` : ""}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {group.nextPage ? (
        <button type="button" className="text-sm text-primary hover:underline" onClick={onLoadMore}>
          Load more episodes
        </button>
      ) : null}
    </section>
  );
}

export function PeopleResults({ people }: { people: SearchPersonHit[] }) {
  if (people.length === 0) {
    return null;
  }
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">People</h2>
      <ul className="grid gap-3 md:grid-cols-2">
        {people.map((person) => (
          <li key={person.name} className="rounded-md bg-secondary/70 p-3">
            <p className="font-medium">{person.name}</p>
            <p className="text-xs capitalize text-muted-foreground">{person.roles.join(" · ")}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {person.titles.map((title, index) => (
                <span key={`${title.kind}-${title.id}`}>
                  {index > 0 ? ", " : ""}
                  <Link href={title.href} className="text-foreground hover:underline">
                    {title.title}
                  </Link>
                </span>
              ))}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
