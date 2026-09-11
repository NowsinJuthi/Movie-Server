import { MovieCertification, MovieRatings, VideoResolution } from './movie';
import { MaturityLevel } from './profile';

export const HomeMediaKind = {
  Movie: 'movie',
  Series: 'series',
} as const;

export type HomeMediaKind = (typeof HomeMediaKind)[keyof typeof HomeMediaKind];
export const HOME_MEDIA_KINDS = [HomeMediaKind.Movie, HomeMediaKind.Series] as const;

export const HomeRowKind = {
  Continue: 'continue',
  MyList: 'mylist',
  Recommended: 'recommended',
  Featured: 'featured',
  Trending: 'trending',
  PopularMovies: 'popular_movies',
  PopularSeries: 'popular_series',
  RecentlyAdded: 'recently_added',
  NewReleases: 'new_releases',
  Genre: 'genre',
  Collection: 'collection',
  BecauseYouWatched: 'because_you_watched',
  RecentlyWatched: 'recently_watched',
  Favorites: 'favorites',
  Manual: 'manual',
} as const;

export type HomeRowKind = (typeof HomeRowKind)[keyof typeof HomeRowKind];
export const HOME_ROW_KINDS = [
  HomeRowKind.Continue,
  HomeRowKind.MyList,
  HomeRowKind.Recommended,
  HomeRowKind.Featured,
  HomeRowKind.Trending,
  HomeRowKind.PopularMovies,
  HomeRowKind.PopularSeries,
  HomeRowKind.RecentlyAdded,
  HomeRowKind.NewReleases,
  HomeRowKind.Genre,
  HomeRowKind.Collection,
  HomeRowKind.BecauseYouWatched,
  HomeRowKind.RecentlyWatched,
  HomeRowKind.Favorites,
  HomeRowKind.Manual,
] as const;

export const HomeRowSource = {
  Personalized: 'personalized',
  Admin: 'admin',
  Catalog: 'catalog',
} as const;

export type HomeRowSource = (typeof HomeRowSource)[keyof typeof HomeRowSource];

export type HomeCard = {
  id: string;
  kind: HomeMediaKind;
  title: string;
  year: number;
  description: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  maturityRating: MaturityLevel;
  certification: MovieCertification | null;
  genres: string[];
  ratings: MovieRatings;
  maxResolution: VideoResolution | null;
  playable: boolean;
  featured: boolean;
  trending: boolean;
  popular: boolean;
  badges: string[];
  href: string;
  watchHref: string | null;
  progressRatio: number | null;
  episodeLabel: string | null;
  inMyList: boolean;
};

export type HomeRow = {
  id: string;
  title: string;
  kind: HomeRowKind;
  source: HomeRowSource;
  items: HomeCard[];
};

export type HomeResponse = {
  hero: HomeCard | null;
  /** Home hero slider cards (max 6). `hero` is `slider[0]` when present. */
  slider: HomeCard[];
  rows: HomeRow[];
  myListIds: string[];
  favoriteIds: string[];
};
