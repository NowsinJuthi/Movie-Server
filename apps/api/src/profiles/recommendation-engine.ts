import {
  RecommendationReason,
  RecommendationStrategy,
} from '@movie-server/shared';
import { similarContentScore } from '../search/search.util';

export type TasteSeed = {
  mediaId: string;
  genres: string[];
  cast: string[];
  directors: string[];
  weight: number;
  reason: RecommendationReason;
};

export type CatalogCandidate = {
  mediaId: string;
  genres: string[];
  cast: string[];
  directors: string[];
  popular?: boolean;
  trending?: boolean;
  featured?: boolean;
  imdb?: number | null;
};

export type ScoredRecommendation = {
  mediaId: string;
  score: number;
  reason: RecommendationReason;
  strategy: string;
  sourceMediaId: string | null;
};

export type RecommendationSignals = {
  history: Array<{ mediaId: string; completed: boolean; lastWatchedAt: Date; progressSeconds: number; durationSeconds: number }>;
  myListIds: string[];
  favoriteIds: string[];
  likes: string[];
  dislikes: string[];
  ratings: Array<{ mediaId: string; rating: number }>;
};

export function seedWeight(input: {
  favorite?: boolean;
  liked?: boolean;
  rating?: number;
  listed?: boolean;
  completed?: boolean;
  recency?: number;
}): number {
  let weight = 1;
  if (input.favorite) weight += 8;
  if (input.liked) weight += 6;
  if (input.rating && input.rating >= 4) weight += input.rating >= 5 ? 7 : 4;
  if (input.listed) weight += 3;
  if (input.completed) weight += 4;
  if (input.recency) weight += input.recency * 3;
  return weight;
}

export function genreAffinity(seeds: TasteSeed[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const seed of seeds) {
    for (const genre of seed.genres) {
      counts.set(genre, (counts.get(genre) ?? 0) + seed.weight);
    }
  }
  return counts;
}

export function topGenres(affinity: Map<string, number>, limit = 4): string[] {
  return [...affinity.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([genre]) => genre);
}

export function excludeIds(signals: RecommendationSignals): Set<string> {
  const out = new Set<string>(signals.dislikes);
  for (const item of signals.history) {
    if (item.completed) {
      out.add(item.mediaId);
    }
  }
  return out;
}

export function scoreCatalogCandidate(
  candidate: CatalogCandidate,
  seeds: TasteSeed[],
  affinity: Map<string, number>,
): ScoredRecommendation | null {
  if (seeds.length === 0) {
    const popularity = (candidate.popular ? 4 : 0) + (candidate.trending ? 3 : 0) + (candidate.featured ? 2 : 0) + (candidate.imdb ?? 0);
    return {
      mediaId: candidate.mediaId,
      score: popularity,
      reason: RecommendationReason.Trending,
      strategy: RecommendationStrategy.Content,
      sourceMediaId: null,
    };
  }

  let bestSimilar = 0;
  let source: TasteSeed | null = null;
  for (const seed of seeds) {
    const similar =
      similarContentScore({
        sourceGenres: seed.genres,
        sourceCast: seed.cast,
        sourceDirectors: seed.directors,
        candidateGenres: candidate.genres,
        candidateCast: candidate.cast,
        candidateDirectors: candidate.directors,
        popular: candidate.popular,
        trending: candidate.trending,
        imdb: candidate.imdb,
      }) * (seed.weight / 8);
    if (similar > bestSimilar) {
      bestSimilar = similar;
      source = seed;
    }
  }

  const genreScore = candidate.genres.reduce((sum, genre) => sum + (affinity.get(genre) ?? 0), 0);
  const score = bestSimilar + genreScore * 0.6;
  if (score <= 0) {
    return null;
  }

  let reason: RecommendationReason = RecommendationReason.Similar;
  let strategy: string = RecommendationStrategy.Content;
  if (source?.reason === RecommendationReason.Favorite) {
    reason = RecommendationReason.Favorite;
    strategy = RecommendationStrategy.Favorite;
  } else if (source?.reason === RecommendationReason.Rated) {
    reason = RecommendationReason.Rated;
    strategy = RecommendationStrategy.History;
  } else if (genreScore > bestSimilar) {
    reason = RecommendationReason.Genre;
    strategy = RecommendationStrategy.GenreAffinity;
  } else if (source?.reason === RecommendationReason.Watched || source?.reason === RecommendationReason.Continue) {
    reason = RecommendationReason.Watched;
    strategy = RecommendationStrategy.History;
  }

  return {
    mediaId: candidate.mediaId,
    score,
    reason,
    strategy,
    sourceMediaId: source?.mediaId ?? null,
  };
}

export function fallbackKnownIds(signals: RecommendationSignals): ScoredRecommendation[] {
  const now = Date.now();
  const scores = new Map<string, ScoredRecommendation>();

  for (const item of signals.history) {
    const recency = Math.max(0, 1 - (now - item.lastWatchedAt.getTime()) / (30 * 86400000));
    const completion = item.completed
      ? 1
      : item.durationSeconds
        ? item.progressSeconds / item.durationSeconds
        : 0;
    const score = 4 + recency * 3 + completion * 2;
    scores.set(item.mediaId, {
      mediaId: item.mediaId,
      score,
      reason: item.completed ? RecommendationReason.Watched : RecommendationReason.Continue,
      strategy: RecommendationStrategy.History,
      sourceMediaId: null,
    });
  }

  for (const mediaId of signals.myListIds) {
    const previous = scores.get(mediaId);
    scores.set(mediaId, {
      mediaId,
      score: (previous?.score ?? 0) + 5,
      reason: previous?.reason ?? RecommendationReason.MyList,
      strategy: RecommendationStrategy.Content,
      sourceMediaId: null,
    });
  }

  for (const mediaId of signals.favoriteIds) {
    const previous = scores.get(mediaId);
    scores.set(mediaId, {
      mediaId,
      score: (previous?.score ?? 0) + 8,
      reason: RecommendationReason.Favorite,
      strategy: RecommendationStrategy.Favorite,
      sourceMediaId: null,
    });
  }

  for (const mediaId of signals.likes) {
    const previous = scores.get(mediaId);
    scores.set(mediaId, {
      mediaId,
      score: (previous?.score ?? 0) + 6,
      reason: previous?.reason ?? RecommendationReason.Rated,
      strategy: RecommendationStrategy.History,
      sourceMediaId: null,
    });
  }

  for (const item of signals.ratings) {
    if (item.rating < 4) continue;
    const previous = scores.get(item.mediaId);
    scores.set(item.mediaId, {
      mediaId: item.mediaId,
      score: (previous?.score ?? 0) + item.rating,
      reason: RecommendationReason.Rated,
      strategy: RecommendationStrategy.History,
      sourceMediaId: null,
    });
  }

  for (const mediaId of signals.dislikes) {
    scores.delete(mediaId);
  }

  return [...scores.values()].sort((a, b) => b.score - a.score).slice(0, 20);
}

export function rankRecommendations(
  candidates: CatalogCandidate[],
  seeds: TasteSeed[],
  signals: RecommendationSignals,
  limit = 20,
): ScoredRecommendation[] {
  const blocked = excludeIds(signals);
  const affinity = genreAffinity(seeds);
  const scored: ScoredRecommendation[] = [];
  for (const candidate of candidates) {
    if (blocked.has(candidate.mediaId)) continue;
    if (seeds.some((seed) => seed.mediaId === candidate.mediaId)) continue;
    const item = scoreCatalogCandidate(candidate, seeds, affinity);
    if (item) scored.push(item);
  }
  scored.sort((a, b) => b.score - a.score);
  if (scored.length > 0) {
    return scored.slice(0, limit);
  }
  const known = fallbackKnownIds(signals).filter(
    (item) =>
      !blocked.has(item.mediaId) ||
      signals.myListIds.includes(item.mediaId) ||
      signals.favoriteIds.includes(item.mediaId),
  );
  return known.slice(0, limit);
}
