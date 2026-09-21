import { ForbiddenException } from '@nestjs/common';
import { PLAYBACK_CLIENT_HEADER, PLAYBACK_CLIENT_VALUE } from '@movie-server/shared';
import { assertPlaybackClientRequest, isDownloadManagerUserAgent } from './stream-request-guard';

function mockReq(headers: Record<string, string>) {
  return { headers } as unknown as import('express').Request;
}

describe('stream-request-guard', () => {
  it('detects common download tools', () => {
    expect(isDownloadManagerUserAgent('Internet Download Manager 6.41')).toBe(true);
    expect(isDownloadManagerUserAgent('Mozilla/5.0 Chrome/120')).toBe(false);
  });

  it('allows browser video element requests', () => {
    expect(() =>
      assertPlaybackClientRequest(
        mockReq({
          'user-agent': 'Mozilla/5.0',
          'sec-fetch-site': 'same-origin',
          'sec-fetch-dest': 'video',
          'sec-fetch-mode': 'no-cors',
        }),
      ),
    ).not.toThrow();
  });

  it('allows hls.js with playback client header', () => {
    expect(() =>
      assertPlaybackClientRequest(
        mockReq({
          'user-agent': 'Mozilla/5.0',
          [PLAYBACK_CLIENT_HEADER.toLowerCase()]: PLAYBACK_CLIENT_VALUE,
          'sec-fetch-site': 'same-origin',
          'sec-fetch-mode': 'cors',
          'sec-fetch-dest': 'empty',
        }),
      ),
    ).not.toThrow();
  });

  it('blocks IDM user agents', () => {
    expect(() =>
      assertPlaybackClientRequest(
        mockReq({
          'user-agent': 'Internet Download Manager',
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('blocks bare copied URLs without browser or client headers', () => {
    expect(() =>
      assertPlaybackClientRequest(
        mockReq({
          'user-agent': 'Mozilla/5.0',
        }),
      ),
    ).toThrow(ForbiddenException);
  });
});
