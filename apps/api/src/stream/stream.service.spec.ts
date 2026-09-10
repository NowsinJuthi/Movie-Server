import { mimeFromName, parseByteRange } from './stream.service';

describe('stream range and mime helpers', () => {
  it('parses inclusive byte ranges', () => {
    expect(parseByteRange('bytes=0-99', 1000)).toEqual({ start: 0, end: 99 });
    expect(parseByteRange('bytes=100-', 1000)).toEqual({ start: 100, end: 999 });
    expect(parseByteRange('bytes=-50', 1000)).toEqual({ start: 950, end: 999 });
  });

  it('rejects invalid ranges', () => {
    expect(parseByteRange(undefined, 1000)).toBeNull();
    expect(parseByteRange('bytes=500-100', 1000)).toBeNull();
    expect(parseByteRange('bytes=1000-1001', 1000)).toBeNull();
    expect(parseByteRange('items=0-1', 1000)).toBeNull();
  });

  it('maps common video extensions', () => {
    expect(mimeFromName('film.mp4')).toBe('video/mp4');
    expect(mimeFromName('film.webm')).toBe('video/webm');
    expect(mimeFromName('film.mkv')).toBe('video/x-matroska');
    expect(mimeFromName('film.ts')).toBe('video/mp2t');
    expect(mimeFromName('track.m4a')).toBe('audio/mp4');
    expect(mimeFromName('subs.vtt')).toBe('text/vtt');
    expect(mimeFromName('subs.srt')).toBe('application/x-subrip');
  });
});
