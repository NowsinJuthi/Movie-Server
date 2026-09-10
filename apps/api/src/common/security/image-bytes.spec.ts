import { sniffImageMime } from './image-bytes';

describe('sniffImageMime', () => {
  it('detects PNG magic bytes and rejects spoofed JPEG types', () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    expect(sniffImageMime(png)).toBe('image/png');
    expect(sniffImageMime(Buffer.from('not-an-image'))).toBeNull();
    expect(sniffImageMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
  });
});
