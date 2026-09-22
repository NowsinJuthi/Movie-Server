/** True when the browser can decode HEVC/H.265 in theory (canPlayType). */
export function browserSupportsHevc(): boolean {
  if (typeof document === "undefined") return false;
  const codecs = [
    'video/mp4; codecs="hvc1.1.6.L93.B0"',
    'video/mp4; codecs="hev1.1.6.L93.B0"',
    'video/mp4; codecs="hvc1"',
    'video/mp4; codecs="hev1"',
  ];
  const video = document.createElement("video");
  if (codecs.some((codec) => video.canPlayType(codec) !== "")) {
    return true;
  }
  if (typeof MediaSource !== "undefined") {
    return codecs.some((codec) => MediaSource.isTypeSupported(codec));
  }
  return false;
}

/**
 * True when HEVC can be stream-copied (video untouched, audio only converted).
 * Safari supports it natively. Chromium/Edge may support it on systems with a
 * hardware decoder or OS HEVC codec; require MSE confirmation there because
 * HLS.js feeds fragmented MP4 through MediaSource.
 */
export function browserSupportsHevcDirectStream(): boolean {
  if (typeof navigator === "undefined") return false;
  if (isAppleMobileDevice()) return true;
  const ua = navigator.userAgent;
  if (/Safari/i.test(ua) && !/Chrome|Chromium|Edg\//i.test(ua)) {
    return true;
  }
  if (typeof MediaSource === "undefined" || !browserSupportsHevc()) {
    return false;
  }
  const codecs = [
    'video/mp4; codecs="hvc1.1.6.L93.B0"',
    'video/mp4; codecs="hev1.1.6.L93.B0"',
    'video/mp4; codecs="hvc1"',
    'video/mp4; codecs="hev1"',
  ];
  return codecs.some((codec) => MediaSource.isTypeSupported(codec));
}

/** Touch-first phones/tablets — matches the mobile player layout breakpoint. */
export function isCoarsePointerMobile(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 768px), (hover: none) and (pointer: coarse)").matches;
}

/**
 * Whether the playback API may use HEVC direct stream (video copy + audio transcode).
 * PC/desktop keeps full browser detection; Android mobile uses hls.js and often cannot decode HEVC.
 */
export function hevcDirectStreamForPlayback(): boolean {
  if (isAppleMobileDevice()) {
    return true;
  }
  if (isCoarsePointerMobile()) {
    return false;
  }
  return browserSupportsHevcDirectStream();
}

/** iPhone / iPad / iPod — Safari blocks autoplay without a direct tap on the video surface. */
export function isAppleMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

type WebkitVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
  webkitDisplayingFullscreen?: boolean;
  webkitSupportsPresentationMode?: (mode: string) => boolean;
  webkitSetPresentationMode?: (mode: string) => void;
  webkitPresentationMode?: string;
};

/** iOS Safari ignores HTMLMediaElement.volume (always 1). */
export function isHtmlMediaVolumeReadOnly(): boolean {
  if (typeof document === "undefined") return false;
  const probe = document.createElement("video");
  const before = probe.volume;
  try {
    probe.volume = before === 0.5 ? 0.25 : 0.5;
  } catch {
    return true;
  }
  return probe.volume === before;
}

export function videoSupportsPictureInPicture(video?: HTMLVideoElement | null): boolean {
  if (typeof document === "undefined") return false;
  if (document.pictureInPictureEnabled) return true;
  const v = video as WebkitVideo | null | undefined;
  if (v && typeof v.webkitSetPresentationMode === "function") {
    if (typeof v.webkitSupportsPresentationMode === "function") {
      try {
        return Boolean(v.webkitSupportsPresentationMode("picture-in-picture"));
      } catch {
        return false;
      }
    }
    return true;
  }
  if ("pictureInPictureEnabled" in document && document.pictureInPictureEnabled === false) {
    return false;
  }
  return typeof video?.requestPictureInPicture === "function";
}

export function isVideoInPictureInPicture(video?: HTMLVideoElement | null): boolean {
  if (typeof document !== "undefined" && document.pictureInPictureElement) return true;
  const v = video as WebkitVideo | null | undefined;
  return v?.webkitPresentationMode === "picture-in-picture";
}

export async function toggleVideoPictureInPicture(video: HTMLVideoElement): Promise<void> {
  const v = video as WebkitVideo;
  if (document.pictureInPictureEnabled && typeof video.requestPictureInPicture === "function") {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
      return;
    }
    await video.requestPictureInPicture();
    return;
  }
  if (typeof v.webkitSetPresentationMode === "function") {
    const next = v.webkitPresentationMode === "picture-in-picture" ? "inline" : "picture-in-picture";
    v.webkitSetPresentationMode(next);
    return;
  }
  throw new Error("Picture in picture is not available");
}

/** iOS Safari — div.requestFullscreen() is unsupported; use native video fullscreen instead. */
export function isVideoInNativeFullscreen(video: HTMLVideoElement): boolean {
  const v = video as WebkitVideo;
  return Boolean(v.webkitDisplayingFullscreen);
}

export function effectiveVideoDuration(
  video: HTMLVideoElement,
  fallbackSeconds = 0,
): number {
  const d = video.duration;
  if (Number.isFinite(d) && d > 0) return d;
  return fallbackSeconds > 0 ? fallbackSeconds : 0;
}

/** Map packaged HLS local time to movie timeline position. */
export function displayTimelineSeconds(
  localSeconds: number,
  originSeconds: number,
  maxSeconds = 0,
): number {
  const value = Math.max(0, originSeconds + localSeconds);
  if (maxSeconds > 0) {
    return Math.min(value, maxSeconds);
  }
  return value;
}

/** Movie timeline position → packaged HLS local seek target. */
export function localTimelineSeconds(displaySeconds: number, originSeconds: number): number {
  return Math.max(0, displaySeconds - originSeconds);
}

/** True when a packaged-HLS local time is already in the decoder buffer. */
export function isLocalTimeBuffered(
  video: HTMLVideoElement,
  localSeconds: number,
  slack = 0.35,
): boolean {
  const ranges = video.buffered;
  if (ranges.length === 0) {
    return false;
  }
  for (let i = 0; i < ranges.length; i += 1) {
    const start = ranges.start(i);
    const end = ranges.end(i);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (localSeconds >= start - slack && localSeconds <= end + slack) {
      return true;
    }
  }
  return false;
}

/** True when the target time is already buffered (no transcode restart needed). */
export function isTimeBuffered(video: HTMLVideoElement, seconds: number, slack = 0.35): boolean {
  return isLocalTimeBuffered(video, seconds, slack);
}

/** Seek with HLS seekable-range clamping — iOS native HLS ignores out-of-range seeks. */
export function seekVideoTo(
  video: HTMLVideoElement,
  seconds: number,
  fallbackSeconds = 0,
): void {
  const dur = effectiveVideoDuration(video, fallbackSeconds);
  let target = Math.max(0, seconds);
  if (dur > 0) target = Math.min(target, dur);

  if (video.seekable.length > 0) {
    for (let i = 0; i < video.seekable.length; i++) {
      const start = video.seekable.start(i);
      const end = video.seekable.end(i);
      if (target >= start && target <= end) {
        applyVideoSeek(video, target);
        return;
      }
      if (target <= end) {
        applyVideoSeek(video, Math.max(start, target));
        return;
      }
    }
  }

  applyVideoSeek(video, target);
}

function applyVideoSeek(video: HTMLVideoElement, target: number): void {
  if (typeof video.fastSeek === "function") {
    try {
      video.fastSeek(target);
      return;
    } catch {
      /* fall through to currentTime */
    }
  }
  video.currentTime = target;
}

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** True when the device is held portrait — used to rotate in-page player on iOS. */
export function isDevicePortrait(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(orientation: portrait)").matches;
}

/** iOS home-screen PWA: native video fullscreen typically rotates to landscape. */
export function enterIosNativeVideoFullscreen(video: HTMLVideoElement): boolean {
  const v = video as WebkitVideo;
  if (!isAppleMobileDevice() || typeof v.webkitEnterFullscreen !== "function") {
    return false;
  }
  if (v.webkitDisplayingFullscreen) return true;
  try {
    v.webkitEnterFullscreen();
    return true;
  } catch {
    return false;
  }
}

/**
 * Enter mobile immersive playback. Call synchronously from a user gesture (tap / play).
 * Uses in-page pseudo fullscreen; portrait devices rotate the shell via CSS (see globals.css).
 * Native iOS video fullscreen is only used from the explicit fullscreen control.
 */
export function beginMobileImmersivePlayback(_video: HTMLVideoElement): "pseudo" {
  return "pseudo";
}

/** Best-effort landscape lock after mobile fullscreen (Android; iOS ignores). */
export async function lockPlaybackLandscape(): Promise<void> {
  if (typeof screen === "undefined") return;
  const type = screen.orientation?.type ?? "";
  if (type.startsWith("portrait")) {
    return;
  }
  const orientation = screen.orientation as ScreenOrientation & {
    lock?: (type: string) => Promise<void>;
  };
  if (!orientation?.lock) return;
  try {
    await orientation.lock("landscape");
  } catch {
    // Requires fullscreen on many browsers; unsupported on iOS Safari.
  }
}

export function unlockPlaybackOrientation(): void {
  if (typeof screen === "undefined") return;
  try {
    screen.orientation?.unlock?.();
  } catch {
    // ignore
  }
}

/** Clear player scroll/orientation locks so browse pages scroll on mobile (Android PWA). */
export function releaseBrowseScrollLock(): void {
  if (typeof document === "undefined") return;
  delete document.documentElement.dataset.playerImmersive;
  document.documentElement.style.removeProperty("overflow");
  document.body.style.removeProperty("overflow");
  document.body.style.removeProperty("position");
  document.body.style.removeProperty("height");
  document.body.style.removeProperty("touch-action");
  unlockPlaybackOrientation();
}

/** Toggle fullscreen on the player shell so custom controls stay visible. Returns true if API fullscreen changed. */
export async function toggleVideoFullscreen(
  video: HTMLVideoElement,
  shell: HTMLElement,
): Promise<boolean> {
  const v = video as WebkitVideo;

  if (v.webkitDisplayingFullscreen) {
    v.webkitExitFullscreen?.();
    return true;
  }

  const fsEl = document.fullscreenElement;
  if (fsEl === shell || fsEl === video) {
    await document.exitFullscreen();
    return true;
  }

  try {
    await shell.requestFullscreen();
    return true;
  } catch {
    // iOS / denied — caller may use in-page immersive fallback.
  }

  return false;
}
