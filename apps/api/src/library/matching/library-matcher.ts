import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { LibraryKind, LibraryMatchType } from '@movie-server/shared';
import { Movie, MovieDocument } from '../../movies/schemas/movie.schema';
import { Series, SeriesDocument } from '../../series/schemas/series.schema';
import { Episode, EpisodeDocument } from '../../series/schemas/episode.schema';
import { escapeRegex, slugify } from '../../movies/movie.util';
import { parseMediaFilename } from './filename-parser';

export type LibraryMatchResult = {
  match: LibraryMatchType;
  movieId?: Types.ObjectId | null;
  seriesId?: Types.ObjectId | null;
  seasonId?: Types.ObjectId | null;
  episodeId?: Types.ObjectId | null;
  matchTitle?: string | null;
  ignored?: boolean;
};

@Injectable()
export class LibraryMatcher {
  constructor(
    @InjectModel(Movie.name) private readonly movies: Model<MovieDocument>,
    @InjectModel(Series.name) private readonly series: Model<SeriesDocument>,
    @InjectModel(Episode.name) private readonly episodes: Model<EpisodeDocument>,
  ) {}

  async match(relativePath: string, kind: LibraryKind): Promise<LibraryMatchResult> {
    const parsed = parseMediaFilename(relativePath);
    if (kind === LibraryKind.Tv) {
      if (parsed.kind !== 'episode') {
        return { match: LibraryMatchType.None };
      }
      const series = await this.findSeries(parsed.seriesTitle);
      if (!series) {
        return { match: LibraryMatchType.None };
      }
      const episode = await this.episodes.findOne({
        seriesId: series._id,
        seasonNumber: parsed.seasonNumber,
        episodeNumber: parsed.episodeNumber,
      });
      if (!episode) {
        return { match: LibraryMatchType.None, matchTitle: series.title };
      }
      return {
        match: LibraryMatchType.Episode,
        seriesId: series._id,
        seasonId: episode.seasonId,
        episodeId: episode._id,
        matchTitle: `${series.title} S${String(parsed.seasonNumber).padStart(2, '0')}E${String(parsed.episodeNumber).padStart(2, '0')}`,
      };
    }

    const title = parsed.kind === 'movie' ? parsed.title : parsed.kind === 'unknown' ? parsed.title : null;
    const year = parsed.kind === 'movie' ? parsed.year : undefined;
    if (!title || parsed.kind === 'episode') {
      return { match: LibraryMatchType.None };
    }
    const movie = await this.findMovie(title, year);
    if (!movie) {
      return { match: LibraryMatchType.None };
    }
    return {
      match: LibraryMatchType.Movie,
      movieId: movie._id,
      matchTitle: movie.title,
    };
  }

  async findMovie(
    title: string,
    year?: number,
    options?: { yearRequired?: boolean },
  ): Promise<MovieDocument | null> {
    const slug = slugify(title);
    const titleRx = new RegExp(`^${escapeRegex(title)}$`, 'i');
    const base = {
      $or: [{ slug }, { title: titleRx }, { originalTitle: titleRx }],
    };
    if (year) {
      const withYear = await this.movies.findOne({ ...base, releaseYear: year });
      if (withYear) {
        return withYear;
      }
      if (options?.yearRequired) {
        return null;
      }
    }
    return this.movies.findOne(base);
  }

  async findSeries(title: string): Promise<SeriesDocument | null> {
    const slug = slugify(title);
    const titleRx = new RegExp(`^${escapeRegex(title)}$`, 'i');
    return this.series.findOne({
      $or: [{ slug }, { title: titleRx }, { originalTitle: titleRx }],
    });
  }
}
