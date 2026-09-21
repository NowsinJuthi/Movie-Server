import { ForbiddenException } from '@nestjs/common';
import { PLAYBACK_CLIENT_HEADER, PLAYBACK_CLIENT_VALUE } from '@movie-server/shared';
import { assertPlaybackClientRequest, isDownloadManagerUserAgent } from './stream-request-guard';

const devPolicy = { requireStreamProxy: false };

function mockReq(headers: Record<string, string>) {
  return { headers } as unknown as import('express').Request;
}

describe('stream-request-guard', () => {
  it('detects common download tools', () => {
    expect(isDownloadManagerUserAgent('Internet Download Manager 6.41')).toBe(true);
    expect(isDownloadManagerUserAgent('Mozilla/5.0 Chrome/120')).toBe(false);
  });

  it('allows hls.js with playback client header in non-production policy', () => {
    expect(() =>
      assertPlaybackClientRequest(
        mockReq({
          'user-agent': 'Mozilla/5.0',
          [PLAYBACK_CLIENT_HEADER.toLowerCase()]: PLAYBACK_CLIENT_VALUE,
          'sec-fetch-site': 'same-origin',
          'sec-fetch-mode': 'cors',
          'sec-fetch-dest': 'empty',
        }),
        devPolicy,
      ),
    ).not.toThrow();
  });

  it('allows internal stream proxy secret in production policy', () => {
    expect(() =>
      assertPlaybackClientRequest(
        mockReq({
          'user-agent': 'node',
          'x-amarpin-stream-proxy': 'test-secret',
        }),
        { requireStreamProxy: true, streamProxySecret: 'test-secret' },
      ),
    ).not.toThrow();
  });

  it('blocks IDM user agents', () => {
    expect(() =>
      assertPlaybackClientRequest(
        mockReq({
          'user-agent': 'Internet Download Manager',
        }),
        devPolicy,
      ),
    ).toThrow(ForbiddenException);
  });

  it('blocks bare copied URLs without browser or client headers', () => {
    expect(() =>
      assertPlaybackClientRequest(
        mockReq({
          'user-agent': 'Mozilla/5.0',
        }),
        devPolicy,
      ),
    ).toThrow(ForbiddenException);
  });

  it('blocks forged video element metadata without playback client', () => {
    expect(() =>
      assertPlaybackClientRequest(
        mockReq({
          'user-agent': 'Mozilla/5.0',
          'sec-fetch-site': 'same-origin',
          'sec-fetch-dest': 'video',
          'sec-fetch-mode': 'no-cors',
        }),
        devPolicy,
      ),
    ).toThrow(ForbiddenException);
  });

  it('blocks playback client header without fetch metadata (IDM replay)', () => {
    expect(() =>
      assertPlaybackClientRequest(
        mockReq({
          'user-agent': 'Mozilla/5.0',
          [PLAYBACK_CLIENT_HEADER.toLowerCase()]: PLAYBACK_CLIENT_VALUE,
          'sec-fetch-site': 'same-origin',
        }),
        devPolicy,
      ),
    ).toThrow(ForbiddenException);
  });

  it('blocks direct API host when configured', () => {
    expect(() =>
      assertPlaybackClientRequest(
        mockReq({
          host: 'movies.api.example.com',
          'user-agent': 'Mozilla/5.0',
          [PLAYBACK_CLIENT_HEADER.toLowerCase()]: PLAYBACK_CLIENT_VALUE,
          'sec-fetch-site': 'same-origin',
          'sec-fetch-mode': 'cors',
          'sec-fetch-dest': 'empty',
        }),
        { ...devPolicy, blockPublicApiHost: 'movies.api.example.com' },
      ),
    ).toThrow(ForbiddenException);
  });
});
