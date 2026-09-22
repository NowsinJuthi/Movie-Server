"use client";

import type { ReactNode } from "react";
import {
  ChevronLeft,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  Settings,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
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

/** Emby mobile: elapsed | scrubber | total on one row at the bottom edge. */
function MobileSeekEmbyRow({
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
  const longTimes = duration >= 3600 || currentTime >= 3600;
  const timeClass = cn(
    "shrink-0 font-medium tabular-nums leading-none text-white",
    longTimes ? "text-[11px]" : "text-[13px]",
  );

  return (
    <div
      className={cn(
        "w-full pt-1",
        fullscreen && "-mx-1.5 w-[calc(100%+0.75rem)] max-w-none sm:-mx-2 sm:w-[calc(100%+1rem)]",
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className={cn(timeClass, longTimes ? "min-w-[3rem]" : "min-w-[2.75rem]", "text-left")}>
          {formatTime(currentTime)}
        </span>
        <div className="min-w-0 flex-1 -my-2">
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
        <span
          className={cn(
            timeClass,
            longTimes ? "min-w-[3rem]" : "min-w-[2.75rem]",
            "text-right text-white/60",
          )}
        >
          {duration > 0 ? formatTime(duration) : "--:--"}
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
    <div className={cn("flex items-center", compact ? "gap-4" : "gap-5")}>
      {onPreviousEpisode ? (
        <button
          type="button"
          aria-label="Previous episode"
          onClick={onPreviousEpisode}
          onTouchStart={stopControlBubble}
          className={cn(
            "inline-flex touch-manipulation items-center justify-center text-white/85 active:opacity-60",
            compact ? "h-10 w-10" : "h-11 w-11",
          )}
        >
          <SkipBack className={cn(compact ? "h-5 w-5" : "h-6 w-6")} strokeWidth={1.75} />
        </button>
      ) : null}
      <button
        type="button"
        aria-label="Rewind 10 seconds"
        onClick={() => onSeekBy(-10)}
        onTouchStart={stopControlBubble}
        className={cn(
          "relative inline-flex touch-manipulation items-center justify-center text-white/85 active:opacity-60",
          compact ? "h-10 w-10" : "h-11 w-11",
        )}
      >
        <RotateCcw className={cn(compact ? "h-6 w-6" : "h-7 w-7")} strokeWidth={1.5} />
        <span className={cn("absolute font-semibold text-white/90", compact ? "text-[9px]" : "text-[10px]")}>
          10
        </span>
      </button>
      <button
        type="button"
        aria-label={playing ? "Pause" : "Play"}
        onClick={onTogglePlay}
        onTouchStart={stopControlBubble}
        className={cn(
          "inline-flex touch-manipulation items-center justify-center rounded-full bg-primary text-white shadow-[0_4px_24px_rgb(38_191_176/0.45)] active:scale-[0.96]",
          compact ? "h-12 w-12" : "h-14 w-14",
        )}
      >
        {playing ? (
          <Pause className={cn("fill-white", compact ? "h-6 w-6" : "h-7 w-7")} />
        ) : (
          <Play className={cn("fill-white", compact ? "ml-0.5 h-6 w-6" : "ml-1 h-7 w-7")} />
        )}
      </button>
      <button
        type="button"
        aria-label="Forward 10 seconds"
        onClick={() => onSeekBy(10)}
        onTouchStart={stopControlBubble}
        className={cn(
          "relative inline-flex touch-manipulation items-center justify-center text-white/85 active:opacity-60",
          compact ? "h-10 w-10" : "h-11 w-11",
        )}
      >
        <RotateCw className={cn(compact ? "h-6 w-6" : "h-7 w-7")} strokeWidth={1.5} />
        <span className={cn("absolute font-semibold text-white/90", compact ? "text-[9px]" : "text-[10px]")}>
          10
        </span>
      </button>
      {onNextEpisode ? (
        <button
          type="button"
          aria-label="Next episode"
          onClick={onNextEpisode}
          onTouchStart={stopControlBubble}
          className={cn(
            "inline-flex touch-manipulation items-center justify-center text-white/85 active:opacity-60",
            compact ? "h-10 w-10" : "h-11 w-11",
          )}
        >
          <SkipForward className={cn(compact ? "h-5 w-5" : "h-6 w-6")} strokeWidth={1.75} />
        </button>
      ) : null}
    </div>
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
  onToggleSettings: () => void;
  onToggleFullscreen: () => void;
  pipSupported?: boolean;
  pipActive?: boolean;
  onTogglePip?: () => void;
  hasPreviousEpisode?: boolean;
  hasNextEpisode?: boolean;
  onPreviousEpisode?: () => void;
  onNextEpisode?: () => void;
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
  onToggleSettings,
  onToggleFullscreen,
  pipSupported = false,
  pipActive = false,
  onTogglePip,
  hasPreviousEpisode,
  hasNextEpisode,
  onPreviousEpisode,
  onNextEpisode,
}: EmbyMobileChromeProps) {
  const displayVolume = muted ? 0 : volume;

  return (
    <div
      className={cn(
        "relative grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] pointer-events-none",
        !visible && "pointer-events-none opacity-0 [&_*]:pointer-events-none",
        visible && "opacity-100 transition-opacity duration-200",
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[min(52vh,420px)] bg-gradient-to-t from-black from-30% via-black/75 to-transparent" />

      {/* Top — back + title (Emby-style minimal bar) */}
      <header className="pointer-events-auto relative z-10 flex shrink-0 items-center gap-1 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:gap-2 sm:px-3">
        <button
          type="button"
          aria-label="Back"
          onClick={onGoBack}
          onTouchStart={stopControlBubble}
          className="inline-flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center text-white active:opacity-70"
        >
          <ChevronLeft className="h-8 w-8" strokeWidth={2} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold leading-tight text-white">{title}</p>
          {year != null || subtitle ? (
            <p className="truncate text-[11px] text-white/50">
              {[year, subtitle].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center">
          <div
            className="mr-0.5 flex items-center gap-2 pr-1"
            onPointerDown={() => onVolumePanelChange?.(true)}
            onPointerUp={() => onVolumePanelChange?.(false)}
            onPointerCancel={() => onVolumePanelChange?.(false)}
            onTouchStart={stopControlBubble}
          >
            <VolumeBar
              className="w-[5.75rem] sm:w-28"
              value={displayVolume}
              onChange={onVolumeChange}
            />
            <button
              type="button"
              aria-label={muted ? "Unmute" : "Mute"}
              onClick={onToggleMute}
              className="inline-flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center text-white/85 active:opacity-70"
            >
              {muted || volume === 0 ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
            </button>
          </div>
          <button
            type="button"
            aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            onClick={onToggleFullscreen}
            onTouchStart={stopControlBubble}
            className="inline-flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center text-white/85 active:opacity-70"
          >
            {fullscreen ? <Minimize className="h-6 w-6" /> : <Maximize className="h-6 w-6" />}
          </button>
          {pipSupported && onTogglePip ? (
            <button
              type="button"
              aria-label={pipActive ? "Exit picture in picture" : "Picture in picture"}
              onClick={onTogglePip}
              onTouchStart={stopControlBubble}
              className={cn(
                "inline-flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center text-white/85 active:opacity-70",
                pipActive && "text-primary",
              )}
            >
              <PictureInPicture2 className="h-6 w-6" />
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Settings"
            onClick={onToggleSettings}
            onTouchStart={stopControlBubble}
            className={cn(
              "inline-flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center text-white/85 active:opacity-70",
              settingsOn && "text-primary",
            )}
          >
            <Settings className="h-6 w-6" />
          </button>
        </div>
      </header>

      {/* Spacer only — iOS Safari will not paint video if a full-screen element sits above it. */}
      <div className="pointer-events-none relative z-10 min-h-0" aria-hidden />

      {/* Bottom dock — transport → scrubber → tool icons */}
      <div
        className={cn(
          "pointer-events-auto relative z-20 max-h-[min(52vh,420px)] shrink-0 overflow-y-auto overflow-x-hidden overscroll-contain",
          "pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]",
          "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          fullscreen && "pb-[max(1rem,env(safe-area-inset-bottom))]",
        )}
        onPointerDown={stopControlBubble}
        onTouchStart={stopControlBubble}
      >
        <div className="mb-3 flex items-center justify-center">
          <MobileTransportCluster
            compact={fullscreen}
            playing={playing}
            onTogglePlay={onTogglePlay}
            onSeekBy={onSeekBy}
            onPreviousEpisode={hasPreviousEpisode ? onPreviousEpisode : undefined}
            onNextEpisode={hasNextEpisode ? onNextEpisode : undefined}
          />
        </div>

        <MobileSeekEmbyRow
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
