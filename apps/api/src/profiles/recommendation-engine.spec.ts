import {
  excludeIds,
  fallbackKnownIds,
  genreAffinity,
  rankRecommendations,
  seedWeight,
  topGenres,
} from './recommendation-engine';
import { RecommendationReason } from '@movie-server/shared';

describe('recommendation-engine', () => {
  const signals = {
    history: [
      {
        mediaId: 'watched-1',
        completed: true,
        lastWatchedAt: new Date(),
        progressSeconds: 100,
        durationSeconds: 100,
      },
    ],
    myListIds: ['list-1'],
    favoriteIds: ['fav-1'],
    likes: ['like-1'],
    dislikes: ['nope-1'],
    ratings: [{ mediaId: 'rated-1', rating: 5 }],
  };

  it('weights favorites and high ratings above a plain list add', () => {
    expect(seedWeight({ favorite: true })).toBeGreaterThan(seedWeight({ listed: true }));
    expect(seedWeight({ rating: 5 })).toBeGreaterThan(seedWeight({ rating: 4 }));
  });

  it('builds genre affinity from weighted seeds', () => {
    const affinity = genreAffinity([
      { mediaId: 'a', genres: ['scifi', 'drama'], cast: [], directors: [], weight: 10, reason: RecommendationReason.Favorite },
      { mediaId: 'b', genres: ['scifi'], cast: [], directors: [], weight: 2, reason: RecommendationReason.Watched },
    ]);
    expect(topGenres(affinity, 1)).toEqual(['scifi']);
    expect(affinity.get('scifi')).toBe(12);
  });

  it('excludes completed and disliked titles from discovery', () => {
    const blocked = excludeIds(signals);
    expect(blocked.has('watched-1')).toBe(true);
    expect(blocked.has('nope-1')).toBe(true);
    expect(blocked.has('fav-1')).toBe(false);
  });

  it('ranks similar catalog titles instead of only re-ranking history', () => {
    const ranked = rankRecommendations(
      [
        {
          mediaId: 'candidate-scifi',
          genres: ['scifi'],
          cast: ['rina sol'],
          directors: ['ada vega'],
          popular: true,
          imdb: 8,
        },
        {
          mediaId: 'nope-1',
          genres: ['scifi'],
          cast: [],
          directors: [],
        },
      ],
      [
        {
          mediaId: 'watched-1',
          genres: ['scifi'],
          cast: ['rina sol'],
          directors: ['ada vega'],
          weight: 10,
          reason: RecommendationReason.Watched,
        },
      ],
      signals,
    );
    expect(ranked[0].mediaId).toBe('candidate-scifi');
    expect(ranked.some((item) => item.mediaId === 'nope-1')).toBe(false);
    expect(ranked.some((item) => item.mediaId === 'watched-1')).toBe(false);
  });

  it('falls back to known profile titles when the catalog is empty', () => {
    const ranked = fallbackKnownIds(signals);
    const ids = ranked.map((item) => item.mediaId);
    expect(ids).toEqual(expect.arrayContaining(['watched-1', 'fav-1', 'list-1', 'like-1', 'rated-1']));
    expect(ids).not.toContain('nope-1');
  });
});
