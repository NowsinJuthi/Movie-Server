"use client";

import { CirclePlay, Star } from "lucide-react";
import type { ReactNode } from "react";
import { DragSlider } from "@/components/ui/drag-slider";
import { cn } from "@/lib/utils";
import type { PlayerMediaInfo } from "./player-types";

export type PlayerDetailsTab = "info" | "chapters" | "cast";

type ChapterItem = { label: string; startSeconds: number };

export function PlayerDetailsDock({
  tab,
  onTabChange,
  title,
  info,
  chapters,
  streamSummary,
  onSelectChapter,
  onPlayFromBeginning,
}: {
  tab: PlayerDetailsTab | null;
  onTabChange: (tab: PlayerDetailsTab | null) => void;
  title: string;
  info?: PlayerMediaInfo | null;
  chapters: ChapterItem[];
  streamSummary?: string | null;
  onSelectChapter: (startSeconds: number) => void;
  onPlayFromBeginning: () => void;
}) {
  const rating = info?.ratings?.imdb ?? info?.ratings?.tmdb ?? info?.ratings?.audience ?? null;
  const certification = info?.certification ?? info?.maturityRating ?? null;

  const selectTab = (next: PlayerDetailsTab) => {
    onTabChange(tab === next ? null : next);
  };

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap items-center gap-2 md:gap-3" aria-label="Title details">
          <DetailsTab active={tab === "info"} onClick={() => selectTab("info")}>
            Info
          </DetailsTab>
          <DetailsTab active={tab === "chapters"} onClick={() => selectTab("chapters")}>
            Chapters
          </DetailsTab>
          <DetailsTab active={tab === "cast"} onClick={() => selectTab("cast")}>
            Cast &amp; Crew
          </DetailsTab>
        </nav>

        {tab === "info" ? (
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-black/70 px-4 py-2.5 text-sm font-medium text-white ring-1 ring-white/15 hover:bg-black/85"
            onClick={onPlayFromBeginning}
          >
            <CirclePlay className="h-5 w-5" />
            From Beginning
          </button>
        ) : null}
      </div>

      {tab === "info" ? (
        <div className="mt-4 flex gap-4 md:gap-5">
          {info?.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={info.posterUrl}
              alt=""
              className="h-36 w-[5.75rem] shrink-0 rounded-md object-cover shadow-lg sm:h-44 sm:w-[7rem]"
            />
          ) : (
            <div className="flex h-36 w-[5.75rem] shrink-0 items-center justify-center rounded-md bg-white/10 text-[11px] text-white/40 sm:h-44 sm:w-[7rem]">
              No poster
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">{title}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/90">
              {rating != null ? (
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                  {rating.toFixed(1)}
                </span>
              ) : null}
              {info?.year != null ? <span>{info.year}</span> : null}
              {info?.runtimeMinutes != null ? <span>{formatRuntime(info.runtimeMinutes)}</span> : null}
              {certification ? (
                <span className="inline-flex min-w-5 items-center justify-center rounded-[3px] border border-white/80 px-1 text-[11px] font-semibold leading-4 text-white">
                  {certification}
                </span>
              ) : null}
            </div>
            {streamSummary ? <p className="mt-1.5 text-sm text-white/85">{streamSummary}</p> : null}
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/80 line-clamp-3 md:line-clamp-4">
              {info?.description?.trim() || "No description available for this title."}
            </p>
          </div>
        </div>
      ) : null}

      {tab === "chapters" ? (
        <div className="mt-4">
          {chapters.length ? (
            <DragSlider>
              {chapters.map((chapter) => (
                <li key={`${chapter.label}-${chapter.startSeconds}`} className="w-40 shrink-0">
                  <button
                    type="button"
                    className="w-full rounded-xl bg-white/10 p-3 text-left hover:bg-white/15"
                    onClick={() => onSelectChapter(chapter.startSeconds)}
                  >
                    <div className="mb-2 flex h-16 items-end rounded-lg bg-gradient-to-br from-white/15 to-white/5 px-2 pb-2 text-xs tabular-nums text-white/70">
                      {formatChapterTime(chapter.startSeconds)}
                    </div>
                    <p className="truncate text-sm font-medium text-white">{chapter.label}</p>
                  </button>
                </li>
              ))}
            </DragSlider>
          ) : (
            <p className="text-sm text-white/60">No chapters available for this title.</p>
          )}
        </div>
      ) : null}

      {tab === "cast" ? (
        <div className="mt-4 space-y-3">
          {(info?.directors?.length || info?.writers?.length) ? (
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              {info?.directors?.length ? (
                <p>
                  <span className="text-white/50">Directors · </span>
                  <span className="text-white/90">{info.directors.join(", ")}</span>
                </p>
              ) : null}
              {info?.writers?.length ? (
                <p>
                  <span className="text-white/50">Writers · </span>
                  <span className="text-white/90">{info.writers.join(", ")}</span>
                </p>
              ) : null}
            </div>
          ) : null}

          {(info?.cast?.length ?? 0) > 0 ? (
            <DragSlider>
              {info!.cast!.map((member, index) => (
                <li key={`${member.name}-${index}`} className="w-[6.25rem] shrink-0 text-center sm:w-[7.25rem]">
                  {member.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={member.imageUrl}
                      alt=""
                      draggable={false}
                      className="pointer-events-none mx-auto aspect-[2/3] w-full rounded-lg bg-white/10 object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="mx-auto flex aspect-[2/3] w-full items-center justify-center rounded-lg bg-white/10 text-lg font-semibold text-white/70">
                      {initials(member.name)}
                    </div>
                  )}
                  <p className="mt-2 truncate text-sm font-semibold text-white">{member.name}</p>
                  <p className="truncate text-xs text-white/55">{member.character || "—"}</p>
                </li>
              ))}
            </DragSlider>
          ) : (
            <p className="text-sm text-white/60">No cast information available.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function DetailsTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors md:text-base",
        active ? "bg-white/25 text-white" : "bg-transparent text-white/80 hover:text-white",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function formatRuntime(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatChapterTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}
