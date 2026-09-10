import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { LIBRARY_SCAN_QUEUE, LibraryScanService } from './library-scan.service';

@Processor(LIBRARY_SCAN_QUEUE)
export class LibraryScanProcessor extends WorkerHost {
  constructor(private readonly scans: LibraryScanService) {
    super();
  }

  async process(job: Job<{ scanId: string }>): Promise<void> {
    await this.scans.execute(job.data.scanId);
  }
}
