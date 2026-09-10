import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CatalogTermKind,
  ErrorCode,
  MOVIE_GENRES,
  type AdminCatalogTerm,
} from '@movie-server/shared';
import { CatalogTerm, CatalogTermDocument } from './schemas/catalog-term.schema';
import { Movie, MovieDocument } from '../movies/schemas/movie.schema';
import { Series, SeriesDocument } from '../series/schemas/series.schema';

@Injectable()
export class CatalogService {
  constructor(
    @InjectModel(CatalogTerm.name) private readonly terms: Model<CatalogTermDocument>,
    @InjectModel(Movie.name) private readonly movies: Model<MovieDocument>,
    @InjectModel(Series.name) private readonly series: Model<SeriesDocument>,
  ) {}

  async list(kind: CatalogTermKind, q?: string): Promise<AdminCatalogTerm[]> {
    await this.ensureSeeded(kind);
    const filter: Record<string, unknown> = { kind };
    if (q?.trim()) {
      filter.$or = [
        { name: new RegExp(escapeRegex(q.trim()), 'i') },
        { slug: new RegExp(escapeRegex(q.trim()), 'i') },
      ];
    }
    const rows = await this.terms.find(filter).sort({ sortOrder: 1, name: 1 }).limit(500).exec();
    const usage = await this.usageMap(kind);
    return rows.map((row) => toPublicTerm(row, usage.get(row.slug) ?? 0));
  }

  async create(kind: CatalogTermKind, input: { name: string; slug?: string; sortOrder?: number }) {
    const slug = slugify(input.slug || input.name);
    const existing = await this.terms.findOne({ kind, slug });
    if (existing) {
      throw new ConflictException({
        error: ErrorCode.Conflict,
        message: 'A catalog term with that name already exists.',
      });
    }
    const created = await this.terms.create({
      kind,
      slug,
      name: input.name.trim().slice(0, 40),
      enabled: true,
      sortOrder: input.sortOrder ?? 0,
    });
    return toPublicTerm(created, 0);
  }

  async update(
    kind: CatalogTermKind,
    id: string,
    input: { name?: string; enabled?: boolean; sortOrder?: number },
  ) {
    const term = await this.terms.findOne({ _id: id, kind });
    if (!term) {
      throw new NotFoundException({ error: ErrorCode.NotFound, message: 'Catalog term not found.' });
    }
    if (input.name) term.name = input.name.trim().slice(0, 40);
    if (input.enabled !== undefined) term.enabled = input.enabled;
    if (input.sortOrder !== undefined) term.sortOrder = input.sortOrder;
    await term.save();
    const usage = await this.usageMap(kind);
    return toPublicTerm(term, usage.get(term.slug) ?? 0);
  }

  async remove(kind: CatalogTermKind, id: string) {
    const term = await this.terms.findOne({ _id: id, kind });
    if (!term) {
      throw new NotFoundException({ error: ErrorCode.NotFound, message: 'Catalog term not found.' });
    }
    const usage = await this.usageMap(kind);
    if ((usage.get(term.slug) ?? 0) > 0) {
      throw new ConflictException({
        error: ErrorCode.Conflict,
        message: 'Disable this term instead. It is still used on titles.',
      });
    }
    await term.deleteOne();
    return { deleted: true };
  }

  private async ensureSeeded(kind: CatalogTermKind): Promise<void> {
    if (kind !== CatalogTermKind.Genre) return;
    const count = await this.terms.countDocuments({ kind });
    if (count > 0) return;
    await this.terms.insertMany(
      MOVIE_GENRES.map((genre, index) => ({
        kind: CatalogTermKind.Genre,
        slug: genre,
        name: genre.replace(/-/g, ' '),
        enabled: true,
        sortOrder: index,
      })),
    );
  }

  private async usageMap(kind: CatalogTermKind): Promise<Map<string, number>> {
    const field = kind === CatalogTermKind.Genre ? 'genres' : 'tags';
    const [movieAgg, seriesAgg] = await Promise.all([
      this.movies.aggregate<{ _id: string; count: number }>([
        { $unwind: `$${field}` },
        { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      ]),
      this.series.aggregate<{ _id: string; count: number }>([
        { $unwind: `$${field}` },
        { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      ]),
    ]);
    const map = new Map<string, number>();
    for (const row of [...movieAgg, ...seriesAgg]) {
      const key = String(row._id).toLowerCase();
      map.set(key, (map.get(key) ?? 0) + row.count);
    }
    return map;
  }
}

function toPublicTerm(row: CatalogTermDocument, usageCount: number): AdminCatalogTerm {
  return {
    id: String(row._id),
    kind: row.kind,
    slug: row.slug,
    name: row.name,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
    usageCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
