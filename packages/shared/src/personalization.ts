import { HomeCard } from './home';

export const PersonalizationMediaKind = {
  Movie: 'movie',
  Series: 'series',
} as const;

export type PersonalizationMediaKind =
  (typeof PersonalizationMediaKind)[keyof typeof PersonalizationMediaKind];
export const PERSONALIZATION_MEDIA_KINDS = [
  PersonalizationMediaKind.Movie,
  PersonalizationMediaKind.Series,
] as const;

export const MediaReaction = {
  Like: 'like',
  Dislike: 'dislike',
} as const;

export type MediaReaction = (typeof MediaReaction)[keyof typeof MediaReaction];
export const MEDIA_REACTIONS = [MediaReaction.Like, MediaReaction.Dislike] as const;

export const USER_RATING_MIN = 1;
export const USER_RATING_MAX = 5;

export const RecommendationStrategy = {
  Content: 'content',
  GenreAffinity: 'genre_affinity',
  Favorite: 'favorite',
  History: 'history',
  Collaborative: 'collaborative',
  Ai: 'ai',
} as const;

export type RecommendationStrategy =
  (typeof RecommendationStrategy)[keyof typeof RecommendationStrategy];

export type FavoriteItem = {
  id: string;
  profileId: string;
  mediaId: string;
  kind: PersonalizationMediaKind;
  addedAt: string;
};

export type MediaReactionItem = {
  id: string;
  profileId: string;
  mediaId: string;
  kind: PersonalizationMediaKind;
  reaction: MediaReaction;
  updatedAt: string;
};

export type UserRatingItem = {
  id: string;
  profileId: string;
  mediaId: string;
  kind: PersonalizationMediaKind;
  rating: number;
  updatedAt: string;
};

export type WatchHistoryEntry = {
  id: string;
  profileId: string;
  mediaId: string;
  progressSeconds: number;
  durationSeconds: number;
  completed: boolean;
  lastWatchedAt: string;
  title: string | null;
  kind: 'movie' | 'series' | 'episode' | 'unknown';
  href: string | null;
  posterUrl: string | null;
  year: number | null;
};

export type PersonalizationState = {
  favorites: FavoriteItem[];
  reactions: MediaReactionItem[];
  ratings: UserRatingItem[];
  myListIds: string[];
  favoriteIds: string[];
};

export type LibraryTitleCard = {
  mediaId: string;
  title: string | null;
  kind: 'movie' | 'series' | 'episode' | 'unknown';
  href: string | null;
  posterUrl: string | null;
  year: number | null;
};

export type HydratedLibraryResponse = {
  items: HomeCard[];
};
