"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type WheelEvent,
} from "react";
import { cn } from "@/lib/utils";

export function DragSlider({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLUListElement>(null);
  const drag = useRef({ active: false, startX: 0, scrollLeft: 0, moved: false });
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateEdges = useCallback(() => {
    const el = ref.current;
    if (!el) {
      setCanLeft(false);
      setCanRight(false);
      return;
    }
    const max = el.scrollWidth - el.clientWidth;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(max > 4 && el.scrollLeft < max - 4);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    updateEdges();
    const onScroll = () => updateEdges();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateEdges) : null;
    ro?.observe(el);
    window.addEventListener("resize", updateEdges);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro?.disconnect();
      window.removeEventListener("resize", updateEdges);
    };
  }, [updateEdges, children]);

  const scrollByDir = useCallback((dir: number) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.7, 160), behavior: "smooth" });
  }, []);

  const onPointerDown = useCallback((event: PointerEvent<HTMLUListElement>) => {
    const el = ref.current;
    if (!el) return;
    drag.current = {
      active: true,
      startX: event.clientX,
      scrollLeft: el.scrollLeft,
      moved: false,
    };
    el.setPointerCapture(event.pointerId);
    el.classList.add("cursor-grabbing");
  }, []);

  const onPointerMove = useCallback((event: PointerEvent<HTMLUListElement>) => {
    const el = ref.current;
    if (!el || !drag.current.active) return;
    const delta = event.clientX - drag.current.startX;
    if (Math.abs(delta) > 4) drag.current.moved = true;
    el.scrollLeft = drag.current.scrollLeft - delta;
  }, []);

  const endDrag = useCallback((event: PointerEvent<HTMLUListElement>) => {
    const el = ref.current;
    if (!el) return;
    drag.current.active = false;
    el.classList.remove("cursor-grabbing");
    try {
      el.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
    updateEdges();
  }, [updateEdges]);

  const onClickCapture = useCallback((event: MouseEvent<HTMLUListElement>) => {
    if (drag.current.moved) {
      event.preventDefault();
      event.stopPropagation();
      drag.current.moved = false;
    }
  }, []);

  const onWheel = useCallback((event: WheelEvent<HTMLUListElement>) => {
    const el = ref.current;
    if (!el) return;
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      el.scrollLeft += event.deltaY;
      event.preventDefault();
    }
  }, []);

  const showArrows = canLeft || canRight;

  const arrowBtn =
    "absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-[#d4af37] text-[#1a1408] shadow-[0_4px_14px_rgba(0,0,0,0.55)] ring-2 ring-black/40 transition hover:bg-[#e8c547] hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-0";

  return (
    <div className={cn("group/slider relative", className)}>
      {showArrows ? (
        <button
          type="button"
          aria-label="Scroll left"
          disabled={!canLeft}
          onClick={() => scrollByDir(-1)}
          className={cn(arrowBtn, "left-0")}
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2.75} />
        </button>
      ) : null}

      <ul
        ref={ref}
        className="no-scrollbar flex cursor-grab gap-3 overflow-x-auto overscroll-x-contain px-1 pb-1 md:gap-4"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
        onWheel={onWheel}
      >
        {children}
      </ul>

      {showArrows ? (
        <button
          type="button"
          aria-label="Scroll right"
          disabled={!canRight}
          onClick={() => scrollByDir(1)}
          className={cn(arrowBtn, "right-0")}
        >
          <ChevronRight className="h-6 w-6" strokeWidth={2.75} />
        </button>
      ) : null}
    </div>
  );
}
