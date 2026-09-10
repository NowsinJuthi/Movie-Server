import { MOVIE_GENRES, type MovieGenre } from '@movie-server/shared';

const TMDB_GENRE_IDS: Record<number, MovieGenre> = {
  28: 'action',
  12: 'adventure',
  16: 'animation',
  35: 'comedy',
  80: 'crime',
  99: 'documentary',
  18: 'drama',
  10751: 'family',
  14: 'fantasy',
  36: 'history',
  27: 'horror',
  10402: 'music',
  9648: 'mystery',
  10749: 'romance',
  878: 'scifi',
  10770: 'drama',
  53: 'thriller',
  10752: 'war',
  37: 'western',
};

const NAME_ALIASES: Record<string, MovieGenre> = {
  'science fiction': 'scifi',
  'sci-fi': 'scifi',
  'sci fi': 'scifi',
  'tv movie': 'drama',
};

export function mapTmdbGenres(input: Array<{ id?: number; name?: string }> | undefined): MovieGenre[] {
  const mapped: MovieGenre[] = [];
  for (const genre of input ?? []) {
    const byId = typeof genre.id === 'number' ? TMDB_GENRE_IDS[genre.id] : undefined;
    const byName = genre.name ? NAME_ALIASES[genre.name.trim().toLowerCase()] : undefined;
    const normalized = genre.name?.trim().toLowerCase().replace(/[^a-z]/g, '') as MovieGenre | undefined;
    const next =
      byId ??
      byName ??
      (normalized && (MOVIE_GENRES as readonly string[]).includes(normalized) ? normalized : undefined);
    if (next && !mapped.includes(next)) {
      mapped.push(next);
    }
  }
  return mapped.slice(0, 12);
}
