import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ErrorCode,
  LibraryFileKind,
  MediaAssetStatus,
  MediaKind,
  PlaybackQualityOption,
  PlaybackSessionInfo,
  RESOLUTION_TO_QUALITY,
  VIDEO_RESOLUTIONS,
  VideoQuality,
  VideoResolution,
  asProfileLanguage,
  qualityAllowed,
} from '@movie-server/shared';
import { RequestUser } from '../auth/auth.types';
import { SubscriptionAccessService } from '../subscriptions/subscription-access.service';
import { ProfilesService } from '../profiles/profiles.service';
import { MediaAsset, MediaAssetDocument } from '../movies/schemas/media-asset.schema';
import { Movie, MovieDocument } from '../movies/schemas/movie.schema';
import { LibraryItem, LibraryItemDocument } from '../library/schemas/library-item.schema';
import { MediaLibrary, MediaLibraryDocument } from '../library/schemas/media-library.schema';
import { Series, SeriesDocument } from '../series/schemas/series.schema';
import { Episode, EpisodeDocument } from '../series/schemas/episode.schema';
import { StorageFactory } from '../library/storage/storage.factory';
import { PlaybackSessionStore } from './playback-session.store';
import { StoredPlaybackSession, StoredPlaybackTrack, StoredPlaybackVariant } from './playback-session.types';
import { variantBandwidth } from './hls-playlist';
import { pickStoredTrack, preferredSubtitleCode, toPlaybackTrack } from './playback-tracks.util';
import { isPlayableSubtitleFormat, subtitleFormatFromName, toSafeWebVtt } from './subtitle-text';
import { isAudioFile, isSubtitleFile } from '../library/matching/filename-parser';
import { resolveSafePath } from '../library/storage/path-safety';
import path from 'path';
import { Readable } from 'stream';
import { FfmpegRemuxService } from './ffmpeg-remux.service';
import { mp4FastStart } from '../library/probe/mp4-container-probe';

const API = '/api/v1';
const MAX_SUBTITLE_BYTES = 2 * 1024 * 1024;

@Injectable()
export class StreamService {
  constructor(
    private readonly sessions: PlaybackSessionStore,
    private readonly access: SubscriptionAccessService,
    private readonly storageFactory: StorageFactory,
    private readonly profiles: ProfilesService,
    private readonly remux: FfmpegRemuxService,
    @InjectModel(MediaAsset.name) private readonly assets: Model<MediaAssetDocument>,
    @InjectModel(Movie.name) private readonly movies: Model<MovieDocument>,
    @InjectModel(Series.name) private readonly series: Model<SeriesDocument>,
    @InjectModel(Episode.name) private readonly episodes: Model<EpisodeDocument>,
    @InjectModel(LibraryItem.name) private readonly items: Model<LibraryItemDocument>,
    @InjectModel(MediaLibrary.name) private readonly libraries: Model<MediaLibraryDocument>,
  ) {}

  async open(input: {
    user: RequestUser;
    quality: VideoQuality;
    deviceId?: string;
    deviceLabel?: string;
    movieId?: string;
    episodeId?: string;
    seriesId?: string;
    durationSeconds: number;
  }): Promise<PlaybackSessionInfo | null> {
    await this.profiles.ensureSessionProfile(input.user);
    const profileId = input.user.activeProfileId;
    if (!profileId) {
      return null;
    }
    const mediaId = input.episodeId ?? input.movieId;
    if (!mediaId) {
      return null;
    }
    const deviceId = (input.deviceId?.trim() || 'default').slice(0, 80);
    const deviceLabel = (input.deviceLabel?.trim() || 'CineVault').slice(0, 80);
    const entitlement = await this.access.assertQuality(input.user.id, input.quality);
    const maxQuality = entitlement.maxVideoQuality;
    if (!maxQuality) {
      return null;
    }

    const videos = await this.assets
      .find({
        kind: MediaKind.Video,
        status: MediaAssetStatus.Ready,
        ...(input.episodeId ? { episodeId: new Types.ObjectId(input.episodeId) } : {}),
        ...(input.movieId ? { movieId: new Types.ObjectId(input.movieId) } : {}),
      })
      .select('+storagePath')
      .sort({ sortOrder: 1, createdAt: 1 });

    const allowed = videos.filter(
      (asset) =>
        asset.quality &&
        qualityAllowed(maxQuality, RESOLUTION_TO_QUALITY[asset.quality as VideoResolution]),
    );
    if (allowed.length === 0) {
      return null;
    }

    const playable = await this.preferBrowserPlayable(allowed);

    return this.sessions.runExclusive(input.user.id, async () => {
      await this.sessions.registerDevice(
        input.user.id,
        deviceId,
        deviceLabel,
        entitlement.maxDevices,
      );

      const selected =
        playable.find((asset) => RESOLUTION_TO_QUALITY[asset.quality as VideoResolution] === input.quality) ??
        playable[playable.length - 1];

      const existing = await this.sessions.assertStreamSlot(input.user.id, entitlement.maxStreams, {
        deviceId,
        mediaId,
      });
      const variants: StoredPlaybackVariant[] = playable
        .filter((asset) => asset.quality && (VIDEO_RESOLUTIONS as readonly string[]).includes(asset.quality))
        .map((asset) => ({
          assetId: String(asset._id),
          resolution: asset.quality as VideoResolution,
          quality: RESOLUTION_TO_QUALITY[asset.quality as VideoResolution],
          bandwidth: variantBandwidth(asset.quality as VideoResolution, asset.bitrateKbps),
        }));

      const [{ audioTracks, subtitleTracks }, profile] = await Promise.all([
        this.loadTracks(input.movieId, input.episodeId),
        this.profiles.get(input.user.id, profileId),
      ]);
      const selectedAudio = pickStoredTrack(audioTracks, profile.audioLanguage);
      const selectedSubtitle = pickStoredTrack(
        subtitleTracks,
        preferredSubtitleCode(profile.subtitleLanguage),
        true,
      );

      const payload = {
        userId: input.user.id,
        profileId,
        deviceId,
        deviceLabel,
        mediaType: (input.episodeId ? 'episode' : 'movie') as 'episode' | 'movie',
        mediaId,
        movieId: input.movieId,
        episodeId: input.episodeId,
        seriesId: input.seriesId,
        assetId: String(selected._id),
        quality: input.quality,
        resolution: (selected.quality as VideoResolution) ?? null,
        variants,
        audioTracks,
        subtitleTracks,
        selectedAudioId: selectedAudio?.assetId ?? null,
        selectedSubtitleId: selectedSubtitle?.assetId ?? null,
        durationSeconds: input.durationSeconds,
      };

      const session = existing
        ? await this.replace(existing, payload)
        : await this.sessions.create(payload);
      return this.toPublic(session, maxQuality);
    });
  }

  async revokeMedia(mediaIds: string[]): Promise<void> {
    await this.sessions.stopForMediaIds(mediaIds);
  }

  async load(sessionId: string, userId: string): Promise<StoredPlaybackSession> {
    const session = await this.sessions.requireOwned(sessionId, userId);
    await this.ensurePlayable(session, userId);
    return session;
  }

  async heartbeat(sessionId: string, userId: string): Promise<PlaybackSessionInfo> {
    const current = await this.sessions.requireOwned(sessionId, userId);
    await this.ensurePlayable(current, userId);
    const session = await this.sessions.heartbeat(sessionId, userId);
    const entitlement = await this.access.assertEntitled(userId);
    return this.toPublic(session, entitlement.maxVideoQuality);
  }

  async stop(sessionId: string, userId: string): Promise<void> {
    await this.sessions.stop(sessionId, userId);
  }

  async stopAllForUser(userId: string): Promise<void> {
    await this.sessions.stopAllForUser(userId);
  }

  async listActive(userId: string) {
    return this.sessions.listActive(userId);
  }

  async selectTracks(
    sessionId: string,
    userId: string,
    input: { audioId?: string; subtitleId?: string | null },
  ): Promise<PlaybackSessionInfo> {
    if (input.audioId === undefined && input.subtitleId === undefined) {
      throw new BadRequestException({
        error: ErrorCode.ValidationFailed,
        message: 'Select an audio or subtitle track.',
      });
    }
    const session = await this.sessions.requireOwned(sessionId, userId);
    await this.ensurePlayable(session, userId);
    if (input.audioId !== undefined) {
      const audio = session.audioTracks.find((track) => track.assetId === input.audioId);
      if (!audio) {
        throw new NotFoundException({
          error: ErrorCode.TrackNotFound,
          message: 'That audio track is not available for this title.',
        });
      }
      session.selectedAudioId = audio.assetId;
    }
    if (input.subtitleId !== undefined) {
      if (input.subtitleId === null) {
        session.selectedSubtitleId = null;
      } else {
        const subtitle = session.subtitleTracks.find((track) => track.assetId === input.subtitleId);
        if (!subtitle) {
          throw new NotFoundException({
            error: ErrorCode.TrackNotFound,
            message: 'That subtitle track is not available for this title.',
          });
        }
        session.selectedSubtitleId = subtitle.assetId;
      }
    }
    session.lastHeartbeat = Date.now();
    await this.sessions.persist(session);
    await this.rememberPrefs(session);
    const entitlement = await this.access.assertEntitled(userId);
    return this.toPublic(session, entitlement.maxVideoQuality);
  }

  async openAudio(
    sessionId: string,
    userId: string,
    assetId: string,
    startSeconds = 0,
  ): Promise<{
    size: number;
    mime: string;
    remux: boolean;
    open: (range?: { start: number; end: number }) => Promise<Readable>;
  }> {
    const session = await this.sessions.requireOwned(sessionId, userId);
    await this.ensurePlayable(session, userId);
    const track = session.audioTracks.find((item) => item.assetId === assetId);
    if (!track) {
      throw new NotFoundException({
        error: ErrorCode.TrackNotFound,
        message: 'That audio track is not available for this title.',
      });
    }

    if (track.embedded) {
      if (!this.remux.available()) {
        throw new NotFoundException({
          error: ErrorCode.AudioUnavailable,
          message: 'FFmpeg is required to play alternate embedded audio tracks.',
        });
      }
      const variant = session.variants[0];
      if (!variant) {
        throw new NotFoundException({
          error: ErrorCode.PlaybackUnavailable,
          message: 'No playable media is attached to this title.',
        });
      }
      const videoAsset = await this.assets.findById(variant.assetId).select('+storagePath +libraryItemId');
      if (!videoAsset) {
        throw new NotFoundException({
          error: ErrorCode.PlaybackUnavailable,
          message: 'No playable media is attached to this title.',
        });
      }
      const located = await this.resolveAbsoluteMedia(videoAsset);
      const ordinal = track.streamIndex ?? 0;
      const start = Number.isFinite(startSeconds) ? Math.max(0, startSeconds) : 0;
      return {
        size: 0,
        mime: 'audio/aac',
        remux: true,
        open: async () => this.remux.openAudioExtract(located.absPath, ordinal, start),
      };
    }

    if (!track.playable) {
      throw new NotFoundException({
        error: ErrorCode.AudioUnavailable,
        message: 'This audio track cannot be streamed separately.',
      });
    }
    const asset = await this.requireTrackAsset(assetId, MediaKind.Audio, session);
    const file = await this.resolveFile(asset);
    return { ...file, remux: false };
  }

  async openSubtitle(sessionId: string, userId: string, assetId: string): Promise<string> {
    const session = await this.sessions.requireOwned(sessionId, userId);
    await this.ensurePlayable(session, userId);
    const track = session.subtitleTracks.find((item) => item.assetId === assetId);
    if (!track) {
      throw new NotFoundException({
        error: ErrorCode.TrackNotFound,
        message: 'That subtitle track is not available for this title.',
      });
    }
    if (!track.playable || !isPlayableSubtitleFormat(track.format)) {
      throw new NotFoundException({
        error: ErrorCode.SubtitleUnavailable,
        message: 'This subtitle format is not supported in the player. Use SRT or WebVTT.',
      });
    }
    const asset = await this.requireTrackAsset(assetId, MediaKind.Subtitle, session);
    const file = await this.resolveFile(asset);
    if (file.size > MAX_SUBTITLE_BYTES) {
      throw new BadRequestException({
        error: ErrorCode.SubtitleUnavailable,
        message: 'Subtitle file is too large to load safely.',
      });
    }
    const raw = await bufferToString(await file.open(), file.size);
    try {
      return toSafeWebVtt(raw, track.format);
    } catch {
      throw new BadRequestException({
        error: ErrorCode.SubtitleUnavailable,
        message: 'This subtitle file could not be converted for playback.',
      });
    }
  }

  async openMedia(
    sessionId: string,
    userId: string,
    preferredResolution?: string,
  ): Promise<{
    size: number;
    mime: string;
    remux: boolean;
    open: (range?: { start: number; end: number }) => Promise<Readable>;
  }> {
    const session = await this.sessions.requireOwned(sessionId, userId);
    await this.ensurePlayable(session, userId);
    const resolution =
      preferredResolution && (VIDEO_RESOLUTIONS as readonly string[]).includes(preferredResolution)
        ? (preferredResolution as VideoResolution)
        : session.resolution;
    const variant =
      session.variants.find((item) => item.resolution === resolution) ??
      session.variants.find((item) => item.assetId === session.assetId) ??
      session.variants[0];
    if (!variant) {
      throw new NotFoundException({
        error: ErrorCode.PlaybackUnavailable,
        message: 'No playable media is attached to this title.',
      });
    }
    const asset = await this.assets.findById(variant.assetId).select('+storagePath +libraryItemId');
    if (!asset) {
      throw new NotFoundException({
        error: ErrorCode.PlaybackUnavailable,
        message: 'No playable media is attached to this title.',
      });
    }
    const located = await this.resolveAbsoluteMedia(asset);
    const ext = path.extname(located.relativePath).toLowerCase();
    if (this.remux.available()) {
      const remuxForBrowser =
        ext === '.mkv' ||
        ((ext === '.mp4' || ext === '.m4v') && !mp4FastStart(located.absPath));
      if (remuxForBrowser) {
        return {
          size: 0,
          mime: 'video/mp4',
          remux: true,
          open: async () => this.remux.openVideoRemux(located.absPath),
        };
      }
    }

    // Serve the original file for fast-start MP4/WebM so duration/seek stay correct.
    const file = await this.resolveFile(asset);
    return { ...file, remux: false };
  }

  private async preferBrowserPlayable(assets: MediaAssetDocument[]): Promise<MediaAssetDocument[]> {
    const itemIds = assets
      .map((asset) => asset.libraryItemId)
      .filter((id): id is Types.ObjectId => Boolean(id));
    const items = itemIds.length ? await this.items.find({ _id: { $in: itemIds } }) : [];
    const pathByItemId = new Map(items.map((item) => [String(item._id), item.relativePath]));
    const scored = assets.map((asset) => {
      const relativePath = asset.libraryItemId
        ? pathByItemId.get(String(asset.libraryItemId))
        : undefined;
      const ext = relativePath ? path.extname(relativePath).toLowerCase() : '';
      const rank =
        ext === '.mp4' || ext === '.m4v' ? 0 : ext === '.webm' ? 1 : ext === '.mkv' ? 2 : 3;
      return { asset, rank };
    });
    scored.sort((a, b) => a.rank - b.rank);
    return scored.map((row) => row.asset);
  }

  private async resolveAbsoluteMedia(asset: MediaAssetDocument): Promise<{ absPath: string; relativePath: string }> {
    if (!asset.libraryItemId) {
      throw new NotFoundException({
        error: ErrorCode.PlaybackUnavailable,
        message: 'No playable media is attached to this title.',
      });
    }
    const item = await this.items.findById(asset.libraryItemId);
    if (!item) {
      throw new NotFoundException({
        error: ErrorCode.PlaybackUnavailable,
        message: 'No playable media is attached to this title.',
      });
    }
    const library = await this.libraries.findById(item.libraryId).select('+rootPath');
    if (!library?.rootPath) {
      throw new NotFoundException({
        error: ErrorCode.PlaybackUnavailable,
        message: 'No playable media is attached to this title.',
      });
    }
    return {
      absPath: resolveSafePath(library.rootPath, item.relativePath),
      relativePath: item.relativePath,
    };
  }

  parseRange(header: string | undefined, size: number): { start: number; end: number } | null {
    return parseByteRange(header, size);
  }

  private async replace(
    existing: StoredPlaybackSession,
    payload: Omit<StoredPlaybackSession, 'id' | 'createdAt' | 'lastHeartbeat'>,
  ): Promise<StoredPlaybackSession> {
    const next: StoredPlaybackSession = {
      ...existing,
      ...payload,
      id: existing.id,
      createdAt: existing.createdAt,
      lastHeartbeat: Date.now(),
    };
    await this.sessions.persist(next);
    return next;
  }

  private toPublic(session: StoredPlaybackSession, maxQuality: VideoQuality | null): PlaybackSessionInfo {
    const qualities: PlaybackQualityOption[] = session.variants.map((variant) => ({
      resolution: variant.resolution,
      quality: variant.quality,
      bandwidth: variant.bandwidth,
      label: variant.resolution,
      allowed: Boolean(maxQuality && qualityAllowed(maxQuality, variant.quality)),
    }));
    return {
      id: session.id,
      protocol: 'hls',
      hlsUrl: `${API}/stream/${session.id}/master`,
      progressiveUrl: `${API}/stream/${session.id}/media`,
      expiresAt: new Date(session.lastHeartbeat + this.sessions.ttlMs()).toISOString(),
      qualities,
      selectedQuality: session.quality,
      selectedResolution: session.resolution,
      adaptive: qualities.length > 1,
      audioTracks: (session.audioTracks ?? []).map((track) => toPlaybackTrack(session.id, track)),
      subtitleTracks: (session.subtitleTracks ?? []).map((track) => toPlaybackTrack(session.id, track)),
      selectedAudioId: session.selectedAudioId ?? null,
      selectedSubtitleId: session.selectedSubtitleId ?? null,
    };
  }

  private async resolveFile(asset: MediaAssetDocument): Promise<{
    size: number;
    mime: string;
    open: (range?: { start: number; end: number }) => Promise<Readable>;
  }> {
    if (!asset.libraryItemId) {
      throw new NotFoundException({
        error: ErrorCode.PlaybackUnavailable,
        message: 'No playable media is attached to this title.',
      });
    }
    const item = await this.items.findById(asset.libraryItemId);
    if (!item) {
      throw new NotFoundException({
        error: ErrorCode.PlaybackUnavailable,
        message: 'No playable media is attached to this title.',
      });
    }
    const library = await this.libraries.findById(item.libraryId).select('+rootPath');
    if (!library?.rootPath) {
      throw new NotFoundException({
        error: ErrorCode.PlaybackUnavailable,
        message: 'No playable media is attached to this title.',
      });
    }
    const storage = this.storageFactory.create(library.provider, library.rootPath);
    const stat = await storage.stat(item.relativePath);
    if (!stat) {
      throw new NotFoundException({
        error: ErrorCode.PlaybackUnavailable,
        message: 'The media file is missing.',
      });
    }
    const mime = mimeFromName(item.relativePath);
    return {
      size: stat.sizeBytes,
      mime,
      open: (range) => storage.openReadStream(item.relativePath, range),
    };
  }

  private async loadTracks(
    movieId?: string,
    episodeId?: string,
  ): Promise<{ audioTracks: StoredPlaybackTrack[]; subtitleTracks: StoredPlaybackTrack[] }> {
    const owner = episodeId
      ? { episodeId: new Types.ObjectId(episodeId) }
      : { movieId: new Types.ObjectId(movieId) };
    const assets = await this.assets
      .find({
        ...owner,
        kind: { $in: [MediaKind.Audio, MediaKind.Subtitle] },
        status: MediaAssetStatus.Ready,
      })
      .select('+libraryItemId')
      .sort({ sortOrder: 1, createdAt: 1 });
    const itemIds = assets
      .map((asset) => asset.libraryItemId)
      .filter((id): id is Types.ObjectId => Boolean(id));
    const items = itemIds.length
      ? await this.items.find({ _id: { $in: itemIds } })
      : [];
    const itemById = new Map(items.map((item) => [String(item._id), item]));
    const audioTracks: StoredPlaybackTrack[] = [];
    const subtitleTracks: StoredPlaybackTrack[] = [];
    for (const asset of assets) {
      const item = asset.libraryItemId ? itemById.get(String(asset.libraryItemId)) : undefined;
      const track = this.toStoredTrack(asset, item);
      if (track.kind === 'audio') {
        audioTracks.push(track);
      } else {
        subtitleTracks.push(track);
      }
    }
    return { audioTracks, subtitleTracks };
  }

  private toStoredTrack(
    asset: MediaAssetDocument,
    item?: LibraryItemDocument,
  ): StoredPlaybackTrack {
    const kind = asset.kind === MediaKind.Subtitle ? 'subtitle' : 'audio';
    const format =
      asset.format ??
      (item ? (subtitleFormatFromName(item.relativePath) as StoredPlaybackTrack['format']) : null);
    const sidecar = Boolean(
      item &&
        ((kind === 'subtitle' &&
          (item.fileKind === LibraryFileKind.Subtitle || isSubtitleFile(item.relativePath))) ||
          (kind === 'audio' &&
            (item.fileKind === LibraryFileKind.Audio || isAudioFile(item.relativePath)))),
    );
    const embedded = kind === 'audio' && !sidecar;
    const playable =
      sidecar && (kind === 'audio' || isPlayableSubtitleFormat(format));
    return {
      assetId: String(asset._id),
      kind,
      language: asProfileLanguage(asset.language) ?? asset.language ?? null,
      label: asset.label ?? null,
      codec: asset.codec ?? null,
      channels: asset.channels ?? null,
      format: kind === 'subtitle' ? format : null,
      forced: Boolean(asset.forced),
      hearingImpaired: Boolean(asset.hearingImpaired),
      isDefault: Boolean(asset.isDefault),
      playable,
      embedded,
      streamIndex: embedded ? (asset.sortOrder ?? 0) : null,
    };
  }

  private async requireTrackAsset(
    assetId: string,
    kind: MediaKind,
    session: StoredPlaybackSession,
  ): Promise<MediaAssetDocument> {
    if (!Types.ObjectId.isValid(assetId) || assetId.length !== 24) {
      throw new NotFoundException({
        error: ErrorCode.TrackNotFound,
        message: 'Track not found.',
      });
    }
    const asset = await this.assets.findById(assetId).select('+storagePath +libraryItemId');
    if (!asset || asset.kind !== kind || asset.status !== MediaAssetStatus.Ready) {
      throw new NotFoundException({
        error: ErrorCode.TrackNotFound,
        message: 'Track not found.',
      });
    }
    const ownerOk = session.episodeId
      ? String(asset.episodeId ?? '') === session.episodeId
      : String(asset.movieId ?? '') === session.movieId;
    if (!ownerOk) {
      throw new NotFoundException({
        error: ErrorCode.TrackNotFound,
        message: 'That track does not belong to this title.',
      });
    }
    return asset;
  }

  private async ensurePlayable(session: StoredPlaybackSession, userId: string): Promise<void> {
    if (await this.isCatalogLive(session)) {
      return;
    }
    await this.sessions.stop(session.id, userId);
    throw new NotFoundException({
      error: ErrorCode.PlaybackUnavailable,
      message: 'This title is no longer available.',
    });
  }

  private async isCatalogLive(session: StoredPlaybackSession): Promise<boolean> {
    if (session.mediaType === 'movie' || session.movieId) {
      const movie = await this.movies
        .findById(session.movieId ?? session.mediaId)
        .select('published')
        .lean();
      return Boolean(movie?.published);
    }
    const episode = await this.episodes
      .findById(session.episodeId ?? session.mediaId)
      .select('published seriesId')
      .lean();
    if (!episode?.published) {
      return false;
    }
    const series = await this.series.findById(episode.seriesId).select('published').lean();
    return Boolean(series?.published);
  }

  private async rememberPrefs(session: StoredPlaybackSession): Promise<void> {
    const audio = session.audioTracks.find((track) => track.assetId === session.selectedAudioId);
    const subtitle = session.subtitleTracks.find((track) => track.assetId === session.selectedSubtitleId);
    const audioLanguage = asProfileLanguage(audio?.language ?? null);
    await this.profiles.rememberPlaybackPrefs(session.userId, session.profileId, {
      audioLanguage: audioLanguage ?? undefined,
      subtitleLanguage: session.selectedSubtitleId
        ? asProfileLanguage(subtitle?.language ?? null) ?? undefined
        : 'off',
    });
  }
}

async function bufferToString(stream: Readable, size: number): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > size && size > 0) {
      break;
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function parseByteRange(header: string | undefined, size: number): { start: number; end: number } | null {
  if (!header || size <= 0) {
    return null;
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) {
    return null;
  }
  if (!match[1] && match[2]) {
    const suffix = Number(match[2]);
    if (!Number.isFinite(suffix) || suffix <= 0) {
      return null;
    }
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
    return null;
  }
  return { start, end: Math.min(end, size - 1) };
}

export function mimeFromName(name: string): string {
  const ext = name.toLowerCase().split('.').pop();
  if (ext === 'mp4' || ext === 'm4v') return 'video/mp4';
  if (ext === 'webm') return 'video/webm';
  if (ext === 'mkv') return 'video/x-matroska';
  if (ext === 'ts' || ext === 'm2ts') return 'video/mp2t';
  if (ext === 'm4a' || ext === 'aac') return 'audio/mp4';
  if (ext === 'mp3') return 'audio/mpeg';
  if (ext === 'ac3' || ext === 'eac3') return 'audio/ac3';
  if (ext === 'ogg' || ext === 'opus') return 'audio/ogg';
  if (ext === 'wav') return 'audio/wav';
  if (ext === 'flac') return 'audio/flac';
  if (ext === 'vtt') return 'text/vtt';
  if (ext === 'srt') return 'application/x-subrip';
  return 'application/octet-stream';
}

export function isSessionId(value: string): boolean {
  return /^[a-f0-9]{32}$/.test(value);
}
