import {
  HomeMediaKind,
  HomeRowKind,
  HomeRowSource,
  MovieAvailability,
  type HomeCard,
  type HomeRow,
  type MovieContinueItem,
  type PublicMovie,
  type PublicSeries,
  type SeriesContinueItem,
  type VideoResolution,
} from '@movie-server/shared';

const CURRENT_YEAR = new Date().getFullYear();

export function genreDisplayName(genre: string): string {
  if (genre === 'scifi') {
    return 'Sci-Fi';
  }
  return genre.charAt(0).toUpperCase() + genre.slice(1);
}

export function movieToHomeCard(movie: PublicMovie, myList: Set<string>, extras?: Partial<HomeCard>): HomeCard {
  return {
    id: movie.id,
    kind: HomeMediaKind.Movie,
    title: movie.title,
    year: movie.releaseYear,
    description: movie.description,
    posterUrl: movie.posterUrl,
    backdropUrl: movie.backdropUrl,
    maturityRating: movie.maturityRating,
    certification: movie.certification,
    genres: movie.genres,
    ratings: movie.ratings,
    maxResolution: movie.maxResolution,
    playable: movie.playable,
    featured: movie.featured,
    trending: movie.trending,
    popular: movie.popular,
    badges: movieBadges(movie),
    href: `/home/movies/${movie.id}`,
    watchHref: `/home/movies/${movie.id}/watch`,
    progressRatio: progressRatio(movie.progressSeconds, movie.durationSeconds),
    episodeLabel: null,
    inMyList: myList.has(movie.id),
    ...extras,
  };
}

export function seriesToHomeCard(
  series: PublicSeries,
  myList: Set<string>,
  extras?: Partial<HomeCard>,
): HomeCard {
  const playable = series.availability === MovieAvailability.Available;
  return {
    id: series.id,
    kind: HomeMediaKind.Series,
    title: series.title,
    year: series.firstAirYear,
    description: series.description,
    posterUrl: series.posterUrl,
    backdropUrl: series.backdropUrl,
    maturityRating: series.maturityRating,
    certification: series.certification,
    genres: series.genres,
    ratings: series.ratings,
    maxResolution: null,
    playable,
    featured: series.featured,
    trending: series.trending,
    popular: series.popular,
    badges: seriesBadges(series),
    href: `/home/series/${series.id}`,
    watchHref: `/home/series/${series.id}`,
    progressRatio: null,
    episodeLabel: null,
    inMyList: myList.has(series.id),
    ...extras,
  };
}

export function movieContinueToCard(item: MovieContinueItem, myList: Set<string>): HomeCard {
  const ratio = progressRatio(item.progress.progressSeconds, item.progress.durationSeconds);
  return movieToHomeCard(item.movie, myList, {
    progressRatio: ratio,
    watchHref: `/home/movies/${item.movie.id}/watch`,
  });
}

export function seriesContinueToCard(item: SeriesContinueItem, myList: Set<string>): HomeCard {
  const ratio = progressRatio(item.progress.progressSeconds, item.progress.durationSeconds);
  return seriesToHomeCard(item.series, myList, {
    progressRatio: ratio,
    episodeLabel: `S${item.episode.seasonNumber}:E${item.episode.episodeNumber} ${item.episode.title}`,
    watchHref: `/home/series/${item.series.id}/watch/${item.episode.id}`,
    backdropUrl: item.series.backdropUrl ?? item.series.posterUrl,
  });
}

export function homeRow(
  id: string,
  title: string,
  kind: HomeRowKind,
  source: HomeRowSource,
  items: HomeCard[],
  limit = 18,
): HomeRow | null {
  const unique = dedupeCards(items).slice(0, limit);
  if (unique.length === 0) {
    return null;
  }
  return { id, title, kind, source, items: unique };
}

export function dedupeCards(items: HomeCard[]): HomeCard[] {
  const seen = new Set<string>();
  const out: HomeCard[] = [];
  for (const item of items) {
    const key = `${item.kind}:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function movieBadges(movie: PublicMovie): string[] {
  const badges: string[] = [];
  if (movie.releaseYear >= CURRENT_YEAR) badges.push('New');
  if (movie.maxResolution === ('4k' as VideoResolution)) badges.push('4K');
  if (movie.maturityRating) badges.push(movie.certification ?? movie.maturityRating);
  return badges;
}

function seriesBadges(series: PublicSeries): string[] {
  const badges: string[] = [];
  if (series.firstAirYear >= CURRENT_YEAR) badges.push('New');
  badges.push('Series');
  if (series.maturityRating) badges.push(series.certification ?? series.maturityRating);
  return badges;
}

function progressRatio(progress?: number | null, duration?: number | null): number | null {
  if (!progress || !duration || duration <= 0) {
    return null;
  }
  return Math.min(1, Math.max(0, progress / duration));
}
