"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { releaseBrowseScrollLock } from "@/lib/device-playback";

/** Keeps document scrolling enabled on browse pages (Android stuck overflow after player). */
export function BrowseScrollGuard() {
  const pathname = usePathname();
  const isWatchRoute = Boolean(pathname?.includes("/watch"));

  useEffect(() => {
    if (isWatchRoute) return;
    releaseBrowseScrollLock();
  }, [isWatchRoute, pathname]);

  useEffect(() => {
    const onPageShow = () => {
      if (window.location.pathname.includes("/watch")) return;
      releaseBrowseScrollLock();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  return null;
}
