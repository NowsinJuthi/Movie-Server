import type { PlaybackSessionInfo, VideoResolution } from "@movie-server/shared";

/** Same-origin absolute URL for `<video src>` (Safari is picky about relative stream paths). */
export function toAbsoluteStreamUrl(pathOrUrl: string): string {
  if (typeof window === "undefined") return pathOrUrl;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return new URL(pathOrUrl, window.location.origin).href;
}

/** Append playback query params without breaking an existing `?mt=` token. */
export function appendStreamQuery(
  baseUrl: string,
  params: Record<string, string | undefined>,
): string {
  const search = new URLSearchParams();
  const queryStart = baseUrl.indexOf("?");
  const path = queryStart >= 0 ? baseUrl.slice(0, queryStart) : baseUrl;
  if (queryStart >= 0) {
    const existing = new URLSearchParams(baseUrl.slice(queryStart + 1));
    existing.forEach((value, key) => search.set(key, value));
  }
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const encoded = search.toString();
  return encoded ? `${path}?${encoded}` : path;
}

/** Copy-remux pipe (`/media`) — Emby Direct Stream. JSON still advertises `/master` so IDM does not see a file URL. */
export function remuxProgressiveUrl(info: PlaybackSessionInfo): string {
  return toAbsoluteStreamUrl(info.hlsUrl.replace(/\/master(?=\?|$)/, "/media"));
}

/** Direct variant playlist — used for transcode titles (faster start + seek restart). */
export function variantHlsUrl(
  info: PlaybackSessionInfo,
  options?: {
    startSeconds?: number;
    resolution?: VideoResolution | "auto";
    /** New pack even when startSeconds is 0 (seek-to-start of a long live playlist). */
    seekRestart?: boolean;
  },
): string {
  const resolution =
    options?.resolution && options.resolution !== "auto"
      ? options.resolution
      : info.selectedResolution ?? info.qualities.at(-1)?.resolution ?? "1080p";
  const master = toAbsoluteStreamUrl(info.hlsUrl);
  const url = new URL(master);
  url.pathname = url.pathname.replace(/\/master$/, `/v/${resolution}.m3u8`);
  const startSeconds = Math.max(0, options?.startSeconds ?? 0);
  if (options?.seekRestart || startSeconds > 1) {
    url.searchParams.set("t", String(Math.floor(startSeconds)));
  }
  if (options?.seekRestart) {
    url.searchParams.set("g", String(Date.now()));
  }
  return url.toString();
}
