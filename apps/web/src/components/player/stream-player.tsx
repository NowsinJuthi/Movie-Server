"use client";

import type Hls from "hls.js";
import {
  AudioLines,
  Captions,
  Cast,
  Check,
  ChevronLeft,
  Gauge,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  Settings,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type {
  PlaybackMarkers,
  PlaybackSessionInfo,
  PlaybackTrack,
  VideoQuality,
  VideoResolution,
} from "@movie-server/shared";
import { emptyPlaybackMarkers, ErrorCode } from "@movie-server/shared";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { streamApi } from "@/lib/stream-api";
import { cn } from "@/lib/utils";
import {
  clearPlayerReturn,
  consumeMobileAutoplayTap,
  isSafeAppPath,
  peekPlayerReturn,
} from "@/lib/player-return";
import {
  browserSupportsHevcDirectStream,
  displayTimelineSeconds,
  effectiveVideoDuration,
  isAppleMobileDevice,
  isCoarsePointerMobile,
  isLocalTimeBuffered,
  isVideoInNativeFullscreen,
  localTimelineSeconds,
  lockPlaybackLandscape,
  seekVideoTo,
  toggleVideoFullscreen,
  unlockPlaybackOrientation,
} from "@/lib/device-playback";
import { useMobilePlayerLayout } from "@/hooks/use-mobile-player-layout";
import { appendStreamQuery, toAbsoluteStreamUrl, variantHlsUrl } from "@/lib/stream-url";
import { EmbyMobileChrome, MobileBottomSheet } from "./emby-mobile-chrome";
import { PlayerDetailsDock, type PlayerDetailsTab } from "./player-sheets";
import { SeekBar } from "./seek-bar";
import { VolumeBar } from "./volume-bar";
import type { PlayerMediaInfo } from "./player-types";

type PlayerSheet = "info" | "chapters" | "cast" | "settings" | "audio" | "speed" | "subtitles" | null;
type SettingsView = "root" | "aspect" | "quality" | "repeat" | "correction" | "more";
type AspectRatio = "auto" | "cover" | "fill" | "16:9" | "4:3";
type RepeatMode = "none" | "one";

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
const ASPECT_OPTIONS: Array<{ id: AspectRatio; label: string }> = [
  { id: "auto", label: "Auto" },
  { id: "cover", label: "Cover" },
  { id: "fill", label: "Fill" },
  { id: "16:9", label: "16:9" },
  { id: "4:3", label: "4:3" },
];
const REPEAT_OPTIONS: Array<{ id: RepeatMode; label: string }> = [
  { id: "none", label: "None" },
  { id: "one", label: "Repeat one" },
];
const PROGRESS_MS = 10_000;
const HEARTBEAT_MS = 20_000;
const AUTO_NEXT_SECONDS = 5;

export type PlayerNeighbor = {
  id: string;
  title: string;
  href: string;
};

export type StreamStartResult = {
  session: PlaybackSessionInfo | null;
  markers: PlaybackMarkers;
  resumeSeconds: number;
};

type QualityChoice = "auto" | VideoResolution;

type StreamPlayerProps = {
  title: string;
  subtitle?: string;
  year?: number | null;
  mediaInfo?: PlayerMediaInfo | null;
  backHref: string;
  preferredQuality?: VideoQuality;
  startPlayback: (
    quality: VideoQuality,
    options?: { forceVideoTranscode?: boolean },
  ) => Promise<StreamStartResult>;
  saveProgress: (progressSeconds: number, durationSeconds: number) => Promise<void>;
  next?: PlayerNeighbor | null;
  previous?: PlayerNeighbor | null;
  autoPlayNext?: boolean;
};

export function StreamPlayer({
  title,
  subtitle,
  year,
  mediaInfo,
  backHref,
  preferredQuality = "sd",
  startPlayback,
  saveProgress,
  next,
  previous,
  autoPlayNext = false,
}: StreamPlayerProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const returnToRef = useRef<string | null>(null);
  const autoplayRequestedRef = useRef(false);
  /** Recent poster/play tap — may still allow audible start on mobile Safari. */
  const posterTapPlayRef = useRef(false);
  /** Mobile started muted due to autoplay policy — next tap should unmute, not pause. */
  const mobileStartMutedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    autoplayRequestedRef.current = params.get("autoplay") === "1";
    posterTapPlayRef.current = consumeMobileAutoplayTap();
    const from = params.get("from");
    if (isSafeAppPath(from) && !from.includes("/watch")) {
      returnToRef.current = from;
      return;
    }
    returnToRef.current = peekPlayerReturn();
  }, []);

  const goBack = useCallback(() => {
    const target = returnToRef.current;
    clearPlayerReturn();
    if (target) {
      router.push(target);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(backHref);
  }, [backHref, router]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const sessionRef = useRef<PlaybackSessionInfo | null>(null);
  const markersRef = useRef<PlaybackMarkers>(emptyPlaybackMarkers());
  const resumeRef = useRef(0);
  const resumeApplied = useRef(false);
  /** Movie time (seconds) where the current HLS package started. */
  const mediaOriginRef = useRef(0);
  const usingHlsRef = useRef(false);
  const unmounted = useRef(false);
  const lastSaved = useRef(0);
  const nextStarted = useRef(false);
  const hideTimer = useRef<number | null>(null);
  const recoverCount = useRef(0);
  const seekingRef = useRef(false);
  const seekPlaybackRef = useRef<(seconds: number) => void>(() => undefined);
  const transcodeFallbackRef = useRef(false);
  const transcodeRetryRef = useRef<(() => void) | null>(null);
  const repeatModeRef = useRef<RepeatMode>("none");

  const [session, setSession] = useState<PlaybackSessionInfo | null>(null);
  const [markers, setMarkers] = useState<PlaybackMarkers>(emptyPlaybackMarkers());
  const [loading, setLoading] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [rate, setRate] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const durationHint = useMemo(() => {
    const fromMedia = (mediaInfo?.runtimeMinutes ?? 0) > 0 ? mediaInfo!.runtimeMinutes! * 60 : 0;
    const fromSession = session?.durationSeconds ?? 0;
    return Math.max(fromMedia, fromSession);
  }, [mediaInfo?.runtimeMinutes, session?.durationSeconds]);
  const durationHintRef = useRef(durationHint);
  durationHintRef.current = durationHint;
  const [duration, setDuration] = useState(() => {
    const fromMedia = (mediaInfo?.runtimeMinutes ?? 0) > 0 ? mediaInfo!.runtimeMinutes! * 60 : 0;
    return fromMedia;
  });
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [controls, setControls] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [pip, setPip] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);
  const [quality, setQuality] = useState<QualityChoice>("auto");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [usingHls, setUsingHls] = useState(false);
  const [trackNotice, setTrackNotice] = useState<string | null>(null);
  const [sheet, setSheet] = useState<PlayerSheet>(null);
  const [settingsView, setSettingsView] = useState<SettingsView>("root");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("auto");
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("none");
  const [showStats, setShowStats] = useState(false);
  const [awaitingTap, setAwaitingTap] = useState(false);
  const [iosMutedPlay, setIosMutedPlay] = useState(false);
  const mobileLayout = useMobilePlayerLayout();
  const mobileLayoutRef = useRef(mobileLayout);
  mobileLayoutRef.current = mobileLayout;

  const displayYear = year ?? mediaInfo?.year ?? null;
  const timelineDuration = durationHint > 0 ? durationHint : duration;
  const packagedPlayback = Boolean(
    session && (session.transcode || session.remuxStream || session.hevcStream),
  );
  const chapters = useMemo(() => buildChapters(markers, duration), [markers, duration]);

  const qualities = session?.qualities.filter((item) => item.allowed) ?? [];
  const audioTracks = useMemo(() => session?.audioTracks ?? [], [session]);
  const subtitleTracks = useMemo(() => session?.subtitleTracks ?? [], [session]);
  const selectedAudio = audioTracks.find((track) => track.id === session?.selectedAudioId);
  const selectedSubtitle = subtitleTracks.find((track) => track.id === session?.selectedSubtitleId);

  const inIntro = inWindow(markers.introStartSeconds, markers.introEndSeconds, currentTime);
  const inRecap = inWindow(markers.recapStartSeconds, markers.recapEndSeconds, currentTime);

  const revealControls = useCallback(() => {
    setControls(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (sheet) return;
      if (videoRef.current && !videoRef.current.paused) {
        setControls(false);
      }
    }, 3200);
  }, [sheet]);

  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  useEffect(() => {
    if (!sheet) return;
    setControls(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
  }, [sheet]);

  const persistProgress = useCallback(
    async (force = false) => {
      const video = videoRef.current;
      if (!video) return;
      const videoDur = Number.isFinite(video.duration) ? video.duration : 0;
      const totalSeconds = resolvePlaybackDuration(
        videoDur,
        durationHintRef.current,
        durationHintRef.current,
      );
      if (totalSeconds <= 0) return;
      const seconds = Math.floor(
        usingHlsRef.current
          ? displayTimelineSeconds(
              video.currentTime,
              mediaOriginRef.current,
              durationHintRef.current,
            )
          : video.currentTime,
      );
      if (!force && Math.abs(seconds - lastSaved.current) < 3) {
        return;
      }
      lastSaved.current = seconds;
      try {
        await saveProgress(seconds, Math.max(1, Math.floor(totalSeconds)));
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["series-continue"] }),
          queryClient.invalidateQueries({ queryKey: ["movie-continue"] }),
          queryClient.invalidateQueries({ queryKey: ["continue"] }),
          queryClient.invalidateQueries({ queryKey: ["home"] }),
          queryClient.invalidateQueries({ queryKey: ["watch-history"] }),
          queryClient.invalidateQueries({ queryKey: ["personalization"] }),
        ]);
      } catch {
        /* progress is best-effort; heartbeat still holds the stream slot */
      }
    },
    [saveProgress, queryClient],
  );

  const stopSession = useCallback(async () => {
    const id = sessionRef.current?.id;
    if (!id) return;
    sessionRef.current = null;
    try {
      await streamApi.stop(id);
    } catch {
      /* session TTL will reclaim the slot */
    }
  }, []);

  const detachEngine = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    usingHlsRef.current = false;
    const video = videoRef.current;
    if (video) {
      video.removeAttribute("src");
      video.load();
    }
  }, []);

  const applyResume = useCallback(() => {
    const video = videoRef.current;
    if (!video || resumeApplied.current) return;
    if (usingHlsRef.current) {
      resumeApplied.current = true;
      return;
    }
    const resume = resumeRef.current;
    if (resume > 5 && Number.isFinite(video.duration) && resume < video.duration * 0.95) {
      video.currentTime = resume;
    }
    resumeApplied.current = true;
  }, []);

  const wantsAudibleAutoplay = useCallback((): boolean => {
    if (!autoplayRequestedRef.current && !posterTapPlayRef.current) {
      return false;
    }
    if (typeof navigator !== "undefined" && navigator.userActivation?.isActive) {
      return true;
    }
    return posterTapPlayRef.current;
  }, []);

  const tryStartPlayback = useCallback(async (): Promise<boolean> => {
    const video = videoRef.current;
    if (!video) return false;
    setLoading(true);
    const preferAudible = wantsAudibleAutoplay();
    try {
      if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
        await Promise.race([
          new Promise<void>((resolve, reject) => {
            const cleanup = () => {
              video.removeEventListener("loadedmetadata", onReady);
              video.removeEventListener("error", onErr);
            };
            const onReady = () => {
              cleanup();
              resolve();
            };
            const onErr = () => {
              cleanup();
              reject(new Error("media load failed"));
            };
            video.addEventListener("loadedmetadata", onReady);
            video.addEventListener("error", onErr);
          }),
          new Promise<void>((_, reject) => {
            window.setTimeout(() => reject(new Error("media load timeout")), 60_000);
          }),
        ]);
      }
      video.muted = false;
      setMuted(false);
      await video.play();
      posterTapPlayRef.current = false;
      mobileStartMutedRef.current = false;
      setAwaitingTap(false);
      setIosMutedPlay(false);
      setLoading(false);
      return true;
    } catch {
      // An explicit poster/Play click should still start the movie when the
      // browser blocks audible autoplay after client-side navigation.
      if (preferAudible || autoplayRequestedRef.current) {
        try {
          video.muted = true;
          await video.play();
          setMuted(true);
          if (mobileLayoutRef.current || isCoarsePointerMobile()) {
            mobileStartMutedRef.current = true;
          }
          setAwaitingTap(false);
          setLoading(false);
          return true;
        } catch {
          /* fall through to the manual play affordance */
        }
      }
      setAwaitingTap(true);
      setLoading(false);
      return false;
    }
  }, [wantsAudibleAutoplay]);

  const warmMediaUrl = useCallback(async (url: string) => {
    try {
      const warmBytes = isAppleMobileDevice() ? 8_388_607 : 2_097_151;
      await fetch(url, {
        credentials: "include",
        headers: { Range: `bytes=0-${warmBytes}` },
      });
    } catch {
      /* warm SMB/page cache; playback still works if this fails */
    }
  }, []);

  const usesPackagedHls = useCallback(
    (info: PlaybackSessionInfo) =>
      info.transcode || info.remuxStream || info.hevcStream,
    [],
  );

  const hlsSourceFor = useCallback(
    (info: PlaybackSessionInfo, startSeconds = 0) =>
      usesPackagedHls(info)
        ? variantHlsUrl(info, {
            startSeconds,
            resolution: quality === "auto" ? "auto" : quality,
          })
        : toAbsoluteStreamUrl(info.hlsUrl),
    [quality, usesPackagedHls],
  );

  const startIosMutedPlayback = useCallback((video: HTMLVideoElement) => {
    video.muted = true;
    void video
      .play()
      .then(() => {
        setIosMutedPlay(true);
        mobileStartMutedRef.current = true;
        setAwaitingTap(false);
        setLoading(false);
      })
      .catch(() => {
        setAwaitingTap(true);
        setLoading(false);
      });
  }, []);

  const startMobileAttachedPlayback = useCallback(
    (video: HTMLVideoElement) => {
      // iOS inline video must not stay muted — muted HLS often renders audio-only (black screen).
      if (isAppleMobileDevice()) {
        void tryStartPlayback();
        return;
      }
      if (autoplayRequestedRef.current) {
        void tryStartPlayback();
        return;
      }
      void tryStartPlayback();
    },
    [tryStartPlayback],
  );

  const unlockMobileAudible = useCallback(async (): Promise<boolean> => {
    if (!mobileLayoutRef.current && !isCoarsePointerMobile()) {
      return false;
    }
    if (!mobileStartMutedRef.current && !iosMutedPlay && !awaitingTap) {
      return false;
    }
    const video = videoRef.current;
    if (!video) return false;
    mobileStartMutedRef.current = false;
    video.muted = false;
    setMuted(false);
    setIosMutedPlay(false);
    setAwaitingTap(false);
    try {
      await video.play();
      setLoading(false);
      return true;
    } catch {
      return tryStartPlayback();
    }
  }, [awaitingTap, iosMutedPlay, tryStartPlayback]);

  const attachProgressive = useCallback(
    (info: PlaybackSessionInfo, resolution?: VideoResolution | "auto") => {
      const video = videoRef.current;
      if (!video) return;
      detachEngine();
      setUsingHls(false);
      const chosen =
        resolution && resolution !== "auto"
          ? resolution
          : info.selectedResolution;
      const src = toAbsoluteStreamUrl(
        appendStreamQuery(info.progressiveUrl, {
          quality: chosen ?? undefined,
          audio: info.selectedAudioId ?? undefined,
        }),
      );
      setIosMutedPlay(false);
      video.src = src;
      video.load();
      void warmMediaUrl(src);
      if (isAppleMobileDevice() || mobileLayoutRef.current) {
        const onReady = () => startMobileAttachedPlayback(video);
        if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
          onReady();
        } else {
          video.addEventListener("loadedmetadata", onReady, { once: true });
          video.addEventListener(
            "error",
            () => {
              setLoading(false);
              setAwaitingTap(false);
            },
            { once: true },
          );
        }
        return;
      }
      void tryStartPlayback();
    },
    [detachEngine, startMobileAttachedPlayback, tryStartPlayback, warmMediaUrl],
  );

  /** Safari native HLS — Emby-style segmented stream for fast mobile start. */
  const attachNativeHls = useCallback(
    (info: PlaybackSessionInfo) => {
      const video = videoRef.current;
      if (!video) return;
      detachEngine();
      const origin = Math.max(0, resumeRef.current);
      mediaOriginRef.current = origin;
      usingHlsRef.current = true;
      setUsingHls(true);
      setIosMutedPlay(false);
      video.src = hlsSourceFor(info, origin);
      video.load();
      const onReady = () => startMobileAttachedPlayback(video);
      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
        onReady();
        return;
      }
      video.addEventListener("loadedmetadata", onReady, { once: true });
      video.addEventListener(
        "error",
        () => {
          setUsingHls(false);
          setLoading(false);
          setError(
            usesPackagedHls(info)
              ? "HLS playback failed to start. Tap Retry, or check ffmpeg/SMB access on the server."
              : "This video could not play on iPhone. Use MP4 (H.264 + AAC).",
          );
        },
        { once: true },
      );
    },
    [detachEngine, hlsSourceFor, startMobileAttachedPlayback, usesPackagedHls],
  );

  const attachHls = useCallback(
    (info: PlaybackSessionInfo) => {
      const video = videoRef.current;
      if (!video) return;
      detachEngine();

      const fallback = () => {
        setUsingHls(false);
        if (usesPackagedHls(info) && !transcodeFallbackRef.current) {
          transcodeFallbackRef.current = true;
          transcodeRetryRef.current?.();
          return;
        }
        if (usesPackagedHls(info)) {
          setLoading(false);
          setError(
            "Playback failed to start. Wait a moment and tap Retry, or check that ffmpeg can read this file on the server.",
          );
          return;
        }
        attachProgressive(info, quality === "auto" ? undefined : quality);
      };

      const src = hlsSourceFor(info, resumeRef.current);
      const videoTranscode = info.transcode;
      const encoding = videoTranscode || info.audioTranscode;

      void import("hls.js").then(({ default: HlsLib }) => {
        if (!videoRef.current) return;
        if (HlsLib.isSupported()) {
          const hls = new HlsLib({
            enableWorker: true,
            lowLatencyMode: false,
            liveDurationInfinity: encoding,
            // This is an on-demand movie playlist that grows while ffmpeg packages
            // it, not a broadcast. Never chase its advancing "live edge": doing so
            // auto-jumps the movie forward once ffmpeg gets several segments ahead.
            liveSyncDurationCount: videoTranscode ? 8 : encoding ? 5 : 3,
            liveMaxLatencyDurationCount: Infinity,
            maxLiveSyncPlaybackRate: 1,
            backBufferLength: videoTranscode ? 120 : encoding ? 60 : 30,
            maxBufferLength: videoTranscode ? 120 : encoding ? 60 : 24,
            maxMaxBufferLength: videoTranscode ? 240 : encoding ? 120 : 48,
            maxBufferHole: videoTranscode ? 2 : encoding ? 1 : 0.5,
            highBufferWatchdogPeriod: videoTranscode ? 3 : encoding ? 2 : 1,
            nudgeOffset: 0.2,
            nudgeMaxRetry: videoTranscode ? 12 : encoding ? 8 : 4,
            startFragPrefetch: true,
            capLevelToPlayerSize: !videoTranscode,
            xhrSetup(xhr) {
              xhr.withCredentials = true;
            },
          });
          hlsRef.current = hls;
          mediaOriginRef.current = Math.max(0, resumeRef.current);
          usingHlsRef.current = true;
          setUsingHls(true);

          const startWhenBuffered = (minSeconds: number) => {
            const video = videoRef.current;
            if (!video) {
              void tryStartPlayback();
              return;
            }
            let attempts = 0;
            const tick = () => {
              if (!videoRef.current) return;
              let ahead = 0;
              const localT = video.currentTime;
              for (let i = 0; i < video.buffered.length; i += 1) {
                const start = video.buffered.start(i);
                const end = video.buffered.end(i);
                if (localT >= start - 0.25 && localT <= end + 0.25) {
                  ahead = Math.max(ahead, end - localT);
                }
              }
              if (ahead >= minSeconds || attempts >= 120) {
                void tryStartPlayback();
                return;
              }
              attempts += 1;
              window.setTimeout(tick, 500);
            };
            tick();
          };

          hls.on(HlsLib.Events.MANIFEST_PARSED, () => {
            recoverCount.current = 0;
            if (quality !== "auto") {
              const index = hls.levels.findIndex((level) => levelName(level.height) === quality);
              if (index >= 0) hls.currentLevel = index;
            } else {
              hls.currentLevel = -1;
            }
            if (videoTranscode) {
              setBuffering(true);
              startWhenBuffered(8);
            } else if (info.audioTranscode) {
              setBuffering(true);
              startWhenBuffered(7);
            } else if (info.remuxStream || info.hevcStream) {
              setBuffering(true);
              startWhenBuffered(4);
            } else {
              void tryStartPlayback();
            }
          });
          hls.on(HlsLib.Events.ERROR, (_event, data) => {
            if (!data.fatal) return;
            if (data.type === HlsLib.ErrorTypes.NETWORK_ERROR && recoverCount.current < 4) {
              recoverCount.current += 1;
              hls.startLoad();
              return;
            }
            if (data.type === HlsLib.ErrorTypes.MEDIA_ERROR && recoverCount.current < 3) {
              recoverCount.current += 1;
              hls.recoverMediaError();
              return;
            }
            fallback();
          });
          hls.loadSource(src);
          hls.attachMedia(video);
          return;
        }

        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          mediaOriginRef.current = Math.max(0, resumeRef.current);
          usingHlsRef.current = true;
          setUsingHls(true);
          video.src = src;
          video.load();
          void tryStartPlayback();
          return;
        }

        fallback();
      }).catch(() => fallback());
    },
    [attachProgressive, detachEngine, hlsSourceFor, quality, tryStartPlayback, usesPackagedHls],
  );

  const attachPlayback = useCallback(
    (info: PlaybackSessionInfo) => {
      if (info.directPlay) {
        attachProgressive(info);
        return;
      }
      if (info.hevcStream && !browserSupportsHevcDirectStream()) {
        transcodeFallbackRef.current = true;
        transcodeRetryRef.current?.();
        return;
      }
      // Emby-style: MKV/WebM direct stream + transcode/hevc paths all use packaged HLS.
      if (usesPackagedHls(info)) {
        if (isAppleMobileDevice()) {
          attachNativeHls(info);
        } else {
          attachHls(info);
        }
        return;
      }
      attachProgressive(info);
    },
    [attachHls, attachNativeHls, attachProgressive, usesPackagedHls],
  );

  const boot = useCallback(
    async (requested: VideoQuality, options?: { forceVideoTranscode?: boolean }) => {
      if (options?.forceVideoTranscode) {
        transcodeFallbackRef.current = true;
      } else {
        transcodeFallbackRef.current = false;
      }
      setLoading(true);
      setError(null);
      setCountdown(null);
      nextStarted.current = false;
      resumeApplied.current = false;
      recoverCount.current = 0;
      seekingRef.current = false;
      mediaOriginRef.current = 0;
      usingHlsRef.current = false;
      await stopSession();
      try {
        let result: StreamStartResult;
        const playbackOpts = { forceVideoTranscode: options?.forceVideoTranscode ?? false };
        try {
          result = await startPlayback(requested, playbackOpts);
        } catch (err) {
          if (err instanceof ApiError && err.error === ErrorCode.QualityNotAllowed && requested !== "sd") {
            result = await startPlayback("sd", playbackOpts);
          } else {
            throw err;
          }
        }
        if (unmounted.current) return;
        markersRef.current = result.markers;
        setMarkers(result.markers);
        resumeRef.current = result.resumeSeconds;
        sessionRef.current = result.session;
        setSession(result.session);
        if (!result.session) {
          setLoading(false);
          setError(
            "No streamable video file is linked to this title. Check Admin → Libraries scan, or convert the file to MP4 (H.264 + AAC).",
          );
          return;
        }
        attachPlayback(result.session);
      } catch (err) {
        if (unmounted.current) return;
        setLoading(false);
        setError(err instanceof ApiError ? err.message : "Playback could not start.");
      }
    },
    [attachPlayback, startPlayback, stopSession],
  );

  useEffect(() => {
    transcodeRetryRef.current = () => {
      const q = sessionRef.current?.selectedQuality ?? preferredQuality;
      void boot(q, { forceVideoTranscode: true });
    };
  }, [boot, preferredQuality]);

  useEffect(() => {
    unmounted.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- player mount starts the authorized stream
    void boot(preferredQuality);
    return () => {
      unmounted.current = true;
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      void persistProgress(true);
      void stopSession();
      detachEngine();
    };
    // Boot once per title mount; quality changes are handled in-player.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      void persistProgress();
    }, PROGRESS_MS);
    return () => window.clearInterval(id);
  }, [persistProgress]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const sessionId = sessionRef.current?.id;
      if (!sessionId) return;
      void streamApi.heartbeat(sessionId).catch(async (err) => {
        if (err instanceof ApiError && (err.statusCode === 401 || err.error === ErrorCode.PlaybackSessionExpired)) {
          await boot(preferredQuality);
        }
      });
    }, HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [boot, preferredQuality]);

  useEffect(() => {
    const onHide = () => {
      void persistProgress(true);
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [persistProgress]);

  useEffect(() => {
    if (durationHint <= 0) return;
    setDuration(durationHint);
  }, [durationHint]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const syncBuffered = () => {
      if (!video.buffered.length) {
        setBufferedEnd(0);
        return;
      }
      const origin = usingHlsRef.current ? mediaOriginRef.current : 0;
      const max = durationHintRef.current;
      const displayNow = usingHlsRef.current
        ? displayTimelineSeconds(video.currentTime, origin, max)
        : video.currentTime;
      let localEnd = 0;
      const localT = video.currentTime;
      for (let i = 0; i < video.buffered.length; i += 1) {
        const start = video.buffered.start(i);
        const stop = video.buffered.end(i);
        if (start <= localT && localT <= stop) {
          localEnd = stop;
          break;
        }
        localEnd = Math.max(localEnd, stop);
      }
      if (usingHlsRef.current) {
        localEnd = Math.min(localEnd, localT + 120);
      }
      const end = origin + localEnd;
      setBufferedEnd(max > 0 ? Math.min(end, max) : end);
    };

    const onTime = () => {
      const origin = usingHlsRef.current ? mediaOriginRef.current : 0;
      const displayTime = usingHlsRef.current
        ? displayTimelineSeconds(video.currentTime, origin, durationHintRef.current)
        : video.currentTime;
      setCurrentTime(displayTime);
      if (durationHintRef.current > 0) {
        setDuration(durationHintRef.current);
      } else {
        const dur = Number.isFinite(video.duration) ? video.duration : 0;
        setDuration((prev) => resolvePlaybackDuration(dur, durationHint, prev));
      }
      syncBuffered();
      const credits = markersRef.current.creditsStartSeconds;
      const effectiveDur = durationHintRef.current || durationHint;
      if (
        autoPlayNext &&
        next &&
        !nextStarted.current &&
        ((credits != null && displayTime >= credits) ||
          (effectiveDur > 0 && displayTime >= effectiveDur - 12))
      ) {
        nextStarted.current = true;
        setCountdown(AUTO_NEXT_SECONDS);
      }
    };
    const onPlay = () => {
      setPlaying(true);
      setLoading(false);
      revealControls();
    };
    const onPause = () => {
      setPlaying(false);
      setControls(true);
      void persistProgress(true);
    };
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => {
      setBuffering(false);
      setLoading(false);
    };
    const onSeeked = () => {
      setBuffering(false);
      void persistProgress(true);
    };
    const onLoaded = () => {
      if (durationHintRef.current <= 0) {
        const dur = Number.isFinite(video.duration) ? video.duration : 0;
        setDuration((prev) => resolvePlaybackDuration(dur, durationHint, prev));
      }
      applyResume();
    };
    const onCanPlay = () => {
      applyResume();
    };
    const onEnded = () => {
      void persistProgress(true);
      if (repeatModeRef.current === "one") {
        seekPlaybackRef.current(0);
        return;
      }
      if (autoPlayNext && next) {
        nextStarted.current = true;
        setCountdown((value) => value ?? AUTO_NEXT_SECONDS);
      }
    };
    const onError = () => {
      const info = sessionRef.current;
      if (!info) return;
      if (usesPackagedHls(info) && !transcodeFallbackRef.current) {
        transcodeFallbackRef.current = true;
        transcodeRetryRef.current?.();
        return;
      }
      if (usingHlsRef.current && !usesPackagedHls(info)) {
        attachProgressive(info, quality === "auto" ? undefined : quality);
        return;
      }
      setLoading(false);
      setError(
        usesPackagedHls(info)
          ? "Playback failed. Tap Retry — if it keeps failing, check ffmpeg and SMB access on the server."
          : isAppleMobileDevice()
            ? "This video could not play on iPhone. Use MP4 (H.264 + AAC). MKV/WebM are not supported on iOS."
            : "This file could not be played in the browser. Use MP4 (H.264 + AAC). HEVC/VP9 or unsupported codecs need conversion.",
      );
    };

    video.addEventListener("timeupdate", onTime);
    video.addEventListener("progress", syncBuffered);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("ended", onEnded);
    video.addEventListener("error", onError);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("progress", syncBuffered);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("error", onError);
    };
  }, [applyResume, attachProgressive, autoPlayNext, boot, durationHint, next, persistProgress, preferredQuality, quality, revealControls, usesPackagedHls, usingHls]);

  useEffect(() => {
    if (countdown == null || !next) return;
    if (countdown <= 0) {
      router.push(next.href);
      return;
    }
    const id = window.setTimeout(() => setCountdown((value) => (value == null ? null : value - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [countdown, next, router]);

  useEffect(() => {
    setPipSupported("pictureInPictureEnabled" in document && Boolean(document.pictureInPictureEnabled));

    const syncFullscreen = () => {
      const video = videoRef.current;
      const isFs =
        Boolean(document.fullscreenElement) ||
        (video != null && isVideoInNativeFullscreen(video));
      setFullscreen(isFs);
      if (isFs && mobileLayoutRef.current) {
        void lockPlaybackLandscape();
      } else if (!isFs) {
        unlockPlaybackOrientation();
      }
    };
    const onPip = () => setPip(Boolean(document.pictureInPictureElement));
    document.addEventListener("fullscreenchange", syncFullscreen);
    document.addEventListener("enterpictureinpicture", onPip);
    document.addEventListener("leavepictureinpicture", onPip);

    const video = videoRef.current;
    video?.addEventListener("webkitbeginfullscreen", syncFullscreen);
    video?.addEventListener("webkitendfullscreen", syncFullscreen);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreen);
      document.removeEventListener("enterpictureinpicture", onPip);
      document.removeEventListener("leavepictureinpicture", onPip);
      video?.removeEventListener("webkitbeginfullscreen", syncFullscreen);
      video?.removeEventListener("webkitendfullscreen", syncFullscreen);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (mobileLayout || isCoarsePointerMobile()) {
      if (mobileStartMutedRef.current || iosMutedPlay || awaitingTap) {
        void unlockMobileAudible();
        return;
      }
    } else if (iosMutedPlay || awaitingTap) {
      void tryStartPlayback();
      return;
    }
    if (video.paused) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [awaitingTap, iosMutedPlay, mobileLayout, tryStartPlayback, unlockMobileAudible]);

  const seekPlaybackTo = useCallback(
    async (targetSeconds: number) => {
      const video = videoRef.current;
      const info = sessionRef.current;
      if (!video || !info || seekingRef.current) return;
      const total = durationHintRef.current || duration;
      const target = Math.max(0, Math.min(targetSeconds, total > 0 ? total : targetSeconds));
      const beforeSeek = displayTimelineSeconds(
        video.currentTime,
        mediaOriginRef.current,
        total,
      );
      const previousOrigin = mediaOriginRef.current;

      setCurrentTime(target);

      if (!usingHlsRef.current || !usesPackagedHls(info)) {
        seekVideoTo(video, target, total);
        setCurrentTime(target);
        return;
      }

      const origin = mediaOriginRef.current;
      const localTarget = localTimelineSeconds(target, origin);
      // A target before the current package origin cannot be represented as local time 0.
      // Restart packaging from that movie position instead of snapping back to the origin.
      const targetIsInCurrentPack = target >= origin - 0.35;
      if (targetIsInCurrentPack && isLocalTimeBuffered(video, localTarget)) {
        video.currentTime = localTarget;
        setCurrentTime(target);
        return;
      }

      seekingRef.current = true;
      setBuffering(true);
      try {
        mediaOriginRef.current = target;
        const nextSrc = `${variantHlsUrl(info, {
          startSeconds: target,
          resolution: quality === "auto" ? "auto" : quality,
        })}&_=${Date.now()}`;

        const hls = hlsRef.current;
        if (hls) {
          const { default: HlsLib } = await import("hls.js");
          await new Promise<void>((resolve, reject) => {
            const timeout = window.setTimeout(() => {
              hls.off(HlsLib.Events.MANIFEST_PARSED, onParsed);
              hls.off(HlsLib.Events.ERROR, onError);
              reject(new Error("Seek timed out"));
            }, 90_000);
            const onParsed = () => {
              window.clearTimeout(timeout);
              hls.off(HlsLib.Events.MANIFEST_PARSED, onParsed);
              hls.off(HlsLib.Events.ERROR, onError);
              resolve();
            };
            const onError = (_event: string, data: { fatal?: boolean }) => {
              if (!data.fatal) return;
              window.clearTimeout(timeout);
              hls.off(HlsLib.Events.MANIFEST_PARSED, onParsed);
              hls.off(HlsLib.Events.ERROR, onError);
              reject(new Error("Seek failed"));
            };
            hls.stopLoad();
            hls.on(HlsLib.Events.MANIFEST_PARSED, onParsed);
            hls.on(HlsLib.Events.ERROR, onError);
            hls.loadSource(nextSrc);
            hls.startLoad(0);
          });
        } else {
          video.src = nextSrc;
          video.load();
          await new Promise<void>((resolve, reject) => {
            const timeout = window.setTimeout(() => reject(new Error("Seek timed out")), 90_000);
            video.addEventListener(
              "loadedmetadata",
              () => {
                window.clearTimeout(timeout);
                resolve();
              },
              { once: true },
            );
            video.addEventListener(
              "error",
              () => {
                window.clearTimeout(timeout);
                reject(new Error("Seek failed"));
              },
              { once: true },
            );
          });
        }

        setCurrentTime(target);
        void video.play().catch(() => undefined);
      } catch {
        mediaOriginRef.current = previousOrigin;
        setCurrentTime(beforeSeek);
        setError("Seek failed. Try again in a moment.");
      } finally {
        seekingRef.current = false;
        setBuffering(false);
      }
    },
    [duration, quality, usesPackagedHls],
  );

  seekPlaybackRef.current = (seconds) => {
    void seekPlaybackTo(seconds);
  };

  const seekBy = useCallback(
    (delta: number) => {
      const video = videoRef.current;
      if (!video) return;
      const display = usingHlsRef.current
        ? displayTimelineSeconds(
            video.currentTime,
            mediaOriginRef.current,
            durationHintRef.current,
          )
        : video.currentTime;
      void seekPlaybackTo(display + delta);
      revealControls();
    },
    [revealControls, seekPlaybackTo],
  );

  const seekToRatio = useCallback(
    (ratio: number) => {
      const video = videoRef.current;
      if (!video) return;
      const dur = durationHintRef.current || duration;
      if (dur <= 0) return;
      const clamped = Math.min(1, Math.max(0, ratio));
      void seekPlaybackTo(dur * clamped);
      revealControls();
    },
    [duration, revealControls, seekPlaybackTo],
  );

  const changeVolume = useCallback((nextVolume: number) => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return;
    const value = Math.min(1, Math.max(0, nextVolume));
    video.volume = value;
    if (audio) audio.volume = value;
    video.muted = value === 0;
    if (audio) audio.muted = value === 0;
    setVolume(value);
    setMuted(value === 0);
  }, []);

  const changeRate = useCallback((nextRate: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = nextRate;
    setRate(nextRate);
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return;
    const next = !muted;
    setMuted(next);
    if (audio?.src) {
      audio.muted = next;
      video.muted = true;
    } else {
      video.muted = next;
    }
  }, [muted]);

  const toggleFullscreen = useCallback(async () => {
    const shell = shellRef.current;
    const video = videoRef.current;
    if (!shell || !video) return;

    if (mobileLayout || isAppleMobileDevice()) {
      await toggleVideoFullscreen(video, shell);
      const isFs =
        Boolean(document.fullscreenElement) ||
        isVideoInNativeFullscreen(video);
      if (isFs && mobileLayout) {
        void lockPlaybackLandscape();
      } else if (!isFs) {
        unlockPlaybackOrientation();
      }
      return;
    }

    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await shell.requestFullscreen();
    }
  }, [mobileLayout]);

  const togglePip = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !pipSupported) return;
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else {
      await video.requestPictureInPicture();
    }
  }, [pipSupported]);

  const skipTo = useCallback((seconds: number | null) => {
    if (seconds == null) return;
    void seekPlaybackTo(seconds);
  }, [seekPlaybackTo]);

  const applyQuality = useCallback(
    (choice: QualityChoice) => {
      setQuality(choice);
      const info = sessionRef.current;
      const hls = hlsRef.current;
      if (hls && choice === "auto") {
        hls.currentLevel = -1;
        return;
      }
      if (hls && choice !== "auto") {
        const index = hls.levels.findIndex((level) => levelName(level.height) === choice);
        if (index >= 0) {
          hls.currentLevel = index;
          return;
        }
      }
      if (info) {
        const video = videoRef.current;
        if (video) {
          resumeRef.current = usingHlsRef.current
            ? displayTimelineSeconds(
                video.currentTime,
                mediaOriginRef.current,
                durationHintRef.current,
              )
            : video.currentTime;
          resumeApplied.current = false;
        }
        if (usingHls) {
          attachHls(info);
        } else {
          attachProgressive(info, choice);
        }
      }
    },
    [attachHls, attachProgressive, usingHls],
  );

  const applyTracks = useCallback(
    async (input: { audioId?: string; subtitleId?: string | null }) => {
      const id = sessionRef.current?.id;
      if (!id) return;
      const video = videoRef.current;
      const movieTime = video
        ? usingHlsRef.current
          ? displayTimelineSeconds(
              video.currentTime,
              mediaOriginRef.current,
              durationHintRef.current,
            )
          : video.currentTime
        : currentTime;
      try {
        const body = await streamApi.selectTracks(id, input);
        sessionRef.current = body.session;
        setSession(body.session);
        const audio = body.session.audioTracks.find((track) => track.id === body.session.selectedAudioId);
        const sub = body.session.subtitleTracks.find((track) => track.id === body.session.selectedSubtitleId);
        if (input.audioId && audio?.url) {
          setTrackNotice(null);
        } else if (input.audioId && audio?.embedded) {
          setTrackNotice(null);
        } else if (input.audioId && audio && !audio.playable) {
          setTrackNotice("Audio language saved. A separate audio file is not attached for this track.");
        } else if (input.subtitleId && sub && !sub.playable) {
          setTrackNotice("This subtitle format is not playable. SRT and WebVTT are supported.");
        } else {
          setTrackNotice(null);
        }
        if (input.audioId && audio?.embedded && usesPackagedHls(body.session)) {
          resumeRef.current = Math.max(0, movieTime);
          resumeApplied.current = false;
          audioRef.current?.pause();
          audioRef.current?.removeAttribute("src");
          if (videoRef.current) videoRef.current.muted = muted;
          if (isAppleMobileDevice()) {
            attachNativeHls(body.session);
          } else {
            attachHls(body.session);
          }
        }
        await queryClient.invalidateQueries({ queryKey: ["active-profile"] });
      } catch (err) {
        setTrackNotice(err instanceof ApiError ? err.message : "Could not switch tracks.");
      }
    },
    [attachHls, attachNativeHls, currentTime, muted, queryClient, usesPackagedHls],
  );

  useEffect(() => {
    const video = videoRef.current;
    const track = selectedSubtitle;
    video?.querySelector('track[data-cv="subs"]')?.remove();
    if (!video || !track?.url) {
      if (video) {
        for (let i = 0; i < video.textTracks.length; i += 1) {
          video.textTracks[i].mode = "disabled";
        }
      }
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(track.url!, { credentials: "include" });
        if (!res.ok) {
          throw new Error("unavailable");
        }
        const text = await res.text();
        if (!text.includes("WEBVTT")) {
          throw new Error("unsupported");
        }
        if (cancelled) return;
        objectUrl = URL.createObjectURL(new Blob([text], { type: "text/vtt" }));
        const el = document.createElement("track");
        el.kind = "subtitles";
        el.label = track.label;
        el.srclang = track.language ?? "und";
        el.src = objectUrl;
        el.default = true;
        el.dataset.cv = "subs";
        video.appendChild(el);
        const show = () => {
          for (let i = 0; i < video.textTracks.length; i += 1) {
            video.textTracks[i].mode = "showing";
          }
        };
        el.addEventListener("load", show);
        show();
      } catch {
        if (!cancelled) {
          setTrackNotice("Subtitles could not be loaded for this track.");
        }
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      video.querySelector('track[data-cv="subs"]')?.remove();
    };
  }, [selectedSubtitle?.id, selectedSubtitle?.url]);

  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !audio) return;
    const packagedEmbeddedAudio = Boolean(
      selectedAudio?.embedded && session && usesPackagedHls(session),
    );

    const enableEmbedded = (index: number | null) => {
      const list = getVideoAudioTracks(video);
      if (!list || list.length === 0) return false;
      for (let i = 0; i < list.length; i += 1) {
        list[i].enabled = index == null ? i === 0 : i === index;
      }
      return true;
    };

    const loadExtracted = (baseUrl: string, atSeconds: number) => {
      const url = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}t=${Math.max(0, Math.floor(atSeconds))}`;
      if (audio.getAttribute("src") !== url) {
        audio.src = url;
      }
      audio.volume = volume;
      audio.muted = muted;
      video.muted = true;
      audio.playbackRate = video.playbackRate;
      if (!video.paused) {
        void audio.play().catch(() => {
          setTrackNotice("This audio track could not be played. Staying on the original soundtrack.");
        });
      }
    };

    if (selectedAudio?.url && !packagedEmbeddedAudio) {
      // iOS: split audio mutes the video element and commonly yields a black picture.
      if (isAppleMobileDevice()) {
        audio.pause();
        audio.removeAttribute("src");
        video.muted = muted;
        enableEmbedded(0);
        return;
      }
      const baseUrl = selectedAudio.url;
      const liveExtract = Boolean(selectedAudio.embedded);
      const movieTime = () =>
        usingHlsRef.current
          ? displayTimelineSeconds(
              video.currentTime,
              mediaOriginRef.current,
              durationHintRef.current,
            )
          : video.currentTime;
      loadExtracted(baseUrl, liveExtract ? movieTime() : 0);
      if (!liveExtract) {
        enableEmbedded(0);
      }
      const sync = () => {
        if (liveExtract) return;
        const target = movieTime();
        if (Math.abs(audio.currentTime - target) > 0.35) {
          audio.currentTime = target;
        }
      };
      const onPlay = () => {
        audio.playbackRate = video.playbackRate;
        void audio.play().catch(() => {
          setTrackNotice("This audio track could not be played. Staying on the original soundtrack.");
        });
      };
      const onPause = () => audio.pause();
      const onRate = () => {
        audio.playbackRate = video.playbackRate;
      };
      const onSeeked = () => {
        if (liveExtract) {
          loadExtracted(baseUrl, movieTime());
          return;
        }
        sync();
      };
      video.addEventListener("play", onPlay);
      video.addEventListener("pause", onPause);
      video.addEventListener("seeked", onSeeked);
      video.addEventListener("timeupdate", sync);
      video.addEventListener("ratechange", onRate);
      if (!video.paused) onPlay();
      return () => {
        video.removeEventListener("play", onPlay);
        video.removeEventListener("pause", onPause);
        video.removeEventListener("seeked", onSeeked);
        video.removeEventListener("timeupdate", sync);
        video.removeEventListener("ratechange", onRate);
      };
    }

    audio.pause();
    audio.removeAttribute("src");
    video.muted = muted;
    enableEmbedded(selectedAudio?.embedded ? (selectedAudio.streamIndex ?? 0) : 0);
    return undefined;
  }, [
    muted,
    selectedAudio?.embedded,
    selectedAudio?.id,
    selectedAudio?.streamIndex,
    selectedAudio?.url,
    session,
    usesPackagedHls,
    volume,
  ]);

  const cycleAudio = useCallback(() => {
    if (!audioTracks.length) return;
    const ids = audioTracks.map((track) => track.id);
    const current = session?.selectedAudioId ?? ids[0];
    const index = Math.max(0, ids.indexOf(current));
    void applyTracks({ audioId: ids[(index + 1) % ids.length] });
  }, [applyTracks, audioTracks, session?.selectedAudioId]);

  const toggleAudioMenu = useCallback(() => {
    setSettingsView("root");
    setSheet((current) => (current === "audio" ? null : "audio"));
    setControls(true);
  }, []);

  const toggleSettingsMenu = useCallback(() => {
    setSheet((current) => {
      if (current === "settings") {
        setSettingsView("root");
        return null;
      }
      setSettingsView("root");
      return "settings";
    });
    setControls(true);
  }, []);

  const toggleSpeedMenu = useCallback(() => {
    setSettingsView("root");
    setSheet((current) => (current === "speed" ? null : "speed"));
    setControls(true);
  }, []);

  const toggleSubtitlesMenu = useCallback(() => {
    setSettingsView("root");
    setSheet((current) => (current === "subtitles" ? null : "subtitles"));
    setControls(true);
  }, []);

  const selectAudio = useCallback(
    (audioId: string) => {
      void applyTracks({ audioId });
      setSheet(null);
    },
    [applyTracks],
  );

  const selectSubtitle = useCallback(
    (subtitleId: string | null) => {
      void applyTracks({ subtitleId });
      setSheet(null);
    },
    [applyTracks],
  );

  const selectSpeed = useCallback(
    (nextRate: number) => {
      changeRate(nextRate);
      setSheet(null);
    },
    [changeRate],
  );

  const onSkinClick = useCallback(() => {
    if (sheet) {
      setSheet(null);
      setSettingsView("root");
      return;
    }
    if (mobileLayout || isCoarsePointerMobile()) {
      if (mobileStartMutedRef.current || iosMutedPlay || awaitingTap) {
        void unlockMobileAudible();
        revealControls();
        return;
      }
    } else if (iosMutedPlay || awaitingTap) {
      void tryStartPlayback();
      revealControls();
      return;
    }
    if (mobileLayout && !controls) {
      revealControls();
      return;
    }
    togglePlay();
    revealControls();
  }, [
    awaitingTap,
    controls,
    iosMutedPlay,
    mobileLayout,
    revealControls,
    sheet,
    togglePlay,
    tryStartPlayback,
    unlockMobileAudible,
  ]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        return;
      }
      revealControls();
      switch (event.key) {
        case " ":
        case "k":
        case "K":
          event.preventDefault();
          togglePlay();
          break;
        case "f":
        case "F":
          event.preventDefault();
          void toggleFullscreen();
          break;
        case "m":
        case "M":
          event.preventDefault();
          toggleMute();
          break;
        case "ArrowLeft":
          event.preventDefault();
          seekBy(-10);
          break;
        case "ArrowRight":
          event.preventDefault();
          seekBy(10);
          break;
        case "ArrowUp":
          event.preventDefault();
          changeVolume(volume + 0.1);
          break;
        case "ArrowDown":
          event.preventDefault();
          changeVolume(volume - 0.1);
          break;
        case "<":
        case "[":
          event.preventDefault();
          changeRate(SPEEDS[Math.max(0, SPEEDS.indexOf(rate as (typeof SPEEDS)[number]) - 1)] ?? 0.5);
          break;
        case ">":
        case "]":
          event.preventDefault();
          changeRate(SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(rate as (typeof SPEEDS)[number]) + 1)] ?? 2);
          break;
        case "n":
        case "N":
          if (next) router.push(next.href);
          break;
        case "p":
        case "P":
          if (previous) router.push(previous.href);
          break;
        case "i":
        case "I":
          if (inIntro) skipTo(markersRef.current.introEndSeconds);
          else if (inRecap) skipTo(markersRef.current.recapEndSeconds);
          break;
        case "a":
        case "A":
          event.preventDefault();
          if (audioTracks.length > 1) toggleAudioMenu();
          else cycleAudio();
          break;
        case "c":
        case "C":
        case "s":
        case "S":
          event.preventDefault();
          toggleSubtitlesMenu();
          break;
        case "Escape":
          if (sheet === "settings" && settingsView !== "root") {
            setSettingsView("root");
            break;
          }
          if (sheet) {
            setSheet(null);
            setSettingsView("root");
            break;
          }
          if (document.fullscreenElement) void document.exitFullscreen();
          else goBack();
          break;
        default:
          if (/^[0-9]$/.test(event.key)) {
            seekToRatio(Number(event.key) / 10);
          }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    backHref,
    goBack,
    changeRate,
    changeVolume,
    inIntro,
    inRecap,
    next,
    previous,
    rate,
    revealControls,
    router,
    seekBy,
    seekToRatio,
    skipTo,
    toggleFullscreen,
    toggleMute,
    togglePlay,
    volume,
    applyTracks,
    cycleAudio,
    toggleAudioMenu,
    toggleSpeedMenu,
    toggleSubtitlesMenu,
    sheet,
    settingsView,
    audioTracks,
    subtitleTracks,
    session?.selectedAudioId,
    session?.selectedSubtitleId,
  ]);

  const qualityLabel = useMemo(() => {
    if (quality === "auto") return usingHls ? "Auto" : session?.selectedResolution ?? "Auto";
    return quality;
  }, [quality, session?.selectedResolution, usingHls]);
  const qualityMenuValue = useMemo(() => {
    if (quality === "auto") return usingHls ? "Auto" : "Auto - Direct";
    const match = qualities.find((item) => item.resolution === quality);
    return match?.label ?? quality;
  }, [quality, qualities, usingHls]);
  const aspectLabel = ASPECT_OPTIONS.find((item) => item.id === aspectRatio)?.label ?? "Auto";
  const repeatLabel = REPEAT_OPTIONS.find((item) => item.id === repeatMode)?.label ?? "None";
  const detailsTab: PlayerDetailsTab | null =
    sheet === "info" || sheet === "chapters" || sheet === "cast" ? sheet : null;
  const streamSummary = useMemo(() => {
    const parts: string[] = [];
    if (quality === "auto") {
      parts.push(usingHls ? "Auto" : session?.selectedResolution ? String(session.selectedResolution) : "Direct");
    } else {
      parts.push(String(quality));
    }
    if (selectedAudio) parts.push(formatAudioMenuLabel(selectedAudio));
    return parts.join(" ");
  }, [quality, selectedAudio, session?.selectedResolution, usingHls]);
  const videoObjectClass =
    aspectRatio === "cover"
      ? "object-cover"
      : aspectRatio === "fill"
        ? "object-fill"
        : aspectRatio === "16:9"
          ? "object-contain aspect-video max-h-screen w-auto mx-auto"
          : aspectRatio === "4:3"
            ? "object-contain max-h-screen w-auto mx-auto [aspect-ratio:4/3]"
            : "object-contain";

  const controlsVisible = controls || !playing || sheet != null;
  const mobileChromeVisible = mobileLayout && controlsVisible && !loading;
  /** iOS: lift the video above all UI while playing — Safari will not paint frames under overlays. */
  const iosVideoOnTop =
    mobileLayout && isAppleMobileDevice() && playing && sheet == null && !error;
  /** iOS Safari stops painting video when any layer covers it — unmount chrome while playing. */
  const mobileChromeMounted =
    mobileLayout &&
    !iosVideoOnTop &&
    (sheet != null || !playing || controlsVisible || loading || buffering || Boolean(error));
  const closeSheet = () => {
    setSheet(null);
    setSettingsView("root");
  };

  useEffect(() => {
    if (!mobileLayout) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileLayout]);

  return (
    <div
      ref={shellRef}
      className={cn(
        "bg-black text-white",
        mobileLayout
          ? "fixed inset-0 z-50 h-[100dvh] max-h-[100dvh] w-full overflow-hidden"
          : "relative min-h-screen",
      )}
      onMouseMove={revealControls}
      onTouchStart={revealControls}
    >
      <video
        ref={videoRef}
        className={cn(
          "bg-black",
          mobileLayout
            ? cn(
                "absolute inset-0 h-full w-full object-contain",
                iosVideoOnTop ? "z-[200] [transform:translateZ(0)]" : "z-[1]",
              )
            : cn("h-screen w-full", videoObjectClass),
        )}
        playsInline
        autoPlay={mobileLayout && autoplayRequestedRef.current}
        // Legacy iOS inline playback (pre-iOS 10).
        {...({ "webkit-playsinline": "true", "x-webkit-airplay": "allow" } as Record<string, string>)}
        preload="auto"
        onClick={onSkinClick}
      />

      {awaitingTap && !error && !mobileLayout ? (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black/50">
          <button
            type="button"
            className="flex min-h-16 min-w-16 flex-col items-center justify-center gap-3 rounded-full bg-primary px-10 py-5 text-lg font-semibold text-primary-foreground shadow-lg active:scale-95"
            onClick={() => {
              void tryStartPlayback();
            }}
          >
            <Play className="h-10 w-10 fill-current" />
            <span>Tap to play</span>
          </button>
        </div>
      ) : null}
      <audio ref={audioRef} preload="metadata" className="hidden" />

      {showStats ? (
        <div className="pointer-events-none absolute left-4 top-20 z-20 max-w-sm rounded-lg bg-black/75 px-3 py-2 font-mono text-[11px] leading-relaxed text-green-300 ring-1 ring-white/10">
          <p>Player stats</p>
          <p>
            time {formatTime(currentTime)} / {formatTime(duration)}
          </p>
          <p>
            quality {qualityMenuValue}
            {session?.selectedResolution ? ` · ${session.selectedResolution}` : ""}
          </p>
          <p>protocol {usingHls ? "HLS" : "Direct"}</p>
          <p>
            rate {rate}x · vol {Math.round((muted ? 0 : volume) * 100)}%
          </p>
          <p>
            audio {selectedAudio ? formatAudioMenuLabel(selectedAudio) : "default"}
          </p>
          <p>aspect {aspectLabel}</p>
          {buffering ? <p>buffering…</p> : null}
          {trackNotice ? <p className="text-amber-200">{trackNotice}</p> : null}
        </div>
      ) : null}

      {(loading || buffering) && !error && !(mobileLayout && playing && !loading) && !iosVideoOnTop ? (
        <div
          className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/45 backdrop-blur-[1px]"
          role="status"
          aria-live="polite"
        >
          <div className="relative flex h-20 w-20 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary/15 [animation-duration:1.8s]" />
            <span className="absolute inset-1 animate-spin rounded-full border-2 border-transparent border-r-primary/40 border-t-primary shadow-[0_0_28px_rgb(38_191_176/0.28)] [animation-duration:1.1s]" />
            <span className="absolute inset-3 animate-spin rounded-full border border-white/10 border-b-white/70 [animation-direction:reverse] [animation-duration:1.7s]" />
            <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[var(--brand-deep)] shadow-[0_0_24px_rgb(38_191_176/0.42)]">
              <Play className="ml-0.5 h-5 w-5 fill-white text-white" />
            </span>
          </div>
          {loading ? (
            <span className="rounded-full bg-black/35 px-4 py-1.5 text-xs font-medium tracking-wide text-white/80 ring-1 ring-white/10">
              Preparing your movie…
            </span>
          ) : null}
          <span className="sr-only">{loading ? "Loading" : "Buffering"}</span>
        </div>
      ) : null}

      {error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6">
          <div className="max-w-md space-y-4 text-center">
            <p className="text-lg font-medium">{error}</p>
            <div className="flex justify-center gap-3">
              <Button onClick={() => void boot(preferredQuality)}>Retry</Button>
              <Button variant="outline" onClick={goBack}>
                Back
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {inIntro ? (
        <Button
          className="absolute right-6 top-24 z-20 min-h-12 px-6 text-base"
          onClick={() => skipTo(markersRef.current.introEndSeconds)}
        >
          Skip intro
        </Button>
      ) : null}
      {inRecap ? (
        <Button
          className="absolute right-6 top-24 z-20 min-h-12 px-6 text-base"
          onClick={() => skipTo(markersRef.current.recapEndSeconds)}
        >
          Skip recap
        </Button>
      ) : null}

      {countdown != null && next ? (
        <div className="absolute right-6 top-40 z-20 rounded-lg bg-black/80 p-4">
          <p className="text-sm">Next episode in {countdown}s</p>
          <p className="mt-1 text-xs text-white/70">{next.title}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => router.push(next.href)}>
              Play now
            </Button>
            <Button size="sm" variant="outline" onClick={() => setCountdown(null)}>
              Stay
            </Button>
          </div>
        </div>
      ) : null}

      {mobileChromeMounted ? (
      <div
        className={cn(
          "absolute inset-0 z-10 transition-opacity duration-300",
          mobileLayout ? "h-full" : "flex flex-col justify-between",
          !mobileLayout && (controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"),
        )}
      >
        {mobileLayout ? (
          <EmbyMobileChrome
            visible={mobileChromeVisible}
            title={title}
            subtitle={subtitle}
            year={displayYear}
            playing={playing}
            currentTime={currentTime}
            duration={timelineDuration}
            bufferedEnd={bufferedEnd}
            transcode={packagedPlayback}
            fullscreen={fullscreen}
            qualityLabel={qualityMenuValue}
            subtitlesOn={sheet === "subtitles" || Boolean(selectedSubtitle)}
            audioOn={sheet === "audio" || audioTracks.length > 1}
            settingsOn={sheet === "settings"}
            volume={volume}
            muted={muted}
            onGoBack={goBack}
            onVolumeChange={changeVolume}
            onToggleMute={toggleMute}
            onVolumePanelChange={(open) => {
              if (open) {
                setControls(true);
                if (hideTimer.current) window.clearTimeout(hideTimer.current);
              } else {
                revealControls();
              }
            }}
            onSkinClick={onSkinClick}
            onTogglePlay={togglePlay}
            onSeek={seekToRatio}
            onSeekBy={seekBy}
            onScrubbingChange={(active) => {
              if (active) {
                setControls(true);
                if (hideTimer.current) window.clearTimeout(hideTimer.current);
              } else {
                revealControls();
              }
            }}
            onToggleSubtitles={toggleSubtitlesMenu}
            onToggleAudio={toggleAudioMenu}
            onToggleSettings={toggleSettingsMenu}
            onToggleFullscreen={() => void toggleFullscreen()}
            onOpenQuality={() => {
              setSheet("settings");
              setSettingsView("quality");
            }}
          />
        ) : (
          <>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/90" />

        {/* Top bar — back + logo left, volume / cast / pip / fullscreen right */}
        <header className="relative z-10 flex items-center justify-between gap-4 px-5 pt-4 md:px-10 md:pt-6">
          <div className="flex min-w-0 max-w-[60%] items-center gap-1">
            <IconButton label="Back" onClick={goBack}>
              <ChevronLeft className="h-7 w-7" strokeWidth={2.25} />
            </IconButton>
            <button
              type="button"
              onClick={goBack}
              className="min-w-0 text-left"
              aria-label={`Back from ${title}`}
              title="Back"
            >
              <span className="block truncate text-sm font-semibold uppercase tracking-[0.22em] text-white/95 md:text-base">
                {title}
              </span>
              {subtitle ? <span className="mt-0.5 block truncate text-xs text-white/45">{subtitle}</span> : null}
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-1 md:gap-1.5">
            <div className="mr-1 flex items-center gap-2.5">
              <VolumeBar
                className="w-[7.5rem] md:w-36"
                value={muted ? 0 : volume}
                onChange={changeVolume}
              />
              <IconButton label={muted ? "Unmute" : "Mute"} onClick={toggleMute}>
                {muted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </IconButton>
            </div>
            <IconButton label="Cast (not available)" onClick={() => undefined}>
              <Cast className="h-5 w-5 opacity-70" />
            </IconButton>
            {pipSupported ? (
              <IconButton label="Picture in picture" onClick={() => void togglePip()}>
                <PictureInPicture2 className={cn("h-5 w-5", pip && "text-white")} />
              </IconButton>
            ) : null}
            <IconButton label={fullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={() => void toggleFullscreen()}>
              {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </IconButton>
          </div>
        </header>

        <button
          type="button"
          aria-label={playing ? "Pause" : "Play"}
          className="relative z-10 min-h-[30vh] w-full flex-1 cursor-pointer bg-transparent"
          onClick={onSkinClick}
        />

        <div className="relative z-10 px-5 pb-4 md:px-10 md:pb-6">
          {/* Title row + track icons (above scrubber) */}
          <div className="mb-3 flex items-end justify-between gap-4">
            <div className="min-w-0">
              {displayYear ? <p className="text-sm font-normal text-white/70">{displayYear}</p> : null}
              <h1 className="truncate text-2xl font-semibold tracking-tight text-white md:text-3xl">{title}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <div className="relative">
                {sheet === "subtitles" ? (
                  <div
                    role="menu"
                    aria-label="Subtitles"
                    className="absolute bottom-[calc(100%+10px)] right-0 z-30 min-w-[220px] overflow-hidden rounded-2xl bg-[#2a2a2a]/95 py-3 shadow-2xl ring-1 ring-white/10 backdrop-blur-md"
                  >
                    <p className="px-5 pb-2 text-center text-sm font-semibold text-white/90">Subtitles</p>
                    <ul className="max-h-64 overflow-y-auto">
                      <li>
                        <button
                          type="button"
                          role="menuitemradio"
                          aria-checked={!selectedSubtitle}
                          className={cn(
                            "flex w-full items-center gap-3 px-5 py-2.5 text-left text-sm text-white hover:bg-white/10",
                            !selectedSubtitle && "font-medium",
                          )}
                          onClick={() => selectSubtitle(null)}
                        >
                          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
                            {!selectedSubtitle ? <Check className="h-4 w-4" strokeWidth={2.5} /> : null}
                          </span>
                          <span>Off</span>
                        </button>
                      </li>
                      {subtitleTracks.map((track) => {
                        const selected = track.id === session?.selectedSubtitleId;
                        return (
                          <li key={track.id}>
                            <button
                              type="button"
                              role="menuitemradio"
                              aria-checked={selected}
                              disabled={!track.playable}
                              className={cn(
                                "flex w-full items-center gap-3 px-5 py-2.5 text-left text-sm text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40",
                                selected && "font-medium",
                              )}
                              onClick={() => selectSubtitle(track.id)}
                            >
                              <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
                                {selected ? <Check className="h-4 w-4" strokeWidth={2.5} /> : null}
                              </span>
                              <span className="truncate">
                                {track.languageLabel || track.label}
                                {track.format ? ` · ${track.format.toUpperCase()}` : ""}
                                {track.isDefault ? " (Default)" : ""}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
                <IconButton label="Subtitles" onClick={toggleSubtitlesMenu}>
                  <Captions className={cn("h-5 w-5", sheet === "subtitles" && "text-white")} />
                </IconButton>
              </div>
              <div className="relative">
                {sheet === "audio" ? (
                  <div
                    role="menu"
                    aria-label="Audio"
                    className="absolute bottom-[calc(100%+10px)] right-0 z-30 min-w-[220px] overflow-hidden rounded-2xl bg-[#2a2a2a]/95 py-3 shadow-2xl ring-1 ring-white/10 backdrop-blur-md"
                  >
                    <p className="px-5 pb-2 text-center text-sm font-semibold text-white/90">Audio</p>
                    <ul className="max-h-64 overflow-y-auto">
                      {audioTracks.length === 0 ? (
                        <li className="px-5 py-2.5 text-sm text-white/50">Default audio</li>
                      ) : (
                        audioTracks.map((track) => {
                          const selected = track.id === session?.selectedAudioId;
                          return (
                            <li key={track.id}>
                              <button
                                type="button"
                                role="menuitemradio"
                                aria-checked={selected}
                                disabled={!track.playable}
                                className={cn(
                                  "flex w-full items-center gap-3 px-5 py-2.5 text-left text-sm text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40",
                                  selected && "font-medium",
                                )}
                                onClick={() => selectAudio(track.id)}
                              >
                                <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
                                  {selected ? <Check className="h-4 w-4" strokeWidth={2.5} /> : null}
                                </span>
                                <span className="truncate">{formatAudioMenuLabel(track)}</span>
                              </button>
                            </li>
                          );
                        })
                      )}
                    </ul>
                  </div>
                ) : null}
                <IconButton
                  label={
                    audioTracks.length > 1
                      ? `Audio track (${selectedAudio?.languageLabel ?? "default"})`
                      : "Audio track"
                  }
                  onClick={toggleAudioMenu}
                >
                  <AudioLines className={cn("h-5 w-5", (sheet === "audio" || audioTracks.length > 1) && "text-white")} />
                </IconButton>
              </div>
              <div className="relative">
                {sheet === "speed" ? (
                  <div
                    role="menu"
                    aria-label="Playback Speed"
                    className="absolute bottom-[calc(100%+10px)] right-0 z-30 min-w-[168px] overflow-hidden rounded-2xl bg-[#2a2a2a]/95 py-3 shadow-2xl ring-1 ring-white/10 backdrop-blur-md"
                  >
                    <p className="px-5 pb-2 text-center text-sm font-semibold text-white/90">Playback Speed</p>
                    <ul>
                      {SPEEDS.map((speed) => {
                        const selected = Math.abs(rate - speed) < 0.001;
                        return (
                          <li key={speed}>
                            <button
                              type="button"
                              role="menuitemradio"
                              aria-checked={selected}
                              className="relative flex w-full items-center justify-center px-8 py-2.5 text-sm text-white hover:bg-white/10"
                              onClick={() => selectSpeed(speed)}
                            >
                              <span className="absolute left-4 inline-flex h-4 w-4 items-center justify-center">
                                {selected ? <Check className="h-4 w-4" strokeWidth={2.5} /> : null}
                              </span>
                              <span className={cn(selected && "font-medium")}>{formatSpeedLabel(speed)}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
                <IconButton label="Playback speed" onClick={toggleSpeedMenu}>
                  <Gauge className={cn("h-5 w-5", sheet === "speed" && "text-white")} />
                </IconButton>
              </div>
              <div className="relative">
                {sheet === "settings" ? (
                  <div
                    role="menu"
                    aria-label="Settings"
                    className="absolute bottom-[calc(100%+10px)] right-0 z-30 w-[min(92vw,280px)] overflow-hidden rounded-2xl bg-[#2a2a2a]/95 py-2 shadow-2xl ring-1 ring-white/10 backdrop-blur-md"
                  >
                    {settingsView === "root" ? (
                      <ul>
                        <SettingsMenuRow
                          label="Aspect Ratio"
                          value={aspectLabel}
                          onClick={() => setSettingsView("aspect")}
                        />
                        <SettingsMenuRow
                          label="Quality"
                          value={qualityMenuValue}
                          onClick={() => setSettingsView("quality")}
                        />
                        <SettingsMenuRow
                          label="Repeat Mode"
                          value={repeatLabel}
                          onClick={() => setSettingsView("repeat")}
                        />
                        <SettingsMenuRow label="Playback Correction" onClick={() => setSettingsView("correction")} />
                        <SettingsMenuRow
                          label="Stats for Nerds"
                          value={showStats ? "On" : undefined}
                          onClick={() => {
                            setShowStats((value) => !value);
                            setSheet(null);
                            setSettingsView("root");
                          }}
                        />
                        <SettingsMenuRow label="More" onClick={() => setSettingsView("more")} />
                      </ul>
                    ) : null}

                    {settingsView === "aspect" ? (
                      <SettingsSubmenu title="Aspect Ratio" onBack={() => setSettingsView("root")}>
                        {ASPECT_OPTIONS.map((option) => (
                          <SettingsChoiceRow
                            key={option.id}
                            label={option.label}
                            selected={aspectRatio === option.id}
                            onClick={() => {
                              setAspectRatio(option.id);
                              setSettingsView("root");
                            }}
                          />
                        ))}
                      </SettingsSubmenu>
                    ) : null}

                    {settingsView === "quality" ? (
                      <SettingsSubmenu title="Quality" onBack={() => setSettingsView("root")}>
                        <SettingsChoiceRow
                          label={usingHls ? "Auto" : "Auto - Direct"}
                          selected={quality === "auto"}
                          onClick={() => {
                            applyQuality("auto");
                            setSettingsView("root");
                          }}
                        />
                        {qualities.map((item) => (
                          <SettingsChoiceRow
                            key={item.resolution}
                            label={`${item.label} (${item.quality.toUpperCase()})`}
                            selected={quality === item.resolution}
                            disabled={!item.allowed}
                            onClick={() => {
                              applyQuality(item.resolution);
                              setSettingsView("root");
                            }}
                          />
                        ))}
                        {trackNotice ? <p className="px-5 py-2 text-xs text-amber-200">{trackNotice}</p> : null}
                      </SettingsSubmenu>
                    ) : null}

                    {settingsView === "repeat" ? (
                      <SettingsSubmenu title="Repeat Mode" onBack={() => setSettingsView("root")}>
                        {REPEAT_OPTIONS.map((option) => (
                          <SettingsChoiceRow
                            key={option.id}
                            label={option.label}
                            selected={repeatMode === option.id}
                            onClick={() => {
                              setRepeatMode(option.id);
                              setSettingsView("root");
                            }}
                          />
                        ))}
                      </SettingsSubmenu>
                    ) : null}

                    {settingsView === "correction" ? (
                      <SettingsSubmenu title="Playback Correction" onBack={() => setSettingsView("root")}>
                        <SettingsChoiceRow
                          label="Default"
                          selected
                          onClick={() => setSettingsView("root")}
                        />
                      </SettingsSubmenu>
                    ) : null}

                    {settingsView === "more" ? (
                      <SettingsSubmenu title="More" onBack={() => setSettingsView("root")}>
                        <SettingsMenuRow
                          label="Playback Speed"
                          value={formatSpeedLabel(rate)}
                          onClick={() => {
                            setSheet("speed");
                            setSettingsView("root");
                          }}
                        />
                        <SettingsMenuRow
                          label="Audio"
                          value={selectedAudio?.languageLabel ?? "Default"}
                          onClick={() => {
                            setSheet("audio");
                            setSettingsView("root");
                          }}
                        />
                        <SettingsMenuRow
                          label="Subtitles"
                          value={selectedSubtitle?.languageLabel ?? "Off"}
                          onClick={() => {
                            setSheet("subtitles");
                            setSettingsView("root");
                          }}
                        />
                      </SettingsSubmenu>
                    ) : null}
                  </div>
                ) : null}
                <IconButton label="Settings" onClick={toggleSettingsMenu}>
                  <Settings className={cn("h-5 w-5", sheet === "settings" && "text-white")} />
                </IconButton>
              </div>
            </div>
          </div>

          {/* Scrubber — YouTube-style, brand teal */}
          <SeekBar
            currentTime={currentTime}
            duration={timelineDuration}
            bufferedEnd={bufferedEnd}
            transcode={packagedPlayback}
            onSeek={seekToRatio}
            onScrubbingChange={(active) => {
              if (active) {
                setControls(true);
                if (hideTimer.current) window.clearTimeout(hideTimer.current);
              } else {
                revealControls();
              }
            }}
          />

          {/* Transport + times */}
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-1">
              <span className="mr-2 hidden text-sm tabular-nums text-white/85 sm:inline">{formatTime(currentTime)}</span>
              <IconButton label="Rewind 10 seconds" onClick={() => seekBy(-10)}>
                <span className="relative inline-flex h-6 w-6 items-center justify-center">
                  <RotateCcw className="h-6 w-6" strokeWidth={1.75} />
                  <span className="absolute text-[9px] font-bold">10</span>
                </span>
              </IconButton>
              <IconButton label={playing ? "Pause" : "Play"} onClick={togglePlay}>
                {playing ? <Pause className="h-7 w-7 fill-white" /> : <Play className="h-7 w-7 fill-white" />}
              </IconButton>
              <IconButton label="Forward 10 seconds" onClick={() => seekBy(10)}>
                <span className="relative inline-flex h-6 w-6 items-center justify-center">
                  <RotateCw className="h-6 w-6" strokeWidth={1.75} />
                  <span className="absolute text-[9px] font-bold">10</span>
                </span>
              </IconButton>
              {previous ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-1 hidden min-h-10 text-white/80 hover:bg-white/10 md:inline-flex"
                  onClick={() => router.push(previous.href)}
                >
                  Previous
                </Button>
              ) : null}
              {next ? (
                <Button size="sm" className="ml-1 hidden min-h-10 md:inline-flex" onClick={() => router.push(next.href)}>
                  <SkipForward className="h-4 w-4" />
                  Next
                </Button>
              ) : null}
              <span className="ml-2 text-sm tabular-nums text-white/85 sm:hidden">{formatTime(currentTime)}</span>
            </div>
            <div className="shrink-0 text-right text-sm tabular-nums text-white/85">
              <span>-{formatTime(Math.max(0, duration - currentTime))}</span>
              <span className="text-white/45"> / {formatTime(duration)}</span>
              {rate !== 1 || qualityLabel ? (
                <span className="ml-2 hidden text-xs text-white/40 lg:inline">
                  {rate !== 1 ? `${rate}x · ` : null}
                  {qualityLabel}
                </span>
              ) : null}
            </div>
          </div>

          <PlayerDetailsDock
            tab={detailsTab}
            onTabChange={(next) => setSheet(next)}
            title={title}
            info={mediaInfo}
            chapters={chapters}
            streamSummary={streamSummary}
            onSelectChapter={(start) => {
              skipTo(start);
              setSheet(null);
            }}
            onPlayFromBeginning={() => {
              skipTo(0);
              const video = videoRef.current;
              if (video) void video.play().catch(() => undefined);
              setSheet(null);
            }}
          />
        </div>
          </>
        )}
      </div>
      ) : null}

      {mobileLayout && sheet === "subtitles" ? (
        <MobileBottomSheet title="Subtitles" onClose={closeSheet}>
          <ul className="py-2">
            <li>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-3 px-5 py-3.5 text-left text-sm text-white active:bg-white/10",
                  !selectedSubtitle && "font-medium text-primary",
                )}
                onClick={() => selectSubtitle(null)}
              >
                {!selectedSubtitle ? <Check className="h-4 w-4" /> : <span className="w-4" />}
                Off
              </button>
            </li>
            {subtitleTracks.map((track) => {
              const selected = track.id === session?.selectedSubtitleId;
              return (
                <li key={track.id}>
                  <button
                    type="button"
                    disabled={!track.playable}
                    className={cn(
                      "flex w-full items-center gap-3 px-5 py-3.5 text-left text-sm text-white active:bg-white/10 disabled:opacity-40",
                      selected && "font-medium text-primary",
                    )}
                    onClick={() => selectSubtitle(track.id)}
                  >
                    {selected ? <Check className="h-4 w-4" /> : <span className="w-4" />}
                    {track.languageLabel || track.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </MobileBottomSheet>
      ) : null}

      {mobileLayout && sheet === "audio" ? (
        <MobileBottomSheet title="Audio" onClose={closeSheet}>
          <ul className="py-2">
            {audioTracks.length === 0 ? (
              <li className="px-5 py-3 text-sm text-white/50">Default audio</li>
            ) : (
              audioTracks.map((track) => {
                const selected = track.id === session?.selectedAudioId;
                return (
                  <li key={track.id}>
                    <button
                      type="button"
                      disabled={!track.playable}
                      className={cn(
                        "flex w-full items-center gap-3 px-5 py-3.5 text-left text-sm text-white active:bg-white/10 disabled:opacity-40",
                        selected && "font-medium text-primary",
                      )}
                      onClick={() => selectAudio(track.id)}
                    >
                      {selected ? <Check className="h-4 w-4" /> : <span className="w-4" />}
                      {formatAudioMenuLabel(track)}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </MobileBottomSheet>
      ) : null}

      {mobileLayout && sheet === "speed" ? (
        <MobileBottomSheet title="Playback speed" onClose={closeSheet}>
          <ul className="py-2">
            {SPEEDS.map((speed) => {
              const selected = Math.abs(rate - speed) < 0.001;
              return (
                <li key={speed}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-3 px-5 py-3.5 text-sm text-white active:bg-white/10",
                      selected && "font-medium text-primary",
                    )}
                    onClick={() => selectSpeed(speed)}
                  >
                    {selected ? <Check className="h-4 w-4" /> : <span className="w-4" />}
                    {formatSpeedLabel(speed)}
                  </button>
                </li>
              );
            })}
          </ul>
        </MobileBottomSheet>
      ) : null}

      {mobileLayout && sheet === "settings" ? (
        <MobileBottomSheet
          title={
            settingsView === "quality"
              ? "Quality"
              : settingsView === "aspect"
                ? "Aspect ratio"
                : settingsView === "repeat"
                  ? "Repeat"
                  : "Settings"
          }
          onClose={closeSheet}
        >
          {settingsView === "root" ? (
            <ul className="py-1">
              <SettingsMenuRow label="Quality" value={qualityMenuValue} onClick={() => setSettingsView("quality")} />
              <SettingsMenuRow label="Aspect ratio" value={aspectLabel} onClick={() => setSettingsView("aspect")} />
              <SettingsMenuRow label="Playback speed" value={formatSpeedLabel(rate)} onClick={() => setSheet("speed")} />
              <SettingsMenuRow label="Audio" value={selectedAudio?.languageLabel ?? "Default"} onClick={() => setSheet("audio")} />
              <SettingsMenuRow
                label="Subtitles"
                value={selectedSubtitle?.languageLabel ?? "Off"}
                onClick={() => setSheet("subtitles")}
              />
              <SettingsMenuRow label="Repeat" value={repeatLabel} onClick={() => setSettingsView("repeat")} />
            </ul>
          ) : null}
          {settingsView === "quality" ? (
            <ul className="py-1">
              <SettingsChoiceRow
                label={usingHls ? "Auto" : "Auto - Direct"}
                selected={quality === "auto"}
                onClick={() => {
                  applyQuality("auto");
                  closeSheet();
                }}
              />
              {qualities.map((item) => (
                <SettingsChoiceRow
                  key={item.resolution}
                  label={`${item.label} (${item.quality.toUpperCase()})`}
                  selected={quality === item.resolution}
                  disabled={!item.allowed}
                  onClick={() => {
                    applyQuality(item.resolution);
                    closeSheet();
                  }}
                />
              ))}
            </ul>
          ) : null}
          {settingsView === "aspect" ? (
            <ul className="py-1">
              {ASPECT_OPTIONS.map((option) => (
                <SettingsChoiceRow
                  key={option.id}
                  label={option.label}
                  selected={aspectRatio === option.id}
                  onClick={() => {
                    setAspectRatio(option.id);
                    closeSheet();
                  }}
                />
              ))}
            </ul>
          ) : null}
          {settingsView === "repeat" ? (
            <ul className="py-1">
              {REPEAT_OPTIONS.map((option) => (
                <SettingsChoiceRow
                  key={option.id}
                  label={option.label}
                  selected={repeatMode === option.id}
                  onClick={() => {
                    setRepeatMode(option.id);
                    closeSheet();
                  }}
                />
              ))}
            </ul>
          ) : null}
        </MobileBottomSheet>
      ) : null}
    </div>
  );
}

function SettingsMenuRow({
  label,
  value,
  onClick,
}: {
  label: string;
  value?: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        role="menuitem"
        className="flex w-full items-center justify-between gap-8 px-5 py-2.5 text-left text-sm text-white hover:bg-white/10"
        onClick={onClick}
      >
        <span>{label}</span>
        {value != null && value !== "" ? <span className="shrink-0 text-white/45">{value}</span> : null}
      </button>
    </li>
  );
}

function SettingsChoiceRow({
  label,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        role="menuitemradio"
        aria-checked={selected}
        disabled={disabled}
        className={cn(
          "flex w-full items-center gap-3 px-5 py-2.5 text-left text-sm text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40",
          selected && "font-medium",
        )}
        onClick={onClick}
      >
        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
          {selected ? <Check className="h-4 w-4" strokeWidth={2.5} /> : null}
        </span>
        <span className="truncate">{label}</span>
      </button>
    </li>
  );
}

function SettingsSubmenu({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="relative mb-1 flex items-center justify-center px-5 pb-2 pt-1">
        <button
          type="button"
          aria-label="Back"
          className="absolute left-2 inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-white/10"
          onClick={onBack}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="text-sm font-semibold text-white/90">{title}</p>
      </div>
      <ul className="max-h-72 overflow-y-auto">{children}</ul>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-md hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary"
    >
      {children}
    </button>
  );
}

/** HLS packaging reports a growing duration — prefer catalog/runtime when we have it. */
function resolvePlaybackDuration(
  videoSeconds: number,
  hintSeconds: number,
  previousSeconds: number,
): number {
  const video = Number.isFinite(videoSeconds) && videoSeconds > 0 ? videoSeconds : 0;
  const hint = hintSeconds > 0 ? hintSeconds : 0;
  const prev = previousSeconds > 0 ? previousSeconds : 0;

  if (hint > 0) {
    if (video >= hint * 0.95) return Math.max(hint, video);
    return Math.max(prev, hint);
  }
  if (video > 30) return Math.max(prev, video);
  return prev > 0 ? prev : video;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatAudioMenuLabel(track: PlaybackTrack): string {
  const bits: string[] = [track.languageLabel || track.label || "Audio"];
  if (track.codec) bits.push(track.codec.toUpperCase());
  if (track.channels != null) {
    if (track.channels <= 2) bits.push("stereo");
    else if (track.channels === 6) bits.push("5.1");
    else if (track.channels === 8) bits.push("7.1");
    else bits.push(`${track.channels}ch`);
  }
  let text = bits.join(" ");
  if (track.isDefault) text += " (Default)";
  return text;
}

function formatSpeedLabel(speed: number): string {
  if (Math.abs(speed - 1) < 0.001) return "Normal";
  const text = Number.isInteger(speed) ? String(speed) : String(speed);
  return `${text}x`;
}

type BrowserAudioTrack = { enabled: boolean; language?: string; label?: string };
type BrowserAudioTrackList = {
  length: number;
  [index: number]: BrowserAudioTrack;
};

function getVideoAudioTracks(video: HTMLVideoElement): BrowserAudioTrackList | null {
  const list = (video as HTMLVideoElement & { audioTracks?: BrowserAudioTrackList }).audioTracks;
  return list && list.length > 0 ? list : null;
}

function buildChapters(
  markers: PlaybackMarkers,
  duration: number,
): Array<{ label: string; startSeconds: number }> {
  const items: Array<{ label: string; startSeconds: number }> = [{ label: "Start", startSeconds: 0 }];
  if (markers.introStartSeconds != null) {
    items.push({ label: "Intro", startSeconds: markers.introStartSeconds });
  }
  if (markers.creditsStartSeconds != null) {
    items.push({ label: "Credits", startSeconds: markers.creditsStartSeconds });
  } else if (duration > 60) {
    items.push({ label: "Near end", startSeconds: Math.max(0, duration - 90) });
  }
  const seen = new Set<number>();
  return items.filter((item) => {
    const key = Math.floor(item.startSeconds);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function inWindow(start: number | null, end: number | null, current: number): boolean {
  if (start == null || end == null || end <= start) return false;
  return current >= start && current < end;
}

function levelName(height: number): VideoResolution | null {
  if (height <= 480) return "480p";
  if (height <= 720) return "720p";
  if (height <= 1080) return "1080p";
  return "4k";
}
