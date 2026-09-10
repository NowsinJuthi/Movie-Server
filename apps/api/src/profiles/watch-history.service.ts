import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { WatchHistoryEntry, WatchProgress } from '@movie-server/shared';
import { ProfileAccessService } from './profile-access.service';
import { WatchHistory, WatchHistoryDocument } from './schemas/watch-history.schema';
import { UpsertWatchHistoryDto } from './dto/library.dto';
import { RecommendationsService } from './recommendations.service';
import { RedisService } from '../redis/redis.service';
import { invalidateHomeProfileCache, recommendationsCacheKey } from '../common/cache-keys';
import { LibraryMediaService } from './library-media.service';

@Injectable()
export class WatchHistoryService {
  constructor(
    @InjectModel(WatchHistory.name)
    private readonly historyModel: Model<WatchHistoryDocument>,
    private readonly library: LibraryMediaService,
    private readonly access: ProfileAccessService,
    private readonly recommendations: RecommendationsService,
    private readonly redis: RedisService,
  ) {}

  async list(userId: string, profileId: string): Promise<WatchHistoryEntry[]> {
    await this.access.getOwned(userId, profileId);
    const rows = await this.historyModel
      .find({ profileId: new Types.ObjectId(profileId), userId: new Types.ObjectId(userId) })
      .sort({ lastWatchedAt: -1 })
      .limit(100)
      .exec();
    return this.hydrate(rows);
  }

  async continueWatching(userId: string, profileId: string): Promise<WatchProgress[]> {
    await this.access.getOwned(userId, profileId);
    const rows = await this.historyModel
      .find({
        profileId: new Types.ObjectId(profileId),
        userId: new Types.ObjectId(userId),
        completed: false,
        progressSeconds: { $gt: 0 },
      })
      .sort({ lastWatchedAt: -1 })
      .limit(20)
      .exec();
    return rows.map(toWatchProgress);
  }

  async upsert(
    userId: string,
    profileId: string,
    dto: UpsertWatchHistoryDto,
  ): Promise<WatchProgress> {
    await this.access.getOwned(userId, profileId);
    await this.library.assertPublished(dto.mediaId);
    const completed =
      dto.durationSeconds > 0 && dto.progressSeconds / dto.durationSeconds >= 0.95;
    const row = await this.historyModel.findOneAndUpdate(
      {
        profileId: new Types.ObjectId(profileId),
        userId: new Types.ObjectId(userId),
        mediaId: dto.mediaId,
      },
      {
        $set: {
          progressSeconds: dto.progressSeconds,
          durationSeconds: dto.durationSeconds,
          completed,
          lastWatchedAt: new Date(),
        },
        $setOnInsert: {
          profileId: new Types.ObjectId(profileId),
          userId: new Types.ObjectId(userId),
          mediaId: dto.mediaId,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
    await this.afterChange(userId, profileId);
    return toWatchProgress(row!);
  }

  async get(userId: string, profileId: string, mediaId: string): Promise<WatchProgress | null> {
    await this.access.getOwned(userId, profileId);
    const row = await this.historyModel.findOne({
      profileId: new Types.ObjectId(profileId),
      userId: new Types.ObjectId(userId),
      mediaId,
    });
    return row ? toWatchProgress(row) : null;
  }

  async listByMediaIds(
    userId: string,
    profileId: string,
    mediaIds: string[],
  ): Promise<Map<string, WatchProgress>> {
    await this.access.getOwned(userId, profileId);
    if (mediaIds.length === 0) {
      return new Map();
    }
    const rows = await this.historyModel.find({
      profileId: new Types.ObjectId(profileId),
      userId: new Types.ObjectId(userId),
      mediaId: { $in: mediaIds },
    });
    return new Map(rows.map((row) => [row.mediaId, toWatchProgress(row)]));
  }

  async remove(userId: string, profileId: string, mediaId: string): Promise<{ message: string }> {
    await this.access.getOwned(userId, profileId);
    await this.historyModel.deleteOne({
      profileId: new Types.ObjectId(profileId),
      userId: new Types.ObjectId(userId),
      mediaId,
    });
    await this.afterChange(userId, profileId);
    return { message: 'Removed from watch history.' };
  }

  async clear(userId: string, profileId: string): Promise<{ deleted: number }> {
    await this.access.getOwned(userId, profileId);
    const result = await this.historyModel.deleteMany({
      profileId: new Types.ObjectId(profileId),
      userId: new Types.ObjectId(userId),
    });
    await this.afterChange(userId, profileId);
    return { deleted: result.deletedCount ?? 0 };
  }

  private async afterChange(userId: string, profileId: string) {
    await this.redis.client.del(recommendationsCacheKey(profileId));
    await invalidateHomeProfileCache(this.redis.client, profileId);
    await this.recommendations.scheduleRefresh(userId, profileId);
  }

  private async hydrate(rows: WatchHistoryDocument[]): Promise<WatchHistoryEntry[]> {
    const titles = await this.library.titles(rows.map((row) => row.mediaId));
    return rows.flatMap((row, index) => {
      const title = titles[index];
      if (!title || title.kind === 'unknown') {
        return [];
      }
      return [
        {
          ...toWatchProgress(row),
          title: title.title,
          kind: title.kind,
          href: title.href,
          posterUrl: title.posterUrl,
          year: title.year,
        },
      ];
    });
  }
}

function toWatchProgress(row: WatchHistoryDocument): WatchProgress {
  return {
    id: String(row._id),
    profileId: String(row.profileId),
    mediaId: row.mediaId,
    progressSeconds: row.progressSeconds,
    durationSeconds: row.durationSeconds,
    completed: row.completed,
    lastWatchedAt: row.lastWatchedAt.toISOString(),
  };
}
