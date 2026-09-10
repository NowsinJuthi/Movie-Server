import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  MediaReaction,
  PersonalizationMediaKind,
  type MediaReactionItem,
} from '@movie-server/shared';
import { ProfileAccessService } from './profile-access.service';
import { MediaReactionDoc, MediaReactionDocument } from './schemas/media-reaction.schema';
import { RecommendationsService } from './recommendations.service';
import { RedisService } from '../redis/redis.service';
import { invalidateHomeProfileCache, recommendationsCacheKey } from '../common/cache-keys';
import { LibraryMediaService } from './library-media.service';

@Injectable()
export class MediaReactionsService {
  constructor(
    @InjectModel(MediaReactionDoc.name) private readonly reactionModel: Model<MediaReactionDocument>,
    private readonly access: ProfileAccessService,
    private readonly library: LibraryMediaService,
    private readonly recommendations: RecommendationsService,
    private readonly redis: RedisService,
  ) {}

  async list(userId: string, profileId: string): Promise<MediaReactionItem[]> {
    await this.access.getOwned(userId, profileId);
    const rows = await this.reactionModel
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
    reaction?: MediaReaction | 'none',
  ): Promise<{ item: MediaReactionItem | null }> {
    await this.access.getOwned(userId, profileId);
    const filter = {
      profileId: new Types.ObjectId(profileId),
      userId: new Types.ObjectId(userId),
      mediaId,
    };
    if (!reaction || reaction === 'none') {
      await this.reactionModel.deleteOne(filter);
      await this.afterChange(userId, profileId);
      return { item: null };
    }
    await this.library.assertPublished(mediaId, kind);
    const row = await this.reactionModel.findOneAndUpdate(
      filter,
      { $set: { kind, reaction }, $setOnInsert: { ...filter } },
      { upsert: true, returnDocument: 'after' },
    );
    await this.afterChange(userId, profileId);
    return { item: toPublic(row!) };
  }

  private async afterChange(userId: string, profileId: string) {
    await this.redis.client.del(recommendationsCacheKey(profileId));
    await invalidateHomeProfileCache(this.redis.client, profileId);
    await this.recommendations.scheduleRefresh(userId, profileId);
  }
}

function toPublic(row: MediaReactionDocument): MediaReactionItem {
  return {
    id: String(row._id),
    profileId: String(row.profileId),
    mediaId: row.mediaId,
    kind: row.kind,
    reaction: row.reaction,
    updatedAt: (row.updatedAt ?? new Date()).toISOString(),
  };
}
