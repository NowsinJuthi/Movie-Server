import { ForbiddenException } from '@nestjs/common';
import { ErrorCode, PLAYBACK_CLIENT_HEADER, PLAYBACK_CLIENT_VALUE } from '@movie-server/shared';
import { Request } from 'express';

const DOWNLOAD_TOOL_UA =
  /internet download manager|\bidm\b|fdm[\/.]|free download manager|wget\/|curl\/|libcurl|aria2|uget\/|motrix|jdownloader|nxstyle|ffmpeg|streamlink/i;

export function isDownloadManagerUserAgent(userAgent: string): boolean {
  return DOWNLOAD_TOOL_UA.test(userAgent);
}

/** Reject download managers and replay of copied stream URLs outside the web player. */
export function assertPlaybackClientRequest(req: Request): void {
  const ua = String(req.headers['user-agent'] ?? '');
  if (isDownloadManagerUserAgent(ua)) {
    throw new ForbiddenException({
      error: ErrorCode.Forbidden,
      message: 'Playback is only available in the AmarPin player.',
    });
  }

  const client = String(req.headers[PLAYBACK_CLIENT_HEADER.toLowerCase()] ?? '');
  const site = String(req.headers['sec-fetch-site'] ?? '');
  const dest = String(req.headers['sec-fetch-dest'] ?? '');
  const mode = String(req.headers['sec-fetch-mode'] ?? '');

  if (client === PLAYBACK_CLIENT_VALUE && (site === 'same-origin' || site === 'same-site')) {
    return;
  }

  if (dest === 'video' && (site === 'same-origin' || site === 'same-site')) {
    return;
  }

  if (mode === 'cors' && site === 'same-origin' && dest === 'empty' && client === PLAYBACK_CLIENT_VALUE) {
    return;
  }

  if (!site && !dest && !mode && client === PLAYBACK_CLIENT_VALUE) {
    return;
  }

  throw new ForbiddenException({
    error: ErrorCode.Forbidden,
    message: 'Playback is only available in the AmarPin player.',
  });
}
