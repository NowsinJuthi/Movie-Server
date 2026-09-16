"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function formatSeekTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function SeekBar({
  currentTime,
  duration,
  bufferedEnd,
  onSeek,
  onScrubbingChange,
  variant = "default",
  transcode = false,
}: {
  currentTime: number;
  duration: number;
  /** Farthest buffered time in seconds */
  bufferedEnd?: number;
  onSeek: (ratio: number) => void;
  onScrubbingChange?: (scrubbing: boolean) => void;
  /** Larger thumb on mobile transport bar */
  variant?: "default" | "emby";
  /** Live HLS transcode — hide misleading full-buffer bar from Safari */
  transcode?: boolean;
}) {
  const accentClass = "bg-primary";
  const trackRef = useRef<HTMLDivElement>(null);
  const [hovering, setHovering] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);
  const [previewRatio, setPreviewRatio] = useState<number | null>(null);
  const scrubbingRef = useRef(false);

  const timeline = duration > 0 ? duration : 0;
  const playedRatio = timeline > 0 ? clamp01(currentTime / timeline) : 0;
  const displayRatio = scrubbing ? (previewRatio ?? playedRatio) : playedRatio;
  const rawBufferedRatio =
    timeline > 0 && bufferedEnd != null ? clamp01(bufferedEnd / timeline) : 0;
  const bufferedRatio = transcode
    ? Math.min(rawBufferedRatio, playedRatio + 0.06)
    : rawBufferedRatio;
  const tipRatio = scrubbing ? displayRatio : (hoverRatio ?? displayRatio);
  const active = hovering || scrubbing;

  const ratioFromClientX = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    return clamp01((clientX - rect.left) / rect.width);
  }, []);

  const previewRatioRef = useRef<number | null>(null);

  const endScrub = useCallback(() => {
    if (!scrubbingRef.current) return;
    const finalRatio = previewRatioRef.current;
    scrubbingRef.current = false;
    setScrubbing(false);
    onScrubbingChange?.(false);
    setPreviewRatio(null);
    previewRatioRef.current = null;
    setHoverRatio(null);
    if (finalRatio != null) {
      onSeek(finalRatio);
    }
  }, [onScrubbingChange, onSeek]);

  const beginScrub = useCallback(
    (clientX: number, event?: { preventDefault?: () => void; stopPropagation?: () => void }) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      const ratio = ratioFromClientX(clientX);
      previewRatioRef.current = ratio;
      setPreviewRatio(ratio);
      scrubbingRef.current = true;
      setScrubbing(true);
      setHovering(true);
      onScrubbingChange?.(true);
    },
    [onScrubbingChange, ratioFromClientX],
  );

  useEffect(() => {
    if (scrubbing) return;
    if (previewRatio == null) return;
    setPreviewRatio(null);
    previewRatioRef.current = null;
  }, [scrubbing, currentTime, previewRatio]);

  useEffect(() => {
    if (!scrubbing) return;
    const onMove = (event: PointerEvent) => {
      const ratio = ratioFromClientX(event.clientX);
      previewRatioRef.current = ratio;
      setPreviewRatio(ratio);
    };
    const onUp = () => endScrub();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [scrubbing, endScrub, ratioFromClientX]);

  const isMobileVariant = variant === "emby";

  return (
    <div
      className={cn(
        "group/seek relative w-full select-none",
        isMobileVariant ? "py-3" : "py-2",
      )}
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => {
        if (!scrubbingRef.current) {
          setHovering(false);
          setHoverRatio(null);
        }
      }}
      onPointerMove={(event) => {
        if (scrubbingRef.current) return;
        setHoverRatio(ratioFromClientX(event.clientX));
      }}
    >
      {(active && tipRatio != null && duration > 0) || scrubbing ? (
        <div
          className="pointer-events-none absolute bottom-full mb-1 -translate-x-1/2 rounded bg-black/85 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white shadow-lg"
          style={{ left: `${tipRatio * 100}%` }}
        >
          {formatSeekTime(tipRatio * duration)}
        </div>
      ) : null}

      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.max(0, Math.floor(duration))}
        aria-valuenow={Math.floor(displayRatio * duration)}
        aria-valuetext={formatSeekTime(displayRatio * duration)}
        className={cn(
          "relative w-full cursor-pointer touch-none outline-none",
          isMobileVariant && "min-h-11",
        )}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.setPointerCapture?.(event.pointerId);
          beginScrub(event.clientX, event);
        }}
        onKeyDown={(event) => {
          if (!duration) return;
          const step = event.shiftKey ? 0.05 : 0.01;
          if (event.key === "ArrowRight" || event.key === "ArrowUp") {
            event.preventDefault();
            onSeek(clamp01(playedRatio + step));
          } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
            event.preventDefault();
            onSeek(clamp01(playedRatio - step));
          } else if (event.key === "Home") {
            event.preventDefault();
            onSeek(0);
          } else if (event.key === "End") {
            event.preventDefault();
            onSeek(1);
          }
        }}
      >
        {/* Hit area — taller on mobile for touch */}
        <div
          className={cn(
            "absolute inset-x-0",
            isMobileVariant ? "-top-4 -bottom-4" : "-top-2 -bottom-2",
          )}
        />

        <div
          className={cn(
            "relative w-full overflow-hidden rounded-full bg-white/20 transition-[height] duration-150",
            active ? "h-[5px]" : "h-[3px]",
          )}
        >
          {/* Buffered — hidden for transcode (Safari reports fantasy ranges) */}
          {!transcode ? (
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-white/35"
              style={{ width: `${bufferedRatio * 100}%` }}
            />
          ) : null}
          {/* Played */}
          <div
            className={cn("absolute inset-y-0 left-0 rounded-full", accentClass)}
            style={{ width: `${displayRatio * 100}%` }}
          />
        </div>

        {/* Thumb */}
        <div
          className={cn(
            "pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_0_1px_rgba(0,0,0,0.25)] transition-[width,height,opacity,transform] duration-150",
            accentClass,
            variant === "emby"
              ? active
                ? "h-4 w-4 opacity-100"
                : "h-3 w-3 opacity-100"
              : active
                ? "h-3.5 w-3.5 opacity-100"
                : "h-2.5 w-2.5 opacity-0 group-hover/seek:opacity-100",
          )}
          style={{ left: `${displayRatio * 100}%` }}
        />
      </div>
    </div>
  );
}
