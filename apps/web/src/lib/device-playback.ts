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
};

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

/** True when a packaged-HLS local time is already buffered. */
export function isLocalTimeBuffered(
  video: HTMLVideoElement,
  localSeconds: number,
  slack = 0.35,
): boolean {
  if (video.seekable.length === 0) {
    return false;
  }
  for (let i = 0; i < video.seekable.length; i += 1) {
    const start = video.seekable.start(i);
    const end = video.seekable.end(i);
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

/** Best-effort landscape lock after mobile fullscreen (Android; iOS ignores). */
export async function lockPlaybackLandscape(): Promise<void> {
  if (typeof screen === "undefined") return;
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

export async function toggleVideoFullscreen(
  video: HTMLVideoElement,
  shell: HTMLElement,
): Promise<void> {
  const v = video as WebkitVideo;

  if (typeof v.webkitEnterFullscreen === "function") {
    if (v.webkitDisplayingFullscreen) {
      v.webkitExitFullscreen?.();
    } else {
      v.webkitEnterFullscreen();
    }
    return;
  }

  const fsEl = document.fullscreenElement;
  if (fsEl === shell || fsEl === video) {
    await document.exitFullscreen();
    return;
  }

  try {
    await video.requestFullscreen();
    return;
  } catch {
    // Android WebView / older browsers may only support element fullscreen on the shell.
  }

  try {
    await shell.requestFullscreen();
  } catch {
    // Fullscreen API unavailable or denied.
  }
}
