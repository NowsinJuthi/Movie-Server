import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PersonalizationMediaKind, type UserRatingItem } from '@movie-server/shared';
import { ProfileAccessService } from './profile-access.service';
import { UserRating, UserRatingDocument } from './schemas/user-rating.schema';
import { RecommendationsService } from './recommendations.service';
import { RedisService } from '../redis/redis.service';
import { invalidateHomeProfileCache, recommendationsCacheKey } from '../common/cache-keys';
import { LibraryMediaService } from './library-media.service';

@Injectable()
export class UserRatingsService {
  constructor(
    @InjectModel(UserRating.name) private readonly ratingModel: Model<UserRatingDocument>,
    private readonly access: ProfileAccessService,
    private readonly library: LibraryMediaService,
    private readonly recommendations: RecommendationsService,
    private readonly redis: RedisService,
  ) {}

  async list(userId: string, profileId: string): Promise<UserRatingItem[]> {
    await this.access.getOwned(userId, profileId);
    const rows = await this.ratingModel
      .find({ profileId: new Types.ObjectId(profileId), userId: new Types.ObjectId(userId) })
      .sort({ updatedAt: -1 })
      .exec();
    return rows.map(toPublic);
  }

  async upsert(
    userId: string,
    profileId: string,
    mediaId: string,
    kind: PersonalizationMediaKind,
    rating: number,
  ): Promise<UserRatingItem> {
    await this.access.getOwned(userId, profileId);
    await this.library.assertPublished(mediaId, kind);
    const row = await this.ratingModel.findOneAndUpdate(
      {
        profileId: new Types.ObjectId(profileId),
        userId: new Types.ObjectId(userId),
        mediaId,
      },
      {
        $set: { kind, rating },
        $setOnInsert: {
          profileId: new Types.ObjectId(profileId),
          userId: new Types.ObjectId(userId),
          mediaId,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
    await this.afterChange(userId, profileId);
    return toPublic(row!);
  }

  async remove(userId: string, profileId: string, mediaId: string): Promise<{ message: string }> {
    await this.access.getOwned(userId, profileId);
    await this.ratingModel.deleteOne({
      profileId: new Types.ObjectId(profileId),
      userId: new Types.ObjectId(userId),
      mediaId,
    });
    await this.afterChange(userId, profileId);
    return { message: 'Rating removed.' };
  }

  private async afterChange(userId: string, profileId: string) {
    await this.redis.client.del(recommendationsCacheKey(profileId));
    await invalidateHomeProfileCache(this.redis.client, profileId);
    await this.recommendations.scheduleRefresh(userId, profileId);
  }
}

function toPublic(row: UserRatingDocument): UserRatingItem {
  return {
    id: String(row._id),
    profileId: String(row.profileId),
    mediaId: row.mediaId,
    kind: row.kind,
    rating: row.rating,
    updatedAt: (row.updatedAt ?? new Date()).toISOString(),
  };
}
