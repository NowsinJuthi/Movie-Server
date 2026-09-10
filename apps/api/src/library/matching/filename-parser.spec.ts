import { detectLanguageHint, parseMediaFilename } from './filename-parser';

describe('filename-parser', () => {
  it('parses movie titles with years', () => {
    expect(parseMediaFilename('The Matrix (1999).mkv')).toMatchObject({
      kind: 'movie',
      title: 'The Matrix',
      year: 1999,
    });
    expect(parseMediaFilename('Nebula.Dawn.2021.1080p.BluRay.mkv')).toMatchObject({
      kind: 'movie',
      title: 'Nebula Dawn',
      year: 2021,
      resolutionHint: '1080p',
    });
    expect(parseMediaFilename('The Matrix (1999)/videofile.mkv')).toMatchObject({
      kind: 'movie',
      title: 'The Matrix',
      year: 1999,
    });
  });

  it('parses SxxEyy episode names and folders', () => {
    expect(parseMediaFilename('Harbor Nights - S01E02 - Low Tide.mkv')).toMatchObject({
      kind: 'episode',
      seriesTitle: 'Harbor Nights',
      seasonNumber: 1,
      episodeNumber: 2,
      episodeTitle: 'Low Tide',
    });
    expect(parseMediaFilename('Harbor.Nights.S01E02.1080p.mkv')).toMatchObject({
      kind: 'episode',
      seriesTitle: 'Harbor Nights',
      seasonNumber: 1,
      episodeNumber: 2,
      resolutionHint: '1080p',
    });
    expect(parseMediaFilename('Harbor Nights/Season 01/S01E02.mkv')).toMatchObject({
      kind: 'episode',
      seriesTitle: 'Harbor Nights',
      seasonNumber: 1,
      episodeNumber: 2,
    });
  });

  it('detects English, Bangla, and Hindi language tokens', () => {
    expect(detectLanguageHint('Stream Dual (2024).bn.srt')).toBe('bn');
    expect(detectLanguageHint('Stream Dual (2024).hi.m4a')).toBe('hi');
    expect(detectLanguageHint('Harbor Nights - S01E01.en.vtt')).toBe('en');
    expect(parseMediaFilename('Stream Dual (2024).bn.srt')).toMatchObject({
      kind: 'movie',
      title: 'Stream Dual',
      year: 2024,
    });
  });
});
