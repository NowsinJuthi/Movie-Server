"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { ensureBrowseDocumentScroll } from "@/lib/browse-document-scroll";

/** Keeps the browse site vertically scrollable on mobile (Android Chrome / PWA). */
export function BrowseScrollGuard() {
  const pathname = usePathname();

  useEffect(() => {
    ensureBrowseDocumentScroll();
  }, [pathname]);

  useEffect(() => {
    const onPageShow = () => ensureBrowseDocumentScroll();
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  return null;
}
