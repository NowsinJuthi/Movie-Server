import {
  MediaAssetStatus,
  MediaKind,
  MovieAvailability,
  MovieCastMember,
  MovieCertification,
  MovieRatings,
  PublicMediaAsset,
  VideoResolution,
} from './movie';
import { MaturityLevel } from './profile';
import { WatchProgress } from './profile';
import type { PlaybackMarkers, PlaybackSessionInfo } from './playback';
import type { VideoQuality } from './subscription';

export const SeriesStatus = {
  Returning: 'returning',
  Ended: 'ended',
  Canceled: 'canceled',
  Upcoming: 'upcoming',
} as const;

export type SeriesStatus = (typeof SeriesStatus)[keyof typeof SeriesStatus];
export const SERIES_STATUSES = [
  SeriesStatus.Returning,
  SeriesStatus.Ended,
  SeriesStatus.Canceled,
  SeriesStatus.Upcoming,
] as const;

export const SeriesSort = {
  Title: 'title',
  Year: 'year',
  Newest: 'newest',
  Featured: 'featured',
} as const;

export type SeriesSort = (typeof SeriesSort)[keyof typeof SeriesSort];
export const SERIES_SORTS = [
  SeriesSort.Title,
  SeriesSort.Year,
  SeriesSort.Newest,
  SeriesSort.Featured,
] as const;

export type PublicSeriesCollection = {
  id: string;
  slug: string;
  name: string;
  description: string;
  posterUrl: string | null;
  seriesCount: number;
};

export type PublicSeries = {
  id: string;
  slug: string;
  title: string;
  originalTitle: string | null;
  description: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  firstAirYear: number;
  lastAirYear: number | null;
  genres: string[];
  tags: string[];
  cast: MovieCastMember[];
  directors: string[];
  ratings: MovieRatings;
  maturityRating: MaturityLevel;
  certification: MovieCertification | null;
  collectionId: string | null;
  featured: boolean;
  trending: boolean;
  popular: boolean;
  published: boolean;
  availability: MovieAvailability;
  status: SeriesStatus;
  autoPlayNext: boolean;
  seasonCount: number;
  episodeCount: number;
};

export type PublicSeason = {
  id: string;
  seriesId: string;
  seasonNumber: number;
  name: string;
  description: string;
  posterUrl: string | null;
  airDate: string | null;
  published: boolean;
  episodeCount: number;
};

export type PublicEpisode = {
  id: string;
  seriesId: string;
  seasonId: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  runtimeMinutes: number;
  airDate: string | null;
  published: boolean;
  availability: MovieAvailability;
  playable: boolean;
  maxResolution: VideoResolution | null;
  watched: boolean;
  progressSeconds: number;
  durationSeconds: number;
  markers: PlaybackMarkers;
};

export type EpisodeNeighbor = {
  id: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
};

export type SeriesListResponse = {
  items: PublicSeries[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type SeriesDetailResponse = {
  series: PublicSeries;
  collection: PublicSeriesCollection | null;
  seasons: PublicSeason[];
  continueEpisode: PublicEpisode | null;
};

export type SeasonDetailResponse = {
  series: PublicSeries;
  season: PublicSeason;
  episodes: PublicEpisode[];
};

export type EpisodeDetailResponse = {
  series: PublicSeries;
  season: PublicSeason;
  episode: PublicEpisode;
  versions: PublicMediaAsset[];
  audioTracks: PublicMediaAsset[];
  subtitleTracks: PublicMediaAsset[];
  previous: EpisodeNeighbor | null;
  next: EpisodeNeighbor | null;
  autoPlayNext: boolean;
};

export type EpisodePlaybackResponse = {
  allowed: boolean;
  quality: VideoQuality;
  episode: PublicEpisode;
  previous: EpisodeNeighbor | null;
  next: EpisodeNeighbor | null;
  autoPlayNext: boolean;
  session: PlaybackSessionInfo | null;
  markers: PlaybackMarkers;
  resumeSeconds: number;
};

export type EpisodeProgressResponse = {
  episode: PublicEpisode;
  progress: WatchProgress;
  next: EpisodeNeighbor | null;
  autoPlayNext: boolean;
};

export type SeriesContinueItem = {
  series: PublicSeries;
  episode: PublicEpisode;
  progress: WatchProgress;
  next: EpisodeNeighbor | null;
};

export type SeriesCatalogShelf = {
  id: string;
  title: string;
  items: PublicSeries[];
};

export type SeriesCatalogResponse = {
  featured: PublicSeries[];
  trending: PublicSeries[];
  popular: PublicSeries[];
  newest: PublicSeries[];
  shelves: SeriesCatalogShelf[];
  collections: Array<{ collection: PublicSeriesCollection; series: PublicSeries[] }>;
};

export const BulkSeriesAction = {
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

export type BulkSeriesAction = (typeof BulkSeriesAction)[keyof typeof BulkSeriesAction];
export const BULK_SERIES_ACTIONS = [
  BulkSeriesAction.Publish,
  BulkSeriesAction.Unpublish,
  BulkSeriesAction.Feature,
  BulkSeriesAction.Unfeature,
  BulkSeriesAction.Trending,
  BulkSeriesAction.Untrending,
  BulkSeriesAction.Popular,
  BulkSeriesAction.Unpopular,
  BulkSeriesAction.Delete,
] as const;

export const BulkEpisodeAction = {
  Publish: 'publish',
  Unpublish: 'unpublish',
  Delete: 'delete',
} as const;

export type BulkEpisodeAction = (typeof BulkEpisodeAction)[keyof typeof BulkEpisodeAction];
export const BULK_EPISODE_ACTIONS = [
  BulkEpisodeAction.Publish,
  BulkEpisodeAction.Unpublish,
  BulkEpisodeAction.Delete,
] as const;
