import { MaturityLevel } from './profile';
import { qualityAllowed, VideoQuality } from './subscription';
import type { PlaybackMarkers } from './playback';

export const VideoResolution = {
  P480: '480p',
  P720: '720p',
  P1080: '1080p',
  Uhd4k: '4k',
} as const;

export type VideoResolution = (typeof VideoResolution)[keyof typeof VideoResolution];
export const VIDEO_RESOLUTIONS = [
  VideoResolution.P480,
  VideoResolution.P720,
  VideoResolution.P1080,
  VideoResolution.Uhd4k,
] as const;

export const RESOLUTION_TO_QUALITY: Record<VideoResolution, VideoQuality> = {
  [VideoResolution.P480]: VideoQuality.Sd,
  [VideoResolution.P720]: VideoQuality.Hd,
  [VideoResolution.P1080]: VideoQuality.Hd,
  [VideoResolution.Uhd4k]: VideoQuality.Uhd,
};

export const MediaKind = {
  Video: 'video',
  Audio: 'audio',
  Subtitle: 'subtitle',
  Trailer: 'trailer',
} as const;

export type MediaKind = (typeof MediaKind)[keyof typeof MediaKind];
export const MEDIA_KINDS = [
  MediaKind.Video,
  MediaKind.Audio,
  MediaKind.Subtitle,
  MediaKind.Trailer,
] as const;

export const MediaAssetStatus = {
  Ready: 'ready',
  Processing: 'processing',
  Failed: 'failed',
  Missing: 'missing',
} as const;

export type MediaAssetStatus = (typeof MediaAssetStatus)[keyof typeof MediaAssetStatus];
export const MEDIA_ASSET_STATUSES = [
  MediaAssetStatus.Ready,
  MediaAssetStatus.Processing,
  MediaAssetStatus.Failed,
  MediaAssetStatus.Missing,
] as const;

export const MovieAvailability = {
  Available: 'available',
  Processing: 'processing',
  Unavailable: 'unavailable',
  ComingSoon: 'coming_soon',
} as const;

export type MovieAvailability = (typeof MovieAvailability)[keyof typeof MovieAvailability];
export const MOVIE_AVAILABILITIES = [
  MovieAvailability.Available,
  MovieAvailability.Processing,
  MovieAvailability.Unavailable,
  MovieAvailability.ComingSoon,
] as const;

export const MOVIE_GENRES = [
  'action',
  'adventure',
  'animation',
  'comedy',
  'crime',
  'documentary',
  'drama',
  'family',
  'fantasy',
  'history',
  'horror',
  'music',
  'mystery',
  'romance',
  'scifi',
  'thriller',
  'war',
  'western',
] as const;

export type MovieGenre = (typeof MOVIE_GENRES)[number];

export const MOVIE_CERTIFICATIONS = [
  'G',
  'PG',
  'PG-13',
  'R',
  'NC-17',
  'TV-Y',
  'TV-G',
  'TV-PG',
  'TV-14',
  'TV-MA',
  'NR',
] as const;

export type MovieCertification = (typeof MOVIE_CERTIFICATIONS)[number];

export const MovieSort = {
  Title: 'title',
  Year: 'year',
  Runtime: 'runtime',
  Newest: 'newest',
  Featured: 'featured',
} as const;

export type MovieSort = (typeof MovieSort)[keyof typeof MovieSort];
export const MOVIE_SORTS = [
  MovieSort.Title,
  MovieSort.Year,
  MovieSort.Runtime,
  MovieSort.Newest,
  MovieSort.Featured,
] as const;

export type MovieCastMember = {
  name: string;
  character: string | null;
  order: number;
  imageUrl: string | null;
};

export type MovieRatings = {
  imdb: number | null;
  tmdb: number | null;
  critics: number | null;
  audience: number | null;
};

export type PublicMovieCollection = {
  id: string;
  slug: string;
  name: string;
  description: string;
  posterUrl: string | null;
  movieCount: number;
};

export const SubtitleFormat = {
  Srt: 'srt',
  Vtt: 'vtt',
  Ass: 'ass',
  Sub: 'sub',
  Unknown: 'unknown',
} as const;

export type SubtitleFormat = (typeof SubtitleFormat)[keyof typeof SubtitleFormat];
export const SUBTITLE_FORMATS = [
  SubtitleFormat.Srt,
  SubtitleFormat.Vtt,
  SubtitleFormat.Ass,
  SubtitleFormat.Sub,
  SubtitleFormat.Unknown,
] as const;
export const PLAYABLE_SUBTITLE_FORMATS = [SubtitleFormat.Srt, SubtitleFormat.Vtt] as const;

export type PublicMediaAsset = {
  id: string;
  kind: MediaKind;
  quality: VideoResolution | null;
  language: string | null;
  label: string | null;
  codec: string | null;
  channels: number | null;
  format: SubtitleFormat | null;
  forced: boolean;
  hearingImpaired: boolean;
  bitrateKbps: number | null;
  status: MediaAssetStatus;
  isDefault: boolean;
  allowed: boolean;
};

export type PublicMovie = {
  id: string;
  slug: string;
  title: string;
  originalTitle: string | null;
  description: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  trailerUrl: string | null;
  releaseYear: number;
  runtimeMinutes: number;
  genres: string[];
  tags: string[];
  cast: MovieCastMember[];
  directors: string[];
  writers: string[];
  ratings: MovieRatings;
  maturityRating: MaturityLevel;
  certification: MovieCertification | null;
  collectionId: string | null;
  featured: boolean;
  trending: boolean;
  popular: boolean;
  published: boolean;
  availability: MovieAvailability;
  playable: boolean;
  maxResolution: VideoResolution | null;
  markers: PlaybackMarkers;
  progressSeconds?: number;
  durationSeconds?: number;
  watched?: boolean;
};

export type MovieListResponse = {
  items: PublicMovie[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type MovieDetailResponse = {
  movie: PublicMovie;
  collection: PublicMovieCollection | null;
  versions: PublicMediaAsset[];
  audioTracks: PublicMediaAsset[];
  subtitleTracks: PublicMediaAsset[];
};

export type MovieCatalogShelf = {
  id: string;
  title: string;
  items: PublicMovie[];
};

export type MovieCatalogResponse = {
  featured: PublicMovie[];
  trending: PublicMovie[];
  popular: PublicMovie[];
  newest: PublicMovie[];
  shelves: MovieCatalogShelf[];
  collections: Array<{ collection: PublicMovieCollection; movies: PublicMovie[] }>;
};

export const BulkMovieAction = {
  Publish: 'publish',
  Unpublish: 'unpublish',
  Feature: 'feature',
  Unfeature: 'unfeature',
  Trending: 'trending',
  Untrending: 'untrending',
  Popular: 'popular',
  Unpopular: 'unpopular',
  Delete: 'delete',
} as const;

export type BulkMovieAction = (typeof BulkMovieAction)[keyof typeof BulkMovieAction];
export const BULK_MOVIE_ACTIONS = [
  BulkMovieAction.Publish,
  BulkMovieAction.Unpublish,
  BulkMovieAction.Feature,
  BulkMovieAction.Unfeature,
  BulkMovieAction.Trending,
  BulkMovieAction.Untrending,
  BulkMovieAction.Popular,
  BulkMovieAction.Unpopular,
  BulkMovieAction.Delete,
] as const;

export type AdminMediaAsset = {
  id: string;
  movieId: string | null;
  episodeId: string | null;
  kind: MediaKind;
  storageKey: string;
  quality: VideoResolution | null;
  language: string | null;
  label: string | null;
  codec: string | null;
  channels: number | null;
  bitrateKbps: number | null;
  format: SubtitleFormat | null;
  forced: boolean;
  hearingImpaired: boolean;
  isDefault: boolean;
  sortOrder: number;
  status: MediaAssetStatus;
};

export type AdminMovieDetailResponse = MovieDetailResponse & {
  assets: AdminMediaAsset[];
};

export const MATURITY_RANK: Record<MaturityLevel, number> = {
  [MaturityLevel.Kids]: 1,
  [MaturityLevel.Teens]: 2,
  [MaturityLevel.Mature]: 3,
};

export function resolutionAllowed(
  maxQuality: VideoQuality | null | undefined,
  resolution: VideoResolution | null | undefined,
): boolean {
  if (!maxQuality || !resolution) {
    return false;
  }
  return qualityAllowed(maxQuality, RESOLUTION_TO_QUALITY[resolution]);
}

export function profileCanViewMaturity(
  profileMaturity: MaturityLevel,
  movieMaturity: MaturityLevel,
  isKids = false,
): boolean {
  const cap = isKids ? MaturityLevel.Kids : profileMaturity;
  return MATURITY_RANK[movieMaturity] <= MATURITY_RANK[cap];
}
