import {
  MediaAssetStatus,
  MediaKind,
  MovieAvailability,
  RESOLUTION_TO_QUALITY,
  VIDEO_RESOLUTIONS,
  VideoResolution,
  qualityAllowed,
  resolutionAllowed,
  type AdminMediaAsset,
  type MovieCastMember,
  type MovieRatings,
  type PublicMediaAsset,
  type PublicMovie,
  type PublicMovieCollection,
  type SubscriptionEntitlement,
} from '@movie-server/shared';
import { MovieDocument } from './schemas/movie.schema';
import { MovieCollectionDocument } from './schemas/movie-collection.schema';
import { MediaAssetDocument } from './schemas/media-asset.schema';
import { resolvePublicArtworkUrl } from './movie.util';
import { toPlaybackMarkers } from '../stream/playback-markers.util';

function asRatings(ratings?: MovieDocument['ratings'] | null): MovieRatings {
  return {
    imdb: ratings?.imdb ?? null,
    tmdb: ratings?.tmdb ?? null,
    critics: ratings?.critics ?? null,
    audience: ratings?.audience ?? null,
  };
}

function asCast(cast?: MovieDocument['cast']): MovieCastMember[] {
  return (cast ?? []).map((member, index) => ({
    name: member.name,
    character: member.character ?? null,
    order: member.order ?? index,
    imageUrl: member.imageUrl ?? null,
  }));
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

export function toPublicMovie(
  movie: MovieDocument,
  options?: {
    entitlement?: SubscriptionEntitlement | null;
    assets?: Array<Pick<MediaAssetDocument, 'kind' | 'quality' | 'status'>>;
    admin?: boolean;
    progress?: { progressSeconds: number; durationSeconds: number; completed: boolean } | null;
  },
): PublicMovie {
  const assets = options?.assets ?? [];
  const ready = readyResolutions(assets);
  const allowedReady = options?.admin
    ? ready
    : ready.filter((resolution) =>
        resolutionAllowed(options?.entitlement?.maxVideoQuality, resolution),
      );
  const maxResolution =
    allowedReady.sort((a, b) => rankResolution(b) - rankResolution(a))[0] ??
    (options?.admin ? ready.sort((a, b) => rankResolution(b) - rankResolution(a))[0] : null) ??
    null;
  const playable =
    movie.published &&
    movie.availability === MovieAvailability.Available &&
    allowedReady.length > 0;

  return {
    id: String(movie._id),
    slug: movie.slug,
    title: movie.title,
    originalTitle: movie.originalTitle ?? null,
    description: movie.description,
    posterUrl: resolvePublicArtworkUrl(movie.posterUrl, movie.posterKey),
    backdropUrl: resolvePublicArtworkUrl(movie.backdropUrl, movie.backdropKey),
    trailerUrl: movie.trailerUrl ?? null,
    releaseYear: movie.releaseYear,
    year: movie.releaseYear,
    runtimeMinutes: movie.runtimeMinutes,
    genres: movie.genres ?? [],
    tags: movie.tags ?? [],
    cast: asCast(movie.cast),
    directors: movie.directors ?? [],
    writers: movie.writers ?? [],
    ratings: asRatings(movie.ratings),
    maturityRating: movie.maturityRating,
    certification: movie.certification ?? null,
    collectionId: movie.collectionId ? String(movie.collectionId) : null,
    featured: movie.featured,
    trending: movie.trending,
    popular: movie.popular,
    published: movie.published,
    availability: movie.availability,
    playable,
    maxResolution,
    markers: toPlaybackMarkers(movie.markers),
    progressSeconds: options?.progress?.progressSeconds,
    durationSeconds: options?.progress?.durationSeconds,
    watched: options?.progress?.completed,
  };
}

export function toPublicCollection(
  collection: MovieCollectionDocument,
  movieCount = 0,
): PublicMovieCollection {
  return {
    id: String(collection._id),
    slug: collection.slug,
    name: collection.name,
    description: collection.description ?? '',
    posterUrl: collection.posterUrl ?? null,
    movieCount,
  };
}

export function toPublicMediaAsset(
  asset: MediaAssetDocument,
  entitlement?: SubscriptionEntitlement | null,
  admin = false,
): PublicMediaAsset {
  const allowed =
    admin ||
    asset.kind !== MediaKind.Video ||
    (Boolean(asset.quality) &&
      Boolean(entitlement?.maxVideoQuality) &&
      qualityAllowed(
        entitlement!.maxVideoQuality!,
        RESOLUTION_TO_QUALITY[asset.quality as VideoResolution],
      ));

  return {
    id: String(asset._id),
    kind: asset.kind,
    quality: asset.quality ?? null,
    language: asset.language ?? null,
    label: asset.label ?? null,
    codec: asset.codec ?? null,
    channels: asset.channels ?? null,
    format: asset.format ?? null,
    forced: Boolean(asset.forced),
    hearingImpaired: Boolean(asset.hearingImpaired),
    bitrateKbps: asset.bitrateKbps ?? null,
    status: asset.status,
    isDefault: asset.isDefault,
    allowed,
  };
}

export function toAdminMediaAsset(asset: MediaAssetDocument): AdminMediaAsset {
  return {
    id: String(asset._id),
    movieId: asset.movieId ? String(asset.movieId) : null,
    episodeId: asset.episodeId ? String(asset.episodeId) : null,
    kind: asset.kind,
    storageKey: asset.storageKey,
    quality: asset.quality ?? null,
    language: asset.language ?? null,
    label: asset.label ?? null,
    codec: asset.codec ?? null,
    channels: asset.channels ?? null,
    bitrateKbps: asset.bitrateKbps ?? null,
    format: asset.format ?? null,
    forced: Boolean(asset.forced),
    hearingImpaired: Boolean(asset.hearingImpaired),
    isDefault: asset.isDefault,
    sortOrder: asset.sortOrder,
    status: asset.status,
  };
}
