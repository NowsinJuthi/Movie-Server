import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { RECOMMENDATION_QUEUE } from '../common/cache-keys';
import { RecommendationsService } from './recommendations.service';

@Processor(RECOMMENDATION_QUEUE)
export class RecommendationProcessor extends WorkerHost {
  private readonly logger = new Logger(RecommendationProcessor.name);

  constructor(private readonly recommendations: RecommendationsService) {
    super();
  }

  async process(job: Job<{ userId: string; profileId: string }>): Promise<void> {
    try {
      await this.recommendations.refresh(job.data.userId, job.data.profileId);
    } catch (error) {
      this.logger.warn(`Recommendation refresh failed for profile ${job.data.profileId}: ${String(error)}`);
      throw error;
    }
  }
}
