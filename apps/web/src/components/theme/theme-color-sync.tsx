"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

const LIGHT_THEME_COLOR = "#f4fbfa";
const DARK_THEME_COLOR = "#01131a";

function upsertMeta(name: string, content: string, media?: string) {
  const selector = media
    ? `meta[name="${name}"][media="${media}"]`
    : `meta[name="${name}"]:not([media])`;
  let meta = document.querySelector<HTMLMetaElement>(selector);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", name);
    if (media) meta.setAttribute("media", media);
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", content);
}

export function ThemeColorSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const isLight = resolvedTheme === "light";
    const color = isLight ? LIGHT_THEME_COLOR : DARK_THEME_COLOR;
    const scheme = isLight ? "light" : "dark";

    upsertMeta("theme-color", color);
    upsertMeta(
      "apple-mobile-web-app-status-bar-style",
      isLight ? "default" : "black",
    );

    document.documentElement.style.colorScheme = scheme;
  }, [resolvedTheme]);

  return null;
}
