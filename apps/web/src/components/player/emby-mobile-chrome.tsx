"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import {
  AudioLines,
  Captions,
  ChevronLeft,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SeekBar } from "./seek-bar";

const EMBY_GREEN = "#52B54B";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
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
      className={cn(
        "inline-flex h-11 w-11 items-center justify-center rounded-full text-white/90 transition-colors active:bg-white/15",
        active && "text-[#52B54B]",
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
  fullscreen: boolean;
  qualityLabel: string;
  subtitlesOn: boolean;
  audioOn: boolean;
  settingsOn: boolean;
  onGoBack: () => void;
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
  fullscreen,
  qualityLabel,
  subtitlesOn,
  audioOn,
  settingsOn,
  onGoBack,
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
}: EmbyMobileChromeProps) {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-transparent via-45% to-black/95" />

      {/* Top — back + title */}
      <header
        className={cn(
          "relative z-10 flex items-center gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]",
          !visible && "pointer-events-none opacity-0",
        )}
      >
        <button
          type="button"
          aria-label="Back"
          onClick={onGoBack}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white active:bg-white/10"
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
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/85 active:bg-white/10"
        >
          {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
        </button>
      </header>

      {/* Tap video area — play/pause lives in the bottom transport bar only */}
      <button
        type="button"
        aria-label={playing ? "Pause" : "Play"}
        className={cn(
          "relative z-10 min-h-0 flex-1 bg-transparent",
          !visible && "pointer-events-none",
        )}
        onClick={onSkinClick}
      />

      {/* Bottom — Emby-style transport */}
      <div
        className={cn(
          "relative z-10 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
          !visible && "pointer-events-none opacity-0",
        )}
      >
        <SeekBar
          variant="emby"
          currentTime={currentTime}
          duration={duration}
          bufferedEnd={bufferedEnd}
          onSeek={onSeek}
          onScrubbingChange={onScrubbingChange}
        />

        <div className="mb-1 flex items-center justify-between text-xs tabular-nums text-white/75">
          <span>{formatTime(currentTime)}</span>
          <span>-{formatTime(Math.max(0, duration - currentTime))}</span>
        </div>

        <div className="mb-2 flex items-center justify-center gap-6">
          <button
            type="button"
            aria-label="Rewind 10 seconds"
            onClick={() => onSeekBy(-10)}
            className="relative inline-flex h-12 w-12 items-center justify-center text-white active:opacity-70"
          >
            <RotateCcw className="h-7 w-7" strokeWidth={1.75} />
            <span className="absolute text-[10px] font-bold">10</span>
          </button>
          <button
            type="button"
            aria-label={playing ? "Pause" : "Play"}
            onClick={onTogglePlay}
            className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/12 text-white ring-1 ring-white/20 active:bg-white/20"
            style={{ boxShadow: `0 0 20px ${EMBY_GREEN}30` }}
          >
            {playing ? (
              <Pause className="h-8 w-8 fill-white" />
            ) : (
              <Play className="ml-0.5 h-8 w-8 fill-white" />
            )}
          </button>
          <button
            type="button"
            aria-label="Forward 10 seconds"
            onClick={() => onSeekBy(10)}
            className="relative inline-flex h-12 w-12 items-center justify-center text-white active:opacity-70"
          >
            <RotateCw className="h-7 w-7" strokeWidth={1.75} />
            <span className="absolute text-[10px] font-bold">10</span>
          </button>
        </div>

        <div className="flex items-center justify-center gap-1">
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
            className="mx-1 min-w-[3rem] rounded-full px-3 py-1.5 text-xs font-semibold tabular-nums text-white/90 ring-1 ring-white/20 active:bg-white/10"
          >
            {qualityLabel}
          </button>
          <MobileIconButton label="Settings" active={settingsOn} onClick={onToggleSettings}>
            <Settings className="h-5 w-5" />
          </MobileIconButton>
        </div>
      </div>
    </>
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
