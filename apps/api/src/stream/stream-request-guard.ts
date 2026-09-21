import { ForbiddenException } from '@nestjs/common';
import {
  ErrorCode,
  STREAM_DELIVERY_FORBIDDEN_MESSAGE,
  isStreamDeliveryAllowed,
  type StreamDeliveryPolicy,
} from '@movie-server/shared';
import { Request } from 'express';

export { isDownloadManagerUserAgent } from '@movie-server/shared';

/** Reject download managers and replay of copied stream URLs outside the web player. */
export function assertPlaybackClientRequest(req: Request, policy: StreamDeliveryPolicy): void {
  if (isStreamDeliveryAllowed(req.headers, policy)) {
    return;
  }

  throw new ForbiddenException({
    error: ErrorCode.Forbidden,
    message: STREAM_DELIVERY_FORBIDDEN_MESSAGE,
  });
}
