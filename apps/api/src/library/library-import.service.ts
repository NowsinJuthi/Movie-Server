import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { promises as fs } from 'fs';
import { Model, Types } from 'mongoose';
import { LibraryFileKind, LibraryKind, LibraryMatchType, MaturityLevel } from '@movie-server/shared';
import { sniffImageMime } from '../common/security/image-bytes';
import { MoviesService } from '../movies/movies.service';
import { Movie, MovieDocument } from '../movies/schemas/movie.schema';
import { ArtworkStorageService } from '../movies/artwork-storage.service';
import { SeriesService } from '../series/series.service';
import { Series, SeriesDocument } from '../series/schemas/series.schema';
import { Season, SeasonDocument } from '../series/schemas/season.schema';
import { Episode, EpisodeDocument } from '../series/schemas/episode.schema';
import { resolveSafePath } from './storage/path-safety';
import { LibraryMatcher, LibraryMatchResult } from './matching/library-matcher';
import { parseMediaFilename } from './matching/filename-parser';
import { clampReleaseYear, fallbackDescription, runtimeMinutesFromMs } from './metadata/import-defaults';
import { localArtworkKeys } from './metadata/local-artwork';
import { TmdbMetadataService, type CatalogMetadata, type RemoteArtwork } from './metadata/tmdb-metadata.service';
import { LibraryExclusionService } from './library-exclusion.service';

export type ImportContext = {
  libraryId: string;
  libraryRoot: string;
  fileKind: LibraryFileKind;
  durationMs?: number | null;
  contentHash?: string | null;
  ignored?: boolean;
};

@Injectable()
export class LibraryImportService {
  private readonly logger = new Logger(LibraryImportService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly matcher: LibraryMatcher,
    private readonly movies: MoviesService,
    private readonly series: SeriesService,
    private readonly artwork: ArtworkStorageService,
    private readonly tmdb: TmdbMetadataService,
    private readonly exclusions: LibraryExclusionService,
    @InjectModel(Movie.name) private readonly movieModel: Model<MovieDocument>,
    @InjectModel(Series.name) private readonly seriesModel: Model<SeriesDocument>,
    @InjectModel(Season.name) private readonly seasonModel: Model<SeasonDocument>,
    @InjectModel(Episode.name) private readonly episodeModel: Model<EpisodeDocument>,
  ) {}

  async resolve(
    relativePath: string,
    kind: LibraryKind,
    context: ImportContext,
  ): Promise<LibraryMatchResult> {
    const existing = await this.matcher.match(relativePath, kind);
    if (existing.match !== LibraryMatchType.None) {
      await this.enrichMatched(existing, relativePath, context);
      return existing;
    }
    if (context.ignored) {
      return { ...existing, ignored: true };
    }
    const parsed = parseMediaFilename(relativePath);
    const title =
      kind === LibraryKind.Tv
        ? parsed.kind === 'episode'
          ? parsed.seriesTitle
          : null
        : parsed.kind === 'movie' || parsed.kind === 'unknown'
          ? parsed.title
          : null;
    const year =
      kind === LibraryKind.Tv
        ? parsed.kind === 'episode'
          ? parsed.year
          : undefined
        : parsed.kind === 'movie'
          ? parsed.year
          : undefined;
    const blocked = await this.exclusions.isExcluded({
      libraryId: context.libraryId,
      contentHash: context.contentHash,
      relativePath,
      title,
      year,
    });
    if (blocked) {
      return { ...existing, ignored: true };
    }
    if (!this.autoImport() || context.fileKind !== LibraryFileKind.Video) {
      return existing;
    }
    try {
      if (kind === LibraryKind.Tv) {
        return await this.importEpisode(relativePath, context);
      }
      return await this.importMovie(relativePath, context);
    } catch (error) {
      this.logger.warn(`Auto-import failed for ${relativePath}: ${error instanceof Error ? error.message : 'error'}`);
      return existing;
    }
  }

  private autoImport(): boolean {
    return this.config.get<boolean>('LIBRARY_AUTO_IMPORT') !== false;
  }

  private autoPublish(): boolean {
    return this.config.get<boolean>('LIBRARY_AUTO_PUBLISH') !== false;
  }

  private async importMovie(relativePath: string, context: ImportContext): Promise<LibraryMatchResult> {
    const parsed = parseMediaFilename(relativePath);
    const title = parsed.kind === 'movie' || parsed.kind === 'unknown' ? parsed.title?.trim() : '';
    const year = parsed.kind === 'movie' ? parsed.year : undefined;
    if (!title || parsed.kind === 'episode') {
      return { match: LibraryMatchType.None };
    }

    const found = await this.matcher.findMovie(title, year, { yearRequired: Boolean(year) });
    if (found) {
      await this.enrichMovie(found, relativePath, context);
      return { match: LibraryMatchType.Movie, movieId: found._id, matchTitle: found.title };
    }

    const meta = await this.tmdb.searchMovie(title, year);
    const releaseYear = clampReleaseYear(meta?.year ?? year);
    const runtimeMinutes = runtimeMinutesFromMs(context.durationMs, meta?.runtimeMinutes ?? 90);
    const created = await this.movies.create({
      title: (meta?.title || title).slice(0, 200),
      originalTitle: meta?.originalTitle ?? null,
      description: (meta?.overview && meta.overview.length >= 4 ? meta.overview : fallbackDescription(title)).slice(0, 4000),
      releaseYear,
      runtimeMinutes,
      genres: meta?.genres?.length ? meta.genres : ['drama'],
      maturityRating: MaturityLevel.Mature,
      ratings: meta?.tmdbRating != null ? { tmdb: Math.min(10, Math.max(0, meta.tmdbRating)) } : undefined,
      cast: meta?.cast?.length ? meta.cast : undefined,
      directors: meta?.directors?.length ? meta.directors : undefined,
      writers: meta?.writers?.length ? meta.writers : undefined,
      published: this.autoPublish(),
      featured: true,
      trending: true,
      popular: true,
    });
    await this.applyArtwork(String(created._id), 'movie', relativePath, context.libraryRoot, meta);
    return { match: LibraryMatchType.Movie, movieId: created._id, matchTitle: created.title };
  }

  private async importEpisode(relativePath: string, context: ImportContext): Promise<LibraryMatchResult> {
    const parsed = parseMediaFilename(relativePath);
    if (parsed.kind !== 'episode' || !parsed.seriesTitle.trim()) {
      return { match: LibraryMatchType.None };
    }

    const series = await this.ensureSeries(parsed.seriesTitle, parsed.year, relativePath, context);
    const season = await this.ensureSeason(series, parsed.seasonNumber);
    const episode = await this.ensureEpisode(series, season, parsed.episodeNumber, parsed.episodeTitle, context);
    return {
      match: LibraryMatchType.Episode,
      seriesId: series._id,
      seasonId: season._id,
      episodeId: episode._id,
      matchTitle: `${series.title} S${String(parsed.seasonNumber).padStart(2, '0')}E${String(parsed.episodeNumber).padStart(2, '0')}`,
    };
  }

  private async ensureSeries(
    title: string,
    year: number | undefined,
    relativePath: string,
    context: ImportContext,
  ): Promise<SeriesDocument> {
    const existing = await this.matcher.findSeries(title);
    if (existing) {
      await this.enrichSeries(existing, relativePath, context);
      return existing;
    }
    const meta = await this.tmdb.searchSeries(title, year);
    const created = await this.series.createSeries({
      title: (meta?.title || title).slice(0, 200),
      originalTitle: meta?.originalTitle ?? null,
      description: (meta?.overview && meta.overview.length >= 4 ? meta.overview : fallbackDescription(title)).slice(0, 4000),
      firstAirYear: clampReleaseYear(meta?.year ?? year),
      genres: meta?.genres?.length ? meta.genres : ['drama'],
      maturityRating: MaturityLevel.Mature,
      ratings: meta?.tmdbRating != null ? { tmdb: Math.min(10, Math.max(0, meta.tmdbRating)) } : undefined,
      cast: meta?.cast?.length ? meta.cast : undefined,
      directors: meta?.directors?.length ? meta.directors : undefined,
      published: this.autoPublish(),
      featured: true,
      trending: true,
      popular: true,
    });
    await this.applyArtwork(String(created._id), 'series', relativePath, context.libraryRoot, meta);
    return created;
  }

  private async ensureSeason(series: SeriesDocument, seasonNumber: number): Promise<SeasonDocument> {
    const existing = await this.seasonModel.findOne({ seriesId: series._id, seasonNumber });
    if (existing) {
      return existing;
    }
    try {
      return await this.series.createSeason(String(series._id), {
        seasonNumber,
        name: seasonNumber === 0 ? 'Specials' : `Season ${seasonNumber}`,
        published: this.autoPublish(),
      });
    } catch {
      const retry = await this.seasonModel.findOne({ seriesId: series._id, seasonNumber });
      if (retry) {
        return retry;
      }
      throw new Error(`Could not create season ${seasonNumber} for ${series.title}`);
    }
  }

  private async ensureEpisode(
    series: SeriesDocument,
    season: SeasonDocument,
    episodeNumber: number,
    episodeTitle: string | undefined,
    context: ImportContext,
  ): Promise<EpisodeDocument> {
    const existing = await this.episodeModel.findOne({
      seriesId: series._id,
      seasonNumber: season.seasonNumber,
      episodeNumber,
    });
    if (existing) {
      return existing;
    }
    const title = (episodeTitle?.trim() || `Episode ${episodeNumber}`).slice(0, 200);
    try {
      return await this.series.createEpisode(String(series._id), String(season._id), {
        episodeNumber,
        title,
        description: fallbackDescription(title).slice(0, 4000),
        runtimeMinutes: runtimeMinutesFromMs(context.durationMs, 45),
        published: this.autoPublish(),
      });
    } catch {
      const retry = await this.episodeModel.findOne({
        seriesId: series._id,
        seasonId: season._id,
        episodeNumber,
      });
      if (retry) {
        return retry;
      }
      throw new Error(`Could not create episode ${episodeNumber} for ${series.title}`);
    }
  }

  private async enrichMatched(matched: LibraryMatchResult, relativePath: string, context: ImportContext): Promise<void> {
    if (matched.movieId) {
      const movie = await this.movieModel.findById(matched.movieId);
      if (movie) {
        await this.enrichMovie(movie, relativePath, context);
      }
    }
    if (matched.seriesId) {
      const series = await this.seriesModel.findById(matched.seriesId);
      if (series) {
        await this.enrichSeries(series, relativePath, context);
      }
    }
  }

  private async enrichMovie(movie: MovieDocument, relativePath: string, context: ImportContext): Promise<void> {
    let dirty = false;
    if (movie.published && !movie.featured && !movie.trending && !movie.popular) {
      movie.featured = true;
      movie.trending = true;
      movie.popular = true;
      dirty = true;
    }
    const needsPeople =
      !(movie.cast?.length || movie.directors?.length || movie.writers?.length) ||
      Boolean(movie.cast?.some((member) => !member.imageUrl));
    const needsArtwork = !(movie.posterKey || movie.posterUrl);
    if (needsPeople || needsArtwork) {
      const meta = await this.tmdb.searchMovie(movie.title, movie.releaseYear);
      if (needsPeople && meta) {
        if (meta.cast.length) {
          movie.cast = meta.cast.map((member, index) => ({
            name: member.name,
            character: member.character ?? null,
            order: member.order ?? index,
            imageUrl: member.imageUrl ?? null,
          }));
          dirty = true;
        }
        if (meta.directors.length) {
          movie.directors = meta.directors;
          dirty = true;
        }
        if (meta.writers.length) {
          movie.writers = meta.writers;
          dirty = true;
        }
        if ((!movie.description || movie.description.length < 20) && meta.overview) {
          movie.description = meta.overview.slice(0, 4000);
          dirty = true;
        }
        if (meta.tmdbRating != null && movie.ratings?.tmdb == null) {
          movie.ratings = { ...(movie.ratings ?? {}), tmdb: Math.min(10, Math.max(0, meta.tmdbRating)) };
          dirty = true;
        }
      }
      if (dirty) {
        await movie.save();
      }
      if (needsArtwork) {
        await this.applyArtwork(String(movie._id), 'movie', relativePath, context.libraryRoot, meta);
      }
      return;
    }
    if (dirty) {
      await movie.save();
    }
  }

  private async enrichSeries(series: SeriesDocument, relativePath: string, context: ImportContext): Promise<void> {
    const needsPeople = !(series.cast?.length || series.directors?.length);
    const needsArtwork = !(series.posterKey || series.posterUrl);
    if (!needsPeople && !needsArtwork) {
      return;
    }
    const meta = await this.tmdb.searchSeries(series.title, series.firstAirYear);
    let dirty = false;
    if (needsPeople && meta) {
      if (meta.cast.length) {
        series.cast = meta.cast.map((member, index) => ({
          name: member.name,
          character: member.character ?? null,
          order: member.order ?? index,
          imageUrl: member.imageUrl ?? null,
        }));
        dirty = true;
      }
      if (meta.directors.length) {
        series.directors = meta.directors;
        dirty = true;
      }
    }
    if (dirty) {
      await series.save();
    }
    if (needsArtwork) {
      await this.applyArtwork(String(series._id), 'series', relativePath, context.libraryRoot, meta);
    }
  }

  private async applyArtwork(
    id: string,
    kind: 'movie' | 'series',
    relativePath: string,
    libraryRoot: string,
    meta: CatalogMetadata | null,
  ): Promise<void> {
    const local = await this.readLocalArtwork(libraryRoot, relativePath);
    const poster = local.poster ?? (await this.tmdb.downloadPoster(meta?.posterPath ?? null));
    const backdrop = local.backdrop ?? (await this.tmdb.downloadBackdrop(meta?.backdropPath ?? null));
    if (poster) {
      await this.attach(kind, id, 'poster', poster);
    }
    if (backdrop) {
      await this.attach(kind, id, 'backdrop', backdrop);
    }
  }

  private async attach(
    kind: 'movie' | 'series',
    id: string,
    slot: 'poster' | 'backdrop',
    file: RemoteArtwork,
  ): Promise<void> {
    try {
      const payload = { mimetype: file.mimetype, buffer: file.buffer, size: file.buffer.length };
      if (kind === 'movie') {
        await this.movies.attachArtwork(id, slot, payload);
      } else {
        await this.series.attachArtwork({ seriesId: id }, slot, payload);
      }
    } catch (error) {
      this.logger.debug(`Artwork attach skipped: ${error instanceof Error ? error.message : 'error'}`);
    }
  }

  private async readLocalArtwork(
    libraryRoot: string,
    relativePath: string,
  ): Promise<{ poster: RemoteArtwork | null; backdrop: RemoteArtwork | null }> {
    const keys = localArtworkKeys(relativePath);
    return {
      poster: await this.readFirstImage(libraryRoot, keys.posters),
      backdrop: await this.readFirstImage(libraryRoot, keys.backdrops),
    };
  }

  private async readFirstImage(libraryRoot: string, keys: string[]): Promise<RemoteArtwork | null> {
    const maxBytes = this.artwork.maxBytes();
    for (const key of keys) {
      try {
        const full = resolveSafePath(libraryRoot, key);
        const stat = await fs.stat(full);
        if (!stat.isFile() || stat.size <= 0 || stat.size > maxBytes) {
          continue;
        }
        const buffer = await fs.readFile(full);
        const mime = sniffImageMime(buffer);
        if (!mime) {
          continue;
        }
        return { buffer, mimetype: mime };
      } catch {
        continue;
      }
    }
    return null;
  }
}
