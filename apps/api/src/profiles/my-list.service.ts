import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ErrorCode, type MyListItem as PublicMyListItem } from '@movie-server/shared';
import { ProfileAccessService } from './profile-access.service';
import { MyListItem, MyListItemDocument } from './schemas/my-list.schema';
import { RecommendationsService } from './recommendations.service';
import { RedisService } from '../redis/redis.service';
import { invalidateHomeProfileCache } from '../common/cache-keys';
import { LibraryMediaService } from './library-media.service';

@Injectable()
export class MyListService {
  constructor(
    @InjectModel(MyListItem.name) private readonly listModel: Model<MyListItemDocument>,
    private readonly access: ProfileAccessService,
    private readonly library: LibraryMediaService,
    private readonly recommendations: RecommendationsService,
    private readonly redis: RedisService,
  ) {}

  async list(userId: string, profileId: string): Promise<PublicMyListItem[]> {
    await this.access.getOwned(userId, profileId);
    const rows = await this.listModel
      .find({ profileId: new Types.ObjectId(profileId), userId: new Types.ObjectId(userId) })
      .sort({ addedAt: -1 })
      .exec();
    return rows.map(toPublic);
  }

  async add(userId: string, profileId: string, mediaId: string): Promise<PublicMyListItem> {
    await this.access.getOwned(userId, profileId);
    await this.library.assertPublished(mediaId);
    try {
      const row = await this.listModel.create({
        profileId: new Types.ObjectId(profileId),
        userId: new Types.ObjectId(userId),
        mediaId,
        addedAt: new Date(),
      });
      await this.recommendations.scheduleRefresh(userId, profileId);
      await invalidateHomeProfileCache(this.redis.client, profileId);
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
          message: 'Already in My List.',
        });
      }
      throw error;
    }
  }

  async remove(userId: string, profileId: string, mediaId: string): Promise<{ message: string }> {
    await this.access.getOwned(userId, profileId);
    await this.listModel.deleteOne({
      profileId: new Types.ObjectId(profileId),
      userId: new Types.ObjectId(userId),
      mediaId,
    });
    await this.recommendations.scheduleRefresh(userId, profileId);
    await invalidateHomeProfileCache(this.redis.client, profileId);
    return { message: 'Removed from My List.' };
  }
}

function toPublic(row: MyListItemDocument): PublicMyListItem {
  return {
    id: String(row._id),
    profileId: String(row.profileId),
    mediaId: row.mediaId,
    addedAt: row.addedAt.toISOString(),
  };
}
