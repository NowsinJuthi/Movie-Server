import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    // Use Express `req.ip` so `trust proxy` hop-count is honored. Reading
    // X-Forwarded-For here would let clients spoof a new tracker per request.
    return String(req.ip ?? 'anonymous');
  }
}
