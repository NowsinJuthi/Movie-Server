"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import {
  AudioLines,
  Captions,
  ChevronLeft,
  Maximize,
  Minimize,
  Pause,
  Play,
  ListVideo,
  RotateCcw,
  RotateCw,
  Settings,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SeekBar } from "./seek-bar";
import { VolumeBar } from "./volume-bar";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function MobileSeekWithTimes({
  currentTime,
  duration,
  fullscreen,
  bufferedEnd,
  transcode,
  onSeek,
  onScrubbingChange,
}: {
  currentTime: number;
  duration: number;
  fullscreen: boolean;
  bufferedEnd: number;
  transcode?: boolean;
  onSeek: (ratio: number) => void;
  onScrubbingChange: (active: boolean) => void;
}) {
  const remaining = Math.max(0, duration - currentTime);
  const longTimes = duration >= 3600 || currentTime >= 3600;
  const timeClass = cn(
    "shrink-0 max-w-[4.25rem] truncate font-semibold tabular-nums leading-none",
    longTimes ? "text-[10px]" : fullscreen ? "text-xs" : "text-[11px]",
  );

  return (
    <div
      className={cn(
        "mb-0 mt-2 w-full pt-1",
        fullscreen && "-mx-1.5 w-[calc(100%+0.75rem)] max-w-none sm:-mx-2 sm:w-[calc(100%+1rem)]",
      )}
    >
      <div className="w-full">
        <SeekBar
          variant="emby"
          emphasis
          currentTime={currentTime}
          duration={duration}
          bufferedEnd={bufferedEnd}
          transcode={transcode}
          onSeek={onSeek}
          onScrubbingChange={onScrubbingChange}
        />
      </div>
      <div className="mt-1 flex w-full items-center justify-between gap-2 tabular-nums">
        <span className={cn(timeClass, "text-left text-white/90")} aria-label="Elapsed">
          {formatTime(currentTime)}
        </span>
        <span className={cn(timeClass, "text-right text-primary")} aria-label="Remaining">
          {duration > 0 ? formatTime(remaining) : "—"}
        </span>
      </div>
    </div>
  );
}

function stopControlBubble(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}

function MobileTransportCluster({
  compact,
  playing,
  onTogglePlay,
  onSeekBy,
  onPreviousEpisode,
  onNextEpisode,
}: {
  compact: boolean;
  playing: boolean;
  onTogglePlay: () => void;
  onSeekBy: (seconds: number) => void;
  onPreviousEpisode?: () => void;
  onNextEpisode?: () => void;
}) {
  return (
    <div className={cn("flex items-center", compact ? "gap-2.5" : "gap-3")}>
      {onPreviousEpisode ? (
        <button
          type="button"
          aria-label="Previous episode"
          onClick={onPreviousEpisode}
          onTouchStart={stopControlBubble}
          className={cn(
            "inline-flex touch-manipulation items-center justify-center rounded-full text-white/90 ring-1 ring-white/20 active:bg-white/10",
            compact ? "h-9 w-9" : "h-10 w-10",
          )}
        >
          <SkipBack className={cn(compact ? "h-4 w-4" : "h-5 w-5")} />
        </button>
      ) : null}
      <button
        type="button"
        aria-label="Rewind 10 seconds"
        onClick={() => onSeekBy(-10)}
        onTouchStart={stopControlBubble}
        className={cn(
          "relative inline-flex touch-manipulation items-center justify-center text-white/90 active:opacity-70",
          compact ? "h-9 w-9" : "h-10 w-10",
        )}
      >
        <RotateCcw className={cn(compact ? "h-5 w-5" : "h-6 w-6")} strokeWidth={1.75} />
        <span className={cn("absolute font-semibold", compact ? "text-[8px]" : "text-[9px]")}>10</span>
      </button>
      <button
        type="button"
        aria-label={playing ? "Pause" : "Play"}
        onClick={onTogglePlay}
        onTouchStart={stopControlBubble}
        className={cn(
          "inline-flex touch-manipulation items-center justify-center rounded-full bg-primary/12 text-white ring-1 ring-primary/30 active:bg-primary/22",
          compact ? "h-10 w-10 shadow-none" : "h-11 w-11 shadow-[0_0_16px_rgb(38_191_176/0.22)]",
        )}
      >
        {playing ? (
          <Pause className={cn("fill-white", compact ? "h-5 w-5" : "h-6 w-6")} />
        ) : (
          <Play className={cn("fill-white", compact ? "ml-0.5 h-5 w-5" : "ml-0.5 h-6 w-6")} />
        )}
      </button>
      <button
        type="button"
        aria-label="Forward 10 seconds"
        onClick={() => onSeekBy(10)}
        onTouchStart={stopControlBubble}
        className={cn(
          "relative inline-flex touch-manipulation items-center justify-center text-white/90 active:opacity-70",
          compact ? "h-9 w-9" : "h-10 w-10",
        )}
      >
        <RotateCw className={cn(compact ? "h-5 w-5" : "h-6 w-6")} strokeWidth={1.75} />
        <span className={cn("absolute font-semibold", compact ? "text-[8px]" : "text-[9px]")}>10</span>
      </button>
      {onNextEpisode ? (
        <button
          type="button"
          aria-label="Next episode"
          onClick={onNextEpisode}
          onTouchStart={stopControlBubble}
          className={cn(
            "inline-flex touch-manipulation items-center justify-center rounded-full bg-primary/15 text-white ring-1 ring-primary/35 active:bg-primary/25",
            compact ? "h-9 w-9" : "h-10 w-10",
          )}
        >
          <SkipForward className={cn(compact ? "h-4 w-4" : "h-5 w-5")} />
        </button>
      ) : null}
    </div>
  );
}

function MobileIconButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      onTouchStart={stopControlBubble}
      className={cn(
        "inline-flex h-11 w-11 touch-manipulation items-center justify-center rounded-full text-white/90 transition-colors active:bg-white/15",
        active && "text-primary",
      )}
    >
      {children}
    </button>
  );
}

export type EmbyMobileChromeProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  year?: number | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  bufferedEnd: number;
  transcode?: boolean;
  fullscreen: boolean;
  qualityLabel: string;
  subtitlesOn: boolean;
  audioOn: boolean;
  settingsOn: boolean;
  volume: number;
  muted: boolean;
  onGoBack: () => void;
  onVolumeChange: (value: number) => void;
  onToggleMute: () => void;
  onVolumePanelChange?: (open: boolean) => void;
  onSkinClick: () => void;
  onTogglePlay: () => void;
  onSeek: (ratio: number) => void;
  onSeekBy: (seconds: number) => void;
  onScrubbingChange: (active: boolean) => void;
  onToggleSubtitles: () => void;
  onToggleAudio: () => void;
  onToggleSettings: () => void;
  onToggleFullscreen: () => void;
  onOpenQuality: () => void;
  hasPreviousEpisode?: boolean;
  hasNextEpisode?: boolean;
  onPreviousEpisode?: () => void;
  onNextEpisode?: () => void;
  onOpenEpisodes?: () => void;
};

export function EmbyMobileChrome({
  visible,
  title,
  subtitle,
  year,
  playing,
  currentTime,
  duration,
  bufferedEnd,
  transcode = false,
  fullscreen,
  qualityLabel,
  subtitlesOn,
  audioOn,
  settingsOn,
  volume,
  muted,
  onGoBack,
  onVolumeChange,
  onToggleMute,
  onVolumePanelChange,
  onSkinClick,
  onTogglePlay,
  onSeek,
  onSeekBy,
  onScrubbingChange,
  onToggleSubtitles,
  onToggleAudio,
  onToggleSettings,
  onToggleFullscreen,
  onOpenQuality,
  hasPreviousEpisode,
  hasNextEpisode,
  onPreviousEpisode,
  onNextEpisode,
  onOpenEpisodes,
}: EmbyMobileChromeProps) {
  const [volumeOpen, setVolumeOpen] = useState(false);
  const displayVolume = muted ? 0 : volume;
  const volumePercent = Math.round(displayVolume * 100);

  const setVolumePanelOpen = (open: boolean) => {
    setVolumeOpen(open);
    onVolumePanelChange?.(open);
  };

  const stepVolume = (delta: number) => {
    const base = muted ? 0 : volume;
    onVolumeChange(Math.min(1, Math.max(0, base + delta)));
  };

  return (
    <div
      className={cn(
        "relative grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] pointer-events-none",
        !visible && "opacity-0",
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-transparent via-45% to-black/95" />

      {/* Top — back + title */}
      <header className="pointer-events-auto relative z-10 flex shrink-0 items-center gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          aria-label="Back"
          onClick={onGoBack}
          onTouchStart={stopControlBubble}
          className="inline-flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full text-white active:bg-white/10"
        >
          <ChevronLeft className="h-7 w-7" strokeWidth={2} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-medium leading-tight text-white">{title}</p>
          {year != null || subtitle ? (
            <p className="truncate text-xs text-white/55">
              {[year, subtitle].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          onClick={onToggleFullscreen}
          onTouchStart={stopControlBubble}
          className="inline-flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full text-white/85 active:bg-white/10"
        >
          {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
        </button>
      </header>

      {/* Spacer only — iOS Safari will not paint video if a full-screen element sits above it. */}
      <div className="pointer-events-none relative z-10 min-h-0" aria-hidden />

      {/* Bottom — transport (same layout in inline and fullscreen) */}
      <div
        className={cn(
          "pointer-events-auto relative z-20 max-h-[min(52vh,420px)] shrink-0 overflow-y-auto overflow-x-hidden overscroll-contain",
          "pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]",
          "pb-[max(1.25rem,env(safe-area-inset-bottom))]",
          fullscreen && "pb-[max(1.75rem,env(safe-area-inset-bottom))]",
        )}
        onPointerDown={stopControlBubble}
        onTouchStart={stopControlBubble}
      >
        <div className="mb-2 flex items-center justify-center">
          <MobileTransportCluster
            compact={fullscreen}
            playing={playing}
            onTogglePlay={onTogglePlay}
            onSeekBy={onSeekBy}
            onPreviousEpisode={hasPreviousEpisode ? onPreviousEpisode : undefined}
            onNextEpisode={hasNextEpisode ? onNextEpisode : undefined}
          />
        </div>

        {volumeOpen ? (
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-black/45 px-2 py-2 ring-1 ring-white/10">
            <button
              type="button"
              aria-label={muted ? "Unmute" : "Mute"}
              onClick={onToggleMute}
              onTouchStart={stopControlBubble}
              className="inline-flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-full text-white active:bg-white/10"
            >
              {muted || volume === 0 ? (
                <VolumeX className="h-5 w-5" />
              ) : (
                <Volume2 className="h-5 w-5" />
              )}
            </button>
            <button
              type="button"
              aria-label="Decrease volume"
              onClick={() => stepVolume(-0.1)}
              onTouchStart={stopControlBubble}
              className="inline-flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-full text-white active:bg-white/10"
            >
              <Minus className="h-5 w-5" strokeWidth={2.5} />
            </button>
            <VolumeBar
              variant="mobile"
              className="min-w-0 flex-1"
              value={displayVolume}
              onChange={onVolumeChange}
            />
            <button
              type="button"
              aria-label="Increase volume"
              onClick={() => stepVolume(0.1)}
              onTouchStart={stopControlBubble}
              className="inline-flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-full text-white active:bg-white/10"
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} />
            </button>
            <span className="w-9 shrink-0 text-center text-xs font-medium tabular-nums text-white/80">
              {volumePercent}%
            </span>
          </div>
        ) : null}

        <div
          className={cn(
            "flex flex-wrap items-center justify-center gap-1",
            fullscreen && "gap-0.5",
          )}
        >
          {onOpenEpisodes ? (
            <MobileIconButton label="All episodes" onClick={onOpenEpisodes}>
              <ListVideo className="h-5 w-5" />
            </MobileIconButton>
          ) : null}
          <MobileIconButton
            label={volumeOpen ? "Hide volume" : "Volume"}
            active={volumeOpen}
            onClick={() => setVolumePanelOpen(!volumeOpen)}
          >
            {muted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </MobileIconButton>
          <MobileIconButton label="Subtitles" active={subtitlesOn} onClick={onToggleSubtitles}>
            <Captions className="h-5 w-5" />
          </MobileIconButton>
          <MobileIconButton label="Audio" active={audioOn} onClick={onToggleAudio}>
            <AudioLines className="h-5 w-5" />
          </MobileIconButton>
          <button
            type="button"
            aria-label="Quality"
            onClick={onOpenQuality}
            onTouchStart={stopControlBubble}
            className="mx-1 min-w-[3rem] touch-manipulation rounded-full px-3 py-1.5 text-xs font-semibold tabular-nums text-white/90 ring-1 ring-white/20 active:bg-white/10"
          >
            {qualityLabel}
          </button>
          <MobileIconButton label="Settings" active={settingsOn} onClick={onToggleSettings}>
            <Settings className="h-5 w-5" />
          </MobileIconButton>
        </div>

        <MobileSeekWithTimes
          currentTime={currentTime}
          duration={duration}
          fullscreen={fullscreen}
          bufferedEnd={bufferedEnd}
          transcode={transcode}
          onSeek={onSeek}
          onScrubbingChange={onScrubbingChange}
        />
      </div>
    </div>
  );
}

/** Emby-style bottom sheet for mobile player menus */
export function MobileBottomSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <button
        type="button"
        aria-label="Close menu"
        className="fixed inset-0 z-40 bg-black/55"
        onClick={onClose}
      />
      <div className="fixed inset-x-0 bottom-0 z-50 max-h-[min(72vh,560px)] overflow-hidden rounded-t-2xl bg-[#141414]/98 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-12px_48px_rgba(0,0,0,0.55)] ring-1 ring-white/10 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <p className="text-base font-semibold text-white">{title}</p>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/80 active:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[min(60vh,480px)] overflow-y-auto">{children}</div>
      </div>
    </>
  );
}
