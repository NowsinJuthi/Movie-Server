import {
  MediaAssetStatus,
  MediaKind,
  MovieAvailability,
  VIDEO_RESOLUTIONS,
  VideoResolution,
  resolutionAllowed,
  type MovieCastMember,
  type MovieRatings,
  type PublicEpisode,
  type PublicSeason,
  type PublicSeries,
  type PublicSeriesCollection,
  type SubscriptionEntitlement,
  type WatchProgress,
} from '@movie-server/shared';
import { SeriesDocument } from './schemas/series.schema';
import { SeriesCollectionDocument } from './schemas/series-collection.schema';
import { SeasonDocument } from './schemas/season.schema';
import { EpisodeDocument } from './schemas/episode.schema';
import { MediaAssetDocument } from '../movies/schemas/media-asset.schema';
import { toPlaybackMarkers } from '../stream/playback-markers.util';

export function seriesArtworkPath(key: string): string {
  return `/api/v1/series/artwork/${key}`;
}

function publicImageUrl(url?: string | null, key?: string | null): string | null {
  if (key) {
    return seriesArtworkPath(key);
  }
  return url ?? null;
}

function asRatings(ratings?: SeriesDocument['ratings'] | null): MovieRatings {
  return {
    imdb: ratings?.imdb ?? null,
    tmdb: ratings?.tmdb ?? null,
    critics: ratings?.critics ?? null,
    audience: ratings?.audience ?? null,
  };
}

function asCast(cast?: SeriesDocument['cast']): MovieCastMember[] {
  return (cast ?? []).map((member, index) => ({
    name: member.name,
    character: member.character ?? null,
    order: member.order ?? index,
    imageUrl: member.imageUrl ?? null,
  }));
}

function isoDate(value?: Date | null): string | null {
  if (!value) {
    return null;
  }
  return value.toISOString().slice(0, 10);
}

function readyResolutions(assets: Array<Pick<MediaAssetDocument, 'kind' | 'quality' | 'status'>>): VideoResolution[] {
  return assets
    .filter(
      (asset) =>
        asset.kind === MediaKind.Video &&
        asset.status === MediaAssetStatus.Ready &&
        asset.quality &&
        (VIDEO_RESOLUTIONS as readonly string[]).includes(asset.quality),
    )
    .map((asset) => asset.quality as VideoResolution);
}

function rankResolution(resolution: VideoResolution): number {
  return { '480p': 1, '720p': 2, '1080p': 3, '4k': 4 }[resolution];
}

export function toPublicSeries(
  series: SeriesDocument,
  counts?: { seasons?: number; episodes?: number },
): PublicSeries {
  return {
    id: String(series._id),
    slug: series.slug,
    title: series.title,
    originalTitle: series.originalTitle ?? null,
    description: series.description,
    posterUrl: publicImageUrl(series.posterUrl, series.posterKey),
    backdropUrl: publicImageUrl(series.backdropUrl, series.backdropKey),
    firstAirYear: series.firstAirYear,
    lastAirYear: series.lastAirYear ?? null,
    genres: series.genres ?? [],
    tags: series.tags ?? [],
    cast: asCast(series.cast),
    directors: series.directors ?? [],
    ratings: asRatings(series.ratings),
    maturityRating: series.maturityRating,
    certification: series.certification ?? null,
    collectionId: series.collectionId ? String(series.collectionId) : null,
    featured: series.featured,
    trending: series.trending,
    popular: series.popular,
    published: series.published,
    availability: series.availability,
    status: series.status,
    autoPlayNext: series.autoPlayNext,
    seasonCount: counts?.seasons ?? 0,
    episodeCount: counts?.episodes ?? 0,
  };
}

export function toPublicCollection(
  collection: SeriesCollectionDocument,
  seriesCount = 0,
): PublicSeriesCollection {
  return {
    id: String(collection._id),
    slug: collection.slug,
    name: collection.name,
    description: collection.description ?? '',
    posterUrl: collection.posterUrl ?? null,
    seriesCount,
  };
}

export function toPublicSeason(season: SeasonDocument, episodeCount = 0): PublicSeason {
  return {
    id: String(season._id),
    seriesId: String(season.seriesId),
    seasonNumber: season.seasonNumber,
    name: season.name,
    description: season.description ?? '',
    posterUrl: publicImageUrl(season.posterUrl, season.posterKey),
    airDate: isoDate(season.airDate),
    published: season.published,
    episodeCount,
  };
}

export function toPublicEpisode(
  episode: EpisodeDocument,
  options?: {
    entitlement?: SubscriptionEntitlement | null;
    assets?: Array<Pick<MediaAssetDocument, 'kind' | 'quality' | 'status'>>;
    admin?: boolean;
    progress?: WatchProgress | null;
  },
): PublicEpisode {
  const assets = options?.assets ?? [];
  const ready = readyResolutions(assets);
  const allowedReady = options?.admin
    ? ready
    : ready.filter((resolution) => resolutionAllowed(options?.entitlement?.maxVideoQuality, resolution));
  const maxResolution =
    allowedReady.sort((a, b) => rankResolution(b) - rankResolution(a))[0] ?? null;
  const progress = options?.progress ?? null;
  return {
    id: String(episode._id),
    seriesId: String(episode.seriesId),
    seasonId: String(episode.seasonId),
    seasonNumber: episode.seasonNumber,
    episodeNumber: episode.episodeNumber,
    title: episode.title,
    description: episode.description,
    thumbnailUrl: publicImageUrl(episode.thumbnailUrl, episode.thumbnailKey),
    runtimeMinutes: episode.runtimeMinutes,
    airDate: isoDate(episode.airDate),
    published: episode.published,
    availability: episode.availability,
    playable:
      episode.published &&
      episode.availability === MovieAvailability.Available &&
      allowedReady.length > 0,
    maxResolution,
    watched: Boolean(progress?.completed),
    progressSeconds: progress?.progressSeconds ?? 0,
    durationSeconds: progress?.durationSeconds ?? episode.runtimeMinutes * 60,
    markers: toPlaybackMarkers(episode.markers),
  };
}
