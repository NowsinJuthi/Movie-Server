import { PLAYBACK_CLIENT_HEADER, PLAYBACK_CLIENT_VALUE } from '@movie-server/shared';
import type { Test } from 'supertest';

/** Mimics AmarPin web player fetch metadata for stream route e2e tests. */
export function asPlaybackClient<T extends Test>(req: T): T {
  return req
    .set(PLAYBACK_CLIENT_HEADER, PLAYBACK_CLIENT_VALUE)
    .set('Sec-Fetch-Site', 'same-origin')
    .set('Sec-Fetch-Mode', 'cors')
    .set('Sec-Fetch-Dest', 'empty') as T;
}
