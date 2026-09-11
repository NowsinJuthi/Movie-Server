import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ErrorCode, type LibraryTitleCard, type PersonalizationMediaKind } from '@movie-server/shared';
import { Movie, MovieDocument } from '../movies/schemas/movie.schema';
import { Series, SeriesDocument } from '../series/schemas/series.schema';
import { Episode, EpisodeDocument } from '../series/schemas/episode.schema';
import { artworkPublicPath } from '../movies/movie.util';
import { seriesArtworkPath } from '../series/series.mapper';

@Injectable()
export class LibraryMediaService {
  constructor(
    @InjectModel(Movie.name) private readonly movieModel: Model<MovieDocument>,
    @InjectModel(Series.name) private readonly seriesModel: Model<SeriesDocument>,
    @InjectModel(Episode.name) private readonly episodeModel: Model<EpisodeDocument>,
  ) {}

  async assertPublished(mediaId: string, kind?: PersonalizationMediaKind): Promise<void> {
    const [card] = await this.titles([mediaId]);
    if (!card || card.kind === 'unknown') {
      throw new NotFoundException({
        error: ErrorCode.NotFound,
        message: 'Title not found.',
      });
    }
    if (kind && card.kind !== kind) {
      throw new NotFoundException({
        error: ErrorCode.NotFound,
        message: 'Title not found.',
      });
    }
  }

  async titles(ids: string[]): Promise<LibraryTitleCard[]> {
    const unique = [...new Set(ids)];
    const objectIds = unique
      .filter((id) => Types.ObjectId.isValid(id) && id.length === 24)
      .map((id) => new Types.ObjectId(id));
    const [movies, series, episodes] = objectIds.length
      ? await Promise.all([
          this.movieModel
            .find({ _id: { $in: objectIds }, published: true })
            .select('title posterUrl posterKey releaseYear'),
          this.seriesModel
            .find({ _id: { $in: objectIds }, published: true })
            .select('title posterUrl posterKey firstAirYear'),
          this.episodeModel
            .find({ _id: { $in: objectIds }, published: true })
            .select('title seriesId seasonNumber episodeNumber'),
        ])
      : [[], [], []];
    const seriesForEpisodes =
      episodes.length > 0
        ? await this.seriesModel
            .find({
              _id: { $in: episodes.map((item) => item.seriesId) },
              published: true,
            })
            .select('title posterUrl posterKey firstAirYear')
        : [];
    const movieMap = new Map(movies.map((item) => [String(item._id), item]));
    const seriesMap = new Map(series.map((item) => [String(item._id), item]));
    const episodeMap = new Map(episodes.map((item) => [String(item._id), item]));
    const episodeSeriesMap = new Map(seriesForEpisodes.map((item) => [String(item._id), item]));

    return ids.map((mediaId) => {
      const movie = movieMap.get(mediaId);
      if (movie) {
        return {
          mediaId,
          title: movie.title,
          kind: 'movie' as const,
          href: `/home/movies/${mediaId}`,
          posterUrl: movie.posterKey ? artworkPublicPath(movie.posterKey) : (movie.posterUrl ?? null),
          year: movie.releaseYear,
        };
      }
      const show = seriesMap.get(mediaId);
      if (show) {
        return {
          mediaId,
          title: show.title,
          kind: 'series' as const,
          href: `/home/series/${mediaId}`,
          posterUrl: show.posterKey ? seriesArtworkPath(show.posterKey) : (show.posterUrl ?? null),
          year: show.firstAirYear,
        };
      }
      const episode = episodeMap.get(mediaId);
      const parent = episode ? episodeSeriesMap.get(String(episode.seriesId)) : null;
      if (episode && parent) {
        return {
          mediaId,
          title: `${parent.title} · S${episode.seasonNumber}:E${episode.episodeNumber} ${episode.title}`,
          kind: 'episode' as const,
          href: `/home/series/${String(parent._id)}/watch/${mediaId}`,
          posterUrl: parent.posterKey ? seriesArtworkPath(parent.posterKey) : (parent.posterUrl ?? null),
          year: parent.firstAirYear,
        };
      }
      return {
        mediaId,
        title: null,
        kind: 'unknown' as const,
        href: null,
        posterUrl: null,
        year: null,
      };
    });
  }
}
