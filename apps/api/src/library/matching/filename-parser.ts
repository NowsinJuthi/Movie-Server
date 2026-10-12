import { asProfileLanguage } from '@movie-server/shared';

export type ParsedMovieHint = {
  kind: 'movie';
  title: string;
  year?: number;
  resolutionHint?: string;
};

export type ParsedEpisodeHint = {
  kind: 'episode';
  seriesTitle: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle?: string;
  year?: number;
  resolutionHint?: string;
};

export type ParsedUnknownHint = {
  kind: 'unknown';
  title: string;
  resolutionHint?: string;
};

export type ParsedMediaHint = ParsedMovieHint | ParsedEpisodeHint | ParsedUnknownHint;

const RESOLUTION_TOKEN = /\b(480p|720p|1080p|2160p|4k|uhd)\b/i;
const JUNK =
  /\b(1080p|720p|480p|2160p|4k|uhd|bluray|blu-ray|webrip|web-dl|webdl|hdrip|dvdrip|x264|x265|h264|h265|hevc|avc|aac|dts|hdr|hdr10|dv|proper|repack|extended|remux|multi|subs|internal)\b/gi;

export const VIDEO_EXTENSIONS = new Set([
  '.mkv',
  '.mp4',
  '.m4v',
  '.avi',
  '.mov',
  '.wmv',
  '.ts',
  '.m2ts',
  '.webm',
  '.mpg',
  '.mpeg',
]);

export const AUDIO_EXTENSIONS = new Set([
  '.m4a',
  '.aac',
  '.mp3',
  '.ac3',
  '.eac3',
  '.ogg',
  '.opus',
  '.wav',
  '.flac',
]);

export const SUBTITLE_EXTENSIONS = new Set(['.srt', '.ass', '.ssa', '.vtt', '.sub']);

export function toPosixRelative(relativePath: string): string {
  return relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
}

export function fileExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx >= 0 ? fileName.slice(idx).toLowerCase() : '';
}

export function isVideoFile(fileName: string): boolean {
  return VIDEO_EXTENSIONS.has(fileExtension(fileName));
}

export function isSubtitleFile(fileName: string): boolean {
  return SUBTITLE_EXTENSIONS.has(fileExtension(fileName));
}

export function isAudioFile(fileName: string): boolean {
  return AUDIO_EXTENSIONS.has(fileExtension(fileName));
}

const LANGUAGE_TOKEN =
  /(^|[\s._-])(en|eng|english|bn|ben|bangla|bengali|hi|hin|hindi|es|spa|spanish|fr|fre|fra|french|de|ger|deu|german|it|ita|italian|pt|por|portuguese|ja|jpn|japanese|ko|kor|korean|zh|chi|zho|chinese|ar|ara|arabic)(?=$|[\s._-])/i;

export function detectLanguageHint(value: string): string | undefined {
  const matches = [...value.toLowerCase().matchAll(new RegExp(LANGUAGE_TOKEN.source, 'gi'))];
  const last = matches[matches.length - 1];
  if (!last) {
    return undefined;
  }
  return asProfileLanguage(last[2]) ?? undefined;
}

export function detectResolutionHint(value: string): string | undefined {
  const match = value.match(RESOLUTION_TOKEN);
  if (!match) {
    return undefined;
  }
  const token = match[1].toLowerCase();
  if (token === '2160p' || token === '4k' || token === 'uhd') {
    return '4k';
  }
  return token;
}

export function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '');
}

export function cleanTitle(value: string): string {
  return value
    .replace(JUNK, ' ')
    .replace(/[._]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[-–—\s]+|[-–—\s]+$/g, '')
    .trim();
}

function basename(posix: string): string {
  const parts = posix.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? posix;
}

function parentSegments(posix: string): string[] {
  const parts = posix.split('/').filter(Boolean);
  return parts.slice(0, -1);
}

/** Season folder names: `Season 01`, `Season 1`, `S01`, `S1`. */
export function parseSeasonFolderName(folder: string): number | null {
  const season = folder.match(/^season[\s._-]*(\d{1,2})$/i);
  if (season) {
    return Number(season[1]);
  }
  const short = folder.match(/^s(\d{1,2})$/i);
  if (short) {
    return Number(short[1]);
  }
  return null;
}

function findSeasonFolderIndex(folders: string[]): { index: number; seasonNumber: number } | null {
  for (let index = 0; index < folders.length; index += 1) {
    const seasonNumber = parseSeasonFolderName(folders[index]);
    if (seasonNumber != null && seasonNumber >= 0) {
      return { index, seasonNumber };
    }
  }
  return null;
}

export function looksLikeSeasonFolderLabel(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  return parseSeasonFolderName(trimmed) != null || /^season[\s._-]*\d/i.test(trimmed);
}

/** Derive a catalog series title from a TV library display name (e.g. "Kaiju No. 8 Anime Series"). */
export function seriesTitleFromLibraryName(libraryName: string): string {
  const stripped = libraryName
    .replace(/\s+(anime\s+series|tv\s+series|series)\s*$/i, '')
    .trim();
  return cleanTitle(stripped);
}

export function resolveEpisodeSeriesTitle(
  parsed: ParsedEpisodeHint,
  libraryName?: string | null,
): string {
  let title = parsed.seriesTitle.trim();
  if (!title || looksLikeSeasonFolderLabel(title)) {
    const fromLibrary = libraryName ? seriesTitleFromLibraryName(libraryName) : '';
    if (fromLibrary) {
      title = fromLibrary;
    }
  }
  return title.trim();
}

function stripReleaseGroupPrefix(stem: string): string {
  return stem.replace(/^(\[[^\]]+\]\s*)+/, '').trim();
}

function seriesTitleFromFolders(folders: string[], seasonFolderIndex: number | null): string {
  if (seasonFolderIndex != null && seasonFolderIndex > 0) {
    return cleanTitle(folders[0]);
  }
  if (folders.length > 0) {
    const first = cleanTitle(folders[0]);
    if (looksLikeSeasonFolderLabel(first)) {
      return '';
    }
    return first;
  }
  return '';
}

export function parseMediaFilename(relativePath: string): ParsedMediaHint {
  const posix = toPosixRelative(relativePath);
  const fileName = basename(posix);
  const stem = stripReleaseGroupPrefix(stripExtension(fileName));
  const folders = parentSegments(posix);
  const resolutionHint = detectResolutionHint(`${stem} ${folders.join(' ')}`);

  const seasonFolderInfo = findSeasonFolderIndex(folders);

  const se = stem.match(/^(.*?)[\s._-]*[Ss](\d{1,2})[Ee](\d{1,3})(?:[\s._-]+(.+))?$/);
  if (se) {
    let seriesTitle = cleanTitle(se[1] ?? '');
    if (!seriesTitle && folders.length) {
      seriesTitle = seriesTitleFromFolders(folders, seasonFolderInfo?.index ?? null);
    }
    return {
      kind: 'episode',
      seriesTitle: seriesTitle || cleanTitle(folders[0] ?? stem),
      seasonNumber: Number(se[2]),
      episodeNumber: Number(se[3]),
      episodeTitle: se[4] ? cleanTitle(se[4]) : undefined,
      resolutionHint,
    };
  }

  const xe = stem.match(/^(.*?)[\s._-]*(\d{1,2})x(\d{1,3})(?:[\s._-]+(.+))?$/i);
  if (xe && Number(xe[2]) <= 40) {
    let seriesTitle = cleanTitle(xe[1] ?? '');
    if (!seriesTitle && folders.length) {
      seriesTitle = cleanTitle(folders[0]);
    }
    return {
      kind: 'episode',
      seriesTitle: seriesTitle || cleanTitle(folders[0] ?? stem),
      seasonNumber: Number(xe[2]),
      episodeNumber: Number(xe[3]),
      episodeTitle: xe[4] ? cleanTitle(xe[4]) : undefined,
      resolutionHint,
    };
  }

  const epOnly = stem.match(/^(\d{1,3})[\s._-]+(.+)$/);
  if (seasonFolderInfo && epOnly) {
    return {
      kind: 'episode',
      seriesTitle: seriesTitleFromFolders(folders, seasonFolderInfo.index),
      seasonNumber: seasonFolderInfo.seasonNumber,
      episodeNumber: Number(epOnly[1]),
      episodeTitle: cleanTitle(epOnly[2]),
      resolutionHint,
    };
  }

  if (seasonFolderInfo) {
    const seriesTitle = seriesTitleFromFolders(folders, seasonFolderInfo.index);
    if (/^\d{1,3}$/.test(stem)) {
      return {
        kind: 'episode',
        seriesTitle,
        seasonNumber: seasonFolderInfo.seasonNumber,
        episodeNumber: Number(stem),
        resolutionHint,
      };
    }
    const trailingEpisode = stem.match(/^(.+?)[\s._-]+(\d{1,3})$/);
    if (trailingEpisode && Number(trailingEpisode[2]) >= 1 && Number(trailingEpisode[2]) <= 500) {
      return {
        kind: 'episode',
        seriesTitle: seriesTitle || cleanTitle(trailingEpisode[1]),
        seasonNumber: seasonFolderInfo.seasonNumber,
        episodeNumber: Number(trailingEpisode[2]),
        resolutionHint,
      };
    }
  }

  {
    const dashEpisode = stem.match(/^(.+?)\s[-–—]\s*(\d{1,3})(?:\b|[\s([]|$)/);
    if (dashEpisode && Number(dashEpisode[2]) >= 1 && Number(dashEpisode[2]) <= 500) {
      const seasonNumber = seasonFolderInfo?.seasonNumber ?? 1;
      const seriesTitle =
        folders.length > 0
          ? seriesTitleFromFolders(folders, seasonFolderInfo?.index ?? null)
          : '';
      return {
        kind: 'episode',
        seriesTitle: seriesTitle || cleanTitle(dashEpisode[1]),
        seasonNumber,
        episodeNumber: Number(dashEpisode[2]),
        resolutionHint,
      };
    }
  }

  const yearParen = stem.match(/^(.*?)[\s._-]*\((\d{4})\)(?:[\s._-].*)?$/);
  if (yearParen && isYear(yearParen[2])) {
    return {
      kind: 'movie',
      title: cleanTitle(yearParen[1]),
      year: Number(yearParen[2]),
      resolutionHint,
    };
  }

  const yearDot = stem.match(/^(.*?)[\s._-]+(\d{4})(?:[\s._-].*)?$/);
  if (yearDot && isYear(yearDot[2])) {
    return {
      kind: 'movie',
      title: cleanTitle(yearDot[1]),
      year: Number(yearDot[2]),
      resolutionHint,
    };
  }

  if (folders.length) {
    const folderYear = folders[0].match(/^(.*)[\s._-]*\((\d{4})\)\s*$/);
    if (folderYear && isYear(folderYear[2])) {
      return {
        kind: 'movie',
        title: cleanTitle(folderYear[1]),
        year: Number(folderYear[2]),
        resolutionHint,
      };
    }
  }

  return {
    kind: 'unknown',
    title: cleanTitle(stem),
    resolutionHint,
  };
}

function isYear(value: string): boolean {
  const year = Number(value);
  return year >= 1888 && year <= 2100;
}
