import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { LibraryMatchType, LibraryItemStatus } from '@movie-server/shared';
import { slugify } from '../movies/movie.util';
import { LibraryItem, LibraryItemDocument } from './schemas/library-item.schema';
import { LibraryExclusion, LibraryExclusionDocument } from './schemas/library-exclusion.schema';

@Injectable()
export class LibraryExclusionService {
  constructor(
    @InjectModel(LibraryItem.name) private readonly items: Model<LibraryItemDocument>,
    @InjectModel(LibraryExclusion.name) private readonly exclusions: Model<LibraryExclusionDocument>,
  ) {}

  async ignoreMovieLinks(
    movies: Array<{ id: string | Types.ObjectId; title?: string; releaseYear?: number | null }>,
  ): Promise<number> {
    const ids = movies.map((movie) => (typeof movie.id === 'string' ? new Types.ObjectId(movie.id) : movie.id));
    if (!ids.length) {
      return 0;
    }
    const items = await this.items.find({ movieId: { $in: ids } });
    const movieById = new Map(movies.map((movie) => [String(movie.id), movie]));
    for (const item of items) {
      const movie = item.movieId ? movieById.get(String(item.movieId)) : undefined;
      await this.upsertExclusion(item, 'catalog-delete', {
        title: movie?.title,
        releaseYear: movie?.releaseYear,
      });
    }
    // Always exclude by title/year so rescans cannot recreate deleted catalog titles
    // even when no library item was linked.
    for (const movie of movies) {
      if (!movie.title?.trim()) continue;
      await this.upsertTitleExclusion({
        title: movie.title,
        releaseYear: movie.releaseYear,
        reason: 'catalog-delete',
      });
    }
    const result = await this.items.updateMany(
      { movieId: { $in: ids } },
      {
        $set: {
          ignored: true,
          movieId: null,
          match: LibraryMatchType.None,
          matchTitle: null,
          status: LibraryItemStatus.Unmatched,
        },
      },
    );
    return result.modifiedCount;
  }

  async ignoreSeriesLinks(
    series: Array<{ id: string | Types.ObjectId; title?: string }>,
  ): Promise<number> {
    const ids = series.map((item) => (typeof item.id === 'string' ? new Types.ObjectId(item.id) : item.id));
    if (!ids.length) {
      return 0;
    }
    const items = await this.items.find({
      $or: [{ seriesId: { $in: ids } }, { episodeId: { $ne: null } }],
    });
    const linked = items.filter((item) => item.seriesId && ids.some((id) => String(id) === String(item.seriesId)));
    const seriesById = new Map(series.map((item) => [String(item.id), item]));
    for (const item of linked) {
      const meta = item.seriesId ? seriesById.get(String(item.seriesId)) : undefined;
      await this.upsertExclusion(item, 'catalog-delete', { title: meta?.title });
    }
    for (const entry of series) {
      if (!entry.title?.trim()) continue;
      await this.upsertTitleExclusion({
        title: entry.title,
        reason: 'catalog-delete',
      });
    }
    const result = await this.items.updateMany(
      { seriesId: { $in: ids } },
      {
        $set: {
          ignored: true,
          movieId: null,
          seriesId: null,
          seasonId: null,
          episodeId: null,
          match: LibraryMatchType.None,
          matchTitle: null,
          status: LibraryItemStatus.Unmatched,
        },
      },
    );
    return result.modifiedCount;
  }

  async isExcluded(input: {
    libraryId: Types.ObjectId | string;
    contentHash?: string | null;
    relativePath?: string | null;
    title?: string | null;
    year?: number | null;
  }): Promise<boolean> {
    const libraryId = typeof input.libraryId === 'string' ? new Types.ObjectId(input.libraryId) : input.libraryId;
    const clauses: Record<string, unknown>[] = [];
    if (input.contentHash) {
      clauses.push({ libraryId, contentHash: input.contentHash });
    }
    if (input.relativePath) {
      clauses.push({ libraryId, relativePath: input.relativePath });
    }
    if (input.title?.trim()) {
      const titleSlug = slugify(input.title);
      clauses.push({
        titleSlug,
        ...(input.year ? { releaseYear: input.year } : {}),
      });
    }
    if (!clauses.length) {
      return false;
    }
    const hit = await this.exclusions.findOne({ $or: clauses });
    return Boolean(hit);
  }

  private async upsertExclusion(
    item: LibraryItemDocument,
    reason: string,
    meta?: { title?: string; releaseYear?: number | null },
  ): Promise<void> {
    const titleSlug = meta?.title ? slugify(meta.title) : null;
    const releaseYear = meta?.releaseYear ?? null;
    if (item.contentHash) {
      await this.exclusions.updateOne(
        { libraryId: item.libraryId, contentHash: item.contentHash },
        {
          $set: {
            libraryId: item.libraryId,
            contentHash: item.contentHash,
            relativePath: item.relativePath,
            titleSlug,
            releaseYear,
            reason,
          },
        },
        { upsert: true },
      );
    }
    if (item.relativePath) {
      await this.exclusions.updateOne(
        { libraryId: item.libraryId, relativePath: item.relativePath },
        {
          $set: {
            libraryId: item.libraryId,
            relativePath: item.relativePath,
            contentHash: item.contentHash ?? null,
            titleSlug,
            releaseYear,
            reason,
          },
        },
        { upsert: true },
      );
    }
    if (titleSlug) {
      await this.exclusions.updateOne(
        { titleSlug, releaseYear: releaseYear ?? null },
        {
          $set: {
            libraryId: item.libraryId,
            relativePath: item.relativePath,
            contentHash: item.contentHash ?? null,
            titleSlug,
            releaseYear,
            reason,
          },
        },
        { upsert: true },
      );
    }
  }

  private async upsertTitleExclusion(meta: {
    title: string;
    releaseYear?: number | null;
    libraryId?: Types.ObjectId | null;
    relativePath?: string | null;
    contentHash?: string | null;
    reason: string;
  }): Promise<void> {
    const titleSlug = slugify(meta.title);
    if (!titleSlug) return;
    const releaseYear = meta.releaseYear ?? null;
    await this.exclusions.updateOne(
      { titleSlug, releaseYear },
      {
        $set: {
          libraryId: meta.libraryId ?? null,
          relativePath: meta.relativePath ?? null,
          contentHash: meta.contentHash ?? null,
          titleSlug,
          releaseYear,
          reason: meta.reason,
        },
      },
      { upsert: true },
    );
  }
}
