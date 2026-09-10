import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ErrorCode,
  PersonalizationMediaKind,
  type FavoriteItem,
} from '@movie-server/shared';
import { ProfileAccessService } from './profile-access.service';
import { Favorite, FavoriteDocument } from './schemas/favorite.schema';
import { RecommendationsService } from './recommendations.service';
import { RedisService } from '../redis/redis.service';
import { invalidateHomeProfileCache, recommendationsCacheKey } from '../common/cache-keys';
import { LibraryMediaService } from './library-media.service';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectModel(Favorite.name) private readonly favoriteModel: Model<FavoriteDocument>,
    private readonly access: ProfileAccessService,
    private readonly library: LibraryMediaService,
    private readonly recommendations: RecommendationsService,
    private readonly redis: RedisService,
  ) {}

  async list(userId: string, profileId: string): Promise<FavoriteItem[]> {
    await this.access.getOwned(userId, profileId);
    const rows = await this.favoriteModel
      .find({ profileId: new Types.ObjectId(profileId), userId: new Types.ObjectId(userId) })
      .sort({ addedAt: -1 })
      .exec();
    return rows.map(toPublic);
  }

  async add(
    userId: string,
    profileId: string,
    mediaId: string,
    kind: PersonalizationMediaKind,
  ): Promise<FavoriteItem> {
    await this.access.getOwned(userId, profileId);
    await this.library.assertPublished(mediaId, kind);
    try {
      const row = await this.favoriteModel.create({
        profileId: new Types.ObjectId(profileId),
        userId: new Types.ObjectId(userId),
        mediaId,
        kind,
        addedAt: new Date(),
      });
      await this.afterChange(userId, profileId);
      return toPublic(row);
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: number }).code === 11000
      ) {
        throw new ConflictException({
          error: ErrorCode.Conflict,
          message: 'Already in Favorites.',
        });
      }
      throw error;
    }
  }

  async remove(userId: string, profileId: string, mediaId: string): Promise<{ message: string }> {
    await this.access.getOwned(userId, profileId);
    await this.favoriteModel.deleteOne({
      profileId: new Types.ObjectId(profileId),
      userId: new Types.ObjectId(userId),
      mediaId,
    });
    await this.afterChange(userId, profileId);
    return { message: 'Removed from Favorites.' };
  }

  private async afterChange(userId: string, profileId: string) {
    await this.redis.client.del(recommendationsCacheKey(profileId));
    await invalidateHomeProfileCache(this.redis.client, profileId);
    await this.recommendations.scheduleRefresh(userId, profileId);
  }
}

function toPublic(row: FavoriteDocument): FavoriteItem {
  return {
    id: String(row._id),
    profileId: String(row.profileId),
    mediaId: row.mediaId,
    kind: row.kind,
    addedAt: row.addedAt.toISOString(),
  };
}
