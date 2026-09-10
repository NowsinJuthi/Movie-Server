import { asProfileLanguage, languageLabel, LibraryProbe, VideoResolution } from '@movie-server/shared';
import { detectLanguageHint } from '../matching/filename-parser';

export function resolutionFromDimensions(width?: number | null, height?: number | null): VideoResolution {
  const h = height ?? 0;
  const w = width ?? 0;
  if (h >= 2160 || w >= 3840) {
    return VideoResolution.Uhd4k;
  }
  if (h >= 1080 || w >= 1920) {
    return VideoResolution.P1080;
  }
  if (h >= 720 || w >= 1280) {
    return VideoResolution.P720;
  }
  return VideoResolution.P480;
}

export function emptyProbe(sizeBytes: number): LibraryProbe {
  return {
    durationMs: null,
    width: null,
    height: null,
    resolution: null,
    videoCodec: null,
    audioCodec: null,
    bitrateKbps: null,
    sizeBytes,
    videoStreams: [],
    audioTracks: [],
    subtitleTracks: [],
  };
}

export function audioCodecFromName(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop();
  if (ext === 'm4a' || ext === 'aac') return 'aac';
  if (ext === 'mp3') return 'mp3';
  if (ext === 'ac3') return 'ac3';
  if (ext === 'eac3') return 'eac3';
  if (ext === 'ogg') return 'vorbis';
  if (ext === 'opus') return 'opus';
  if (ext === 'wav') return 'pcm';
  if (ext === 'flac') return 'flac';
  return 'aac';
}

export function probeFromAudioFilename(fileName: string, sizeBytes: number): LibraryProbe {
  const codec = audioCodecFromName(fileName);
  const language = detectLanguageHint(fileName) ?? 'und';
  return {
    ...emptyProbe(sizeBytes),
    audioCodec: codec,
    audioTracks: [
      {
        index: 0,
        codec,
        language,
        channels: 2,
        bitrateKbps: 192,
        label: languageLabel(language),
      },
    ],
  };
}

export function probeFromFilename(fileName: string, sizeBytes: number): LibraryProbe {
  const lower = fileName.toLowerCase();
  let width = 1920;
  let height = 1080;
  if (/\b(2160p|4k|uhd)\b/.test(lower)) {
    width = 3840;
    height = 2160;
  } else if (/\b720p\b/.test(lower)) {
    width = 1280;
    height = 720;
  } else if (/\b480p\b/.test(lower)) {
    width = 854;
    height = 480;
  }
  const resolution = resolutionFromDimensions(width, height);
  return {
    durationMs: 7_200_000,
    width,
    height,
    resolution,
    videoCodec: 'h264',
    audioCodec: 'aac',
    bitrateKbps: resolution === VideoResolution.Uhd4k ? 20_000 : resolution === VideoResolution.P1080 ? 5_000 : 2_500,
    sizeBytes,
    videoStreams: [
      {
        index: 0,
        codec: 'h264',
        width,
        height,
        bitrateKbps: resolution === VideoResolution.Uhd4k ? 18_000 : 4_500,
        fps: 24,
      },
    ],
    audioTracks: [
      {
        index: 1,
        codec: 'aac',
        language: 'en',
        channels: 2,
        bitrateKbps: 192,
        label: 'English',
      },
    ],
    subtitleTracks: [
      {
        index: 2,
        codec: 'subrip',
        language: 'en',
        forced: false,
        hearingImpaired: false,
      },
    ],
  };
}

type FfprobeStream = {
  index?: number;
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  channels?: number;
  bit_rate?: string | number;
  avg_frame_rate?: string;
  tags?: { language?: string; title?: string; LANGUAGE?: string };
  disposition?: { forced?: number; hearing_impaired?: number };
};

type FfprobeFormat = {
  duration?: string | number;
  bit_rate?: string | number;
  size?: string | number;
};

export function parseFfprobeJson(raw: string, sizeBytes: number): LibraryProbe {
  const parsed = JSON.parse(raw) as { streams?: FfprobeStream[]; format?: FfprobeFormat };
  const streams = parsed.streams ?? [];
  const format = parsed.format ?? {};
  const videoStreams = streams
    .filter((stream) => stream.codec_type === 'video')
    .map((stream) => ({
      index: stream.index ?? 0,
      codec: stream.codec_name ?? null,
      width: stream.width ?? null,
      height: stream.height ?? null,
      bitrateKbps: toKbps(stream.bit_rate),
      fps: parseFps(stream.avg_frame_rate),
    }));
  const audioTracks = streams
    .filter((stream) => stream.codec_type === 'audio')
    .map((stream) => ({
      index: stream.index ?? 0,
      codec: stream.codec_name ?? null,
      language: languageOf(stream),
      channels: stream.channels ?? null,
      bitrateKbps: toKbps(stream.bit_rate),
      label: stream.tags?.title ?? null,
    }));
  const subtitleTracks = streams
    .filter((stream) => stream.codec_type === 'subtitle')
    .map((stream) => ({
      index: stream.index ?? 0,
      codec: stream.codec_name ?? null,
      language: languageOf(stream),
      forced: Boolean(stream.disposition?.forced),
      hearingImpaired: Boolean(stream.disposition?.hearing_impaired),
    }));
  const primary = videoStreams[0];
  const durationSec = Number(format.duration);
  return {
    durationMs: Number.isFinite(durationSec) ? Math.round(durationSec * 1000) : null,
    width: primary?.width ?? null,
    height: primary?.height ?? null,
    resolution: primary ? resolutionFromDimensions(primary.width, primary.height) : null,
    videoCodec: primary?.codec ?? null,
    audioCodec: audioTracks[0]?.codec ?? null,
    bitrateKbps: toKbps(format.bit_rate) ?? primary?.bitrateKbps ?? null,
    sizeBytes: Number(format.size) || sizeBytes,
    videoStreams,
    audioTracks,
    subtitleTracks,
  };
}

function toKbps(value?: string | number | null): number | null {
  if (value == null || value === '') {
    return null;
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return Math.max(1, Math.round(n / 1000));
}

function parseFps(value?: string): number | null {
  if (!value || value === '0/0') {
    return null;
  }
  const [a, b] = value.split('/').map(Number);
  if (!b) {
    return Number.isFinite(a) ? a : null;
  }
  const fps = a / b;
  return Number.isFinite(fps) ? Math.round(fps * 1000) / 1000 : null;
}

function languageOf(stream: FfprobeStream): string | null {
  const lang = stream.tags?.language ?? stream.tags?.LANGUAGE;
  if (!lang) {
    return null;
  }
  const lower = lang.toLowerCase().slice(0, 12);
  return asProfileLanguage(lower) ?? lower;
}
