import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ErrorCode, type PublicMovieCollection } from '@movie-server/shared';
import { MovieCollection, MovieCollectionDocument } from './schemas/movie-collection.schema';
import { Movie, MovieDocument } from './schemas/movie.schema';
import { UpsertCollectionDto, UpdateCollectionDto } from './dto/collection.dto';
import { toPublicCollection } from './movie.mapper';
import { slugify } from './movie.util';

@Injectable()
export class CollectionsService {
  constructor(
    @InjectModel(MovieCollection.name)
    private readonly collectionModel: Model<MovieCollectionDocument>,
    @InjectModel(Movie.name) private readonly movieModel: Model<MovieDocument>,
  ) {}

  async uniqueSlug(name: string, excludeId?: string): Promise<string> {
    const base = slugify(name);
    let slug = base;
    let n = 2;
    for (;;) {
      const existing = await this.collectionModel.findOne({
        slug,
        ...(excludeId ? { _id: { $ne: new Types.ObjectId(excludeId) } } : {}),
      });
      if (!existing) {
        return slug;
      }
      slug = `${base}-${n}`;
      n += 1;
    }
  }

  async create(dto: UpsertCollectionDto): Promise<MovieCollectionDocument> {
    return this.collectionModel.create({
      name: dto.name,
      slug: dto.slug ?? (await this.uniqueSlug(dto.name)),
      description: dto.description ?? '',
      posterUrl: dto.posterUrl ?? null,
      sortOrder: dto.sortOrder ?? 0,
    });
  }

  async update(id: string, dto: UpdateCollectionDto): Promise<MovieCollectionDocument> {
    const collection = await this.collectionModel.findByIdAndUpdate(
      id,
      { $set: dto },
      { returnDocument: 'after' },
    );
    if (!collection) {
      throw new NotFoundException({
        error: ErrorCode.NotFound,
        message: 'Collection not found.',
      });
    }
    return collection;
  }

  async remove(id: string): Promise<void> {
    const collection = await this.collectionModel.findByIdAndDelete(id);
    if (!collection) {
      throw new NotFoundException({
        error: ErrorCode.NotFound,
        message: 'Collection not found.',
      });
    }
    await this.movieModel.updateMany(
      { collectionId: collection._id },
      { $set: { collectionId: null } },
    );
  }

  async get(idOrSlug: string): Promise<MovieCollectionDocument> {
    const byId = Types.ObjectId.isValid(idOrSlug) ? await this.collectionModel.findById(idOrSlug) : null;
    const collection = byId ?? (await this.collectionModel.findOne({ slug: idOrSlug.toLowerCase() }));
    if (!collection) {
      throw new NotFoundException({
        error: ErrorCode.NotFound,
        message: 'Collection not found.',
      });
    }
    return collection;
  }

  async listAll(): Promise<MovieCollectionDocument[]> {
    return this.collectionModel.find().sort({ sortOrder: 1, name: 1 });
  }

  async toPublicList(
    collections: MovieCollectionDocument[],
    counts: Map<string, number>,
  ): Promise<PublicMovieCollection[]> {
    return collections.map((collection) =>
      toPublicCollection(collection, counts.get(String(collection._id)) ?? 0),
    );
  }

  async publishedCounts(movieFilter: Record<string, unknown>): Promise<Map<string, number>> {
    const rows = await this.movieModel.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { ...movieFilter, collectionId: { $ne: null } } },
      { $group: { _id: '$collectionId', count: { $sum: 1 } } },
    ]);
    return new Map(rows.map((row) => [String(row._id), row.count]));
  }
}
