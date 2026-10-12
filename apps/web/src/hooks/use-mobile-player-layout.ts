"use client";

import { useEffect, useState } from "react";

function isMobilePlayerLayout(): boolean {
  if (typeof window === "undefined") return false;
  if (navigator.maxTouchPoints > 0 && window.innerWidth < 1400) return true;
  return window.matchMedia(
    "(max-width: 1023px), (max-height: 520px) and (pointer: coarse), (hover: none) and (pointer: coarse)",
  ).matches;
}

/** Touch-first layout for phone/tablet player chrome (Emby-style). */
export function useMobilePlayerLayout(): boolean {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const sync = () => setMobile(isMobilePlayerLayout());
    sync();
    window.addEventListener("resize", sync);
    const query = window.matchMedia("(hover: none) and (pointer: coarse)");
    query.addEventListener("change", sync);
    return () => {
      window.removeEventListener("resize", sync);
      query.removeEventListener("change", sync);
    };
  }, []);

  return mobile;
}
