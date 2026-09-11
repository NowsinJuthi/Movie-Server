"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function VolumeBar({
  value,
  onChange,
  className,
}: {
  /** 0–1 */
  value: number;
  onChange: (next: number) => void;
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [hovering, setHovering] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const scrubbingRef = useRef(false);

  const display = preview ?? clamp01(value);
  const active = hovering || scrubbing;

  const ratioFromClientX = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    return clamp01((clientX - rect.left) / rect.width);
  }, []);

  const commit = useCallback(
    (ratio: number) => {
      setPreview(ratio);
      onChange(ratio);
    },
    [onChange],
  );

  const endScrub = useCallback(() => {
    if (!scrubbingRef.current) return;
    scrubbingRef.current = false;
    setScrubbing(false);
    setPreview(null);
  }, []);

  useEffect(() => {
    if (!scrubbing) return;
    const onMove = (event: PointerEvent) => {
      commit(ratioFromClientX(event.clientX));
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
  }, [scrubbing, commit, endScrub, ratioFromClientX]);

  return (
    <div
      className={cn("group/vol relative select-none py-2", className)}
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => {
        if (!scrubbingRef.current) setHovering(false);
      }}
    >
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Volume"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(display * 100)}
        className="relative w-full cursor-pointer touch-none outline-none"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture?.(event.pointerId);
          scrubbingRef.current = true;
          setScrubbing(true);
          setHovering(true);
          commit(ratioFromClientX(event.clientX));
        }}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 0.1 : 0.05;
          if (event.key === "ArrowRight" || event.key === "ArrowUp") {
            event.preventDefault();
            onChange(clamp01(value + step));
          } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
            event.preventDefault();
            onChange(clamp01(value - step));
          } else if (event.key === "Home") {
            event.preventDefault();
            onChange(0);
          } else if (event.key === "End") {
            event.preventDefault();
            onChange(1);
          }
        }}
      >
        <div className="absolute inset-x-0 -top-2 -bottom-2" />

        <div
          className={cn(
            "relative w-full overflow-hidden rounded-full bg-white/20 transition-[height] duration-150",
            active ? "h-[5px]" : "h-[3px]",
          )}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-primary"
            style={{ width: `${display * 100}%` }}
          />
        </div>

        <div
          className={cn(
            "pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_0_1px_rgba(0,0,0,0.25)] transition-[width,height,opacity] duration-150",
            active ? "h-3.5 w-3.5 opacity-100" : "h-2.5 w-2.5 opacity-0 group-hover/vol:opacity-100",
          )}
          style={{ left: `${display * 100}%` }}
        />
      </div>
    </div>
  );
}
