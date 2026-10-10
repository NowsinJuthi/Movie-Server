import type { Test } from 'supertest';

/** Stream routes no longer require custom client headers. */
export function asPlaybackClient<T extends Test>(req: T): T {
  return req;
}
