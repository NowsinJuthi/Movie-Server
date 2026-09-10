import { Injectable, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bullmq';
import { Model } from 'mongoose';
import type { AdminJobRecord, AdminJobsResponse, AdminQueueStats } from '@movie-server/shared';
import { LIBRARY_SCAN_QUEUE } from '../library/library-scan.service';
import { MAIL_QUEUE } from '../mail/mail.service';
import { RECOMMENDATION_QUEUE } from '../common/cache-keys';
import { LibraryScan, LibraryScanDocument } from '../library/schemas/library-scan.schema';

@Injectable()
export class AdminJobsService {
  constructor(
    @InjectModel(LibraryScan.name) private readonly scans: Model<LibraryScanDocument>,
    @Optional() @InjectQueue(LIBRARY_SCAN_QUEUE) private readonly scanQueue?: Queue,
    @Optional() @InjectQueue(MAIL_QUEUE) private readonly mailQueue?: Queue,
    @Optional() @InjectQueue(RECOMMENDATION_QUEUE) private readonly recQueue?: Queue,
  ) {}

  async list(): Promise<AdminJobsResponse> {
    const queues = (
      await Promise.all([
        this.queueStats(LIBRARY_SCAN_QUEUE, this.scanQueue),
        this.queueStats(MAIL_QUEUE, this.mailQueue),
        this.queueStats(RECOMMENDATION_QUEUE, this.recQueue),
      ])
    ).filter((item): item is AdminQueueStats => Boolean(item));

    const scans = await this.scans.find().sort({ createdAt: -1 }).limit(25).exec();
    const recent: AdminJobRecord[] = scans.map((scan) => ({
      id: String(scan._id),
      queue: LIBRARY_SCAN_QUEUE,
      name: scan.full ? 'full-scan' : 'incremental-scan',
      status: scan.status,
      progress: scan.total ? Math.round((scan.processed / scan.total) * 100) : null,
      createdAt: scan.createdAt.toISOString(),
      finishedAt: scan.finishedAt?.toISOString() ?? null,
      failedReason: scan.status === 'failed' ? 'Scan failed. See scan logs.' : null,
    }));

    return {
      enabled: Boolean(this.scanQueue || this.mailQueue || this.recQueue),
      queues,
      recent,
    };
  }

  private async queueStats(name: string, queue?: Queue): Promise<AdminQueueStats | null> {
    if (!queue) return null;
    const counts = await queue.getJobCounts('wait', 'active', 'completed', 'failed', 'delayed', 'paused');
    const isPaused = await queue.isPaused();
    return {
      name,
      waiting: counts.wait ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0,
      paused: isPaused,
    };
  }
}
