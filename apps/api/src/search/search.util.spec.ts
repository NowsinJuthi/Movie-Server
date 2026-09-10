import {
  matchingGenres,
  personMatchScore,
  relevanceScore,
  shouldUseTextSearch,
  similarContentScore,
  titleMatchScore,
  toTextSearch,
  yearRangeFilter,
} from './search.util';
import { normalizeSearchText } from '../common/search-fields';

describe('search.util', () => {
  it('normalizes text search and strips Mongo text operators', () => {
    expect(toTextSearch('  "Nebula"-Dawn  ')).toBe('nebula dawn');
    expect(shouldUseTextSearch('ne')).toBe(false);
    expect(shouldUseTextSearch('neb')).toBe(true);
  });

  it('matches genres by prefix without scanning descriptions', () => {
    expect(matchingGenres('sci')).toContain('scifi');
    expect(matchingGenres('drama')).toEqual(['drama']);
    expect(matchingGenres('zzz')).toEqual([]);
  });

  it('scores exact titles above prefix and person matches', () => {
    expect(titleMatchScore('nebula dawn', 'Nebula Dawn')).toBe(100);
    expect(titleMatchScore('nebula dawn', 'neb')).toBe(80);
    expect(personMatchScore(['rina sol'], 'rina')).toBe(70);
    expect(
      relevanceScore({
        titleNormalized: 'nebula dawn',
        originalTitleNormalized: 'amanecer de nebula',
        peopleNormalized: ['rina sol'],
        genres: ['scifi'],
        tags: ['space'],
        query: 'nebula dawn',
      }),
    ).toBe(100);
  });

  it('builds year range filters on indexed year fields', () => {
    expect(yearRangeFilter('releaseYear', 2021)).toEqual({ releaseYear: 2021 });
    expect(yearRangeFilter('firstAirYear', undefined, 2020, 2022)).toEqual({
      firstAirYear: { $gte: 2020, $lte: 2022 },
    });
  });

  it('scores similar titles by genre, cast, and director overlap', () => {
    const score = similarContentScore({
      sourceGenres: ['scifi', 'drama'],
      sourceCast: ['rina sol'],
      sourceDirectors: ['ada vega'],
      candidateGenres: ['scifi', 'adventure'],
      candidateCast: ['rina sol', 'other'],
      candidateDirectors: ['ada vega'],
      popular: true,
      trending: false,
      imdb: 8,
    });
    expect(score).toBe(5 + 3 + 4 + 2 + 8);
  });

  it('keeps search text lowercase for index-friendly prefixes', () => {
    expect(normalizeSearchText('  AmaneCer   de  Nebula ')).toBe('amanecer de nebula');
  });
});
