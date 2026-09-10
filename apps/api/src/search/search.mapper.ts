import { MATURITY_RANK, MaturityLevel, type HomeCard } from '@movie-server/shared';
import type { MovieDocument } from '../movies/schemas/movie.schema';
import type { SeriesDocument } from '../series/schemas/series.schema';
import type { EpisodeDocument } from '../series/schemas/episode.schema';
import { toPublicMovie } from '../movies/movie.mapper';
import { toPublicSeries } from '../series/series.mapper';
import { movieToHomeCard, seriesToHomeCard } from '../home/home-card.util';
import { artworkPublicPath } from '../movies/movie.util';
import type { MediaAssetDocument } from '../movies/schemas/media-asset.schema';
import type { SearchEpisodeHit, SearchPersonHit, SearchSuggestItem } from '@movie-server/shared';
import { normalizeSearchText } from '../common/search-fields';
import { personMatchScore, relevanceScore } from './search.util';
import type { SubscriptionEntitlement } from '@movie-server/shared';

export function movieDocsToCards(
  movies: MovieDocument[],
  assets: Map<string, MediaAssetDocument[]>,
  myList: Set<string>,
  entitlement?: SubscriptionEntitlement | null,
): HomeCard[] {
  return movies.map((movie) =>
    movieToHomeCard(
      toPublicMovie(movie, {
        entitlement,
        assets: assets.get(String(movie._id)) ?? [],
      }),
      myList,
    ),
  );
}

export function seriesDocsToCards(series: SeriesDocument[], myList: Set<string>): HomeCard[] {
  return series.map((item) => seriesToHomeCard(toPublicSeries(item), myList));
}

export function episodeToHit(
  episode: EpisodeDocument,
  series: SeriesDocument,
  score = 0,
): SearchEpisodeHit {
  const poster = series.posterKey ? artworkPublicPath(series.posterKey) : (series.posterUrl ?? null);
  const playable = episode.published && series.published;
  return {
    kind: 'episode',
    id: String(episode._id),
    seriesId: String(series._id),
    seasonId: String(episode.seasonId),
    title: episode.title,
    seriesTitle: series.title,
    seasonNumber: episode.seasonNumber,
    episodeNumber: episode.episodeNumber,
    year: series.firstAirYear,
    description: episode.description,
    posterUrl: poster,
    href: `/app/series/${String(series._id)}`,
    watchHref: playable ? `/app/series/${String(series._id)}/watch/${String(episode._id)}` : `/app/series/${String(series._id)}`,
    score,
  };
}

export function collectPeople(
  query: string,
  movies: MovieDocument[],
  series: SeriesDocument[],
  limit = 8,
): SearchPersonHit[] {
  const needle = normalizeSearchText(query);
  const map = new Map<string, SearchPersonHit>();

  const add = (
    name: string,
    role: SearchPersonHit['roles'][number],
    title: { id: string; kind: 'movie' | 'series'; title: string; href: string },
  ) => {
    if (personMatchScore([normalizeSearchText(name)], needle) <= 0) {
      return;
    }
    const key = normalizeSearchText(name);
    const current = map.get(key) ?? { name, roles: [], titles: [] };
    if (!current.roles.includes(role)) {
      current.roles.push(role);
    }
    if (!current.titles.some((item) => item.id === title.id && item.kind === title.kind)) {
      current.titles.push(title);
    }
    map.set(key, current);
  };

  for (const movie of movies) {
    const title = {
      id: String(movie._id),
      kind: 'movie' as const,
      title: movie.title,
      href: `/app/movies/${String(movie._id)}`,
    };
    for (const member of movie.cast ?? []) add(member.name, 'actor', title);
    for (const name of movie.directors ?? []) add(name, 'director', title);
    for (const name of movie.writers ?? []) add(name, 'writer', title);
  }
  for (const show of series) {
    const title = {
      id: String(show._id),
      kind: 'series' as const,
      title: show.title,
      href: `/app/series/${String(show._id)}`,
    };
    for (const member of show.cast ?? []) add(member.name, 'actor', title);
    for (const name of show.directors ?? []) add(name, 'director', title);
  }

  return [...map.values()]
    .sort((a, b) => b.titles.length - a.titles.length)
    .slice(0, limit)
    .map((item) => ({ ...item, titles: item.titles.slice(0, 4) }));
}

export function titleSuggestItems(
  movies: MovieDocument[],
  series: SeriesDocument[],
): SearchSuggestItem[] {
  return [
    ...movies.map((movie) => ({
      kind: 'title' as const,
      label: movie.title,
      query: movie.title,
      id: String(movie._id),
      mediaKind: 'movie' as const,
      href: `/app/movies/${String(movie._id)}`,
    })),
    ...series.map((item) => ({
      kind: 'title' as const,
      label: item.title,
      query: item.title,
      id: String(item._id),
      mediaKind: 'series' as const,
      href: `/app/series/${String(item._id)}`,
    })),
  ];
}

export function scoreMediaDoc(
  doc: {
    titleNormalized?: string | null;
    originalTitleNormalized?: string | null;
    peopleNormalized?: string[];
    genres?: string[];
    tags?: string[];
  },
  query: string,
  textScore?: number,
): number {
  return relevanceScore({
    titleNormalized: doc.titleNormalized,
    originalTitleNormalized: doc.originalTitleNormalized,
    peopleNormalized: doc.peopleNormalized,
    genres: doc.genres,
    tags: doc.tags,
    query,
    textScore,
  });
}

export function allowedMaturity(maturity: MaturityLevel, isKids: boolean): MaturityLevel[] {
  const cap = isKids ? MaturityLevel.Kids : maturity;
  return (Object.keys(MATURITY_RANK) as MaturityLevel[]).filter(
    (level) => MATURITY_RANK[level] <= MATURITY_RANK[cap],
  );
}
