import { HomeRowKind, type HomeRowKind as HomeRowKindType } from './home';
import { MOVIE_GENRES, genreDisplayName } from './movie';

export type HomeRowPresetGroup = 'catalog' | 'advanced' | 'personalized' | 'library' | 'genre';

export type HomeRowPreset = {
  kind: HomeRowKindType;
  label: string;
  defaultTitle: string;
  description: string;
  group: HomeRowPresetGroup;
  /** Set for genre shelves — multiple genre rows can coexist on the homepage. */
  genre?: string;
};

/** Shelves that map to catalog / admin content on the public home page. */
export const HOME_CATALOG_ROW_PRESETS: HomeRowPreset[] = [
  {
    kind: HomeRowKind.Featured,
    label: 'Featured',
    defaultTitle: 'Featured',
    description: 'Movies and series marked as featured in the catalog.',
    group: 'catalog',
  },
  {
    kind: HomeRowKind.Trending,
    label: 'Trending',
    defaultTitle: 'Trending Now',
    description: 'Titles flagged as trending.',
    group: 'catalog',
  },
  {
    kind: HomeRowKind.PopularMovies,
    label: 'Popular movies',
    defaultTitle: 'Popular Movies',
    description: 'Most popular movies in your library.',
    group: 'catalog',
  },
  {
    kind: HomeRowKind.PopularSeries,
    label: 'Popular TV series',
    defaultTitle: 'Popular TV Series',
    description: 'Most popular series in your library.',
    group: 'catalog',
  },
  {
    kind: HomeRowKind.RecentlyAdded,
    label: 'Recently added',
    defaultTitle: 'Recently Added',
    description: 'Newest titles added to the catalog.',
    group: 'catalog',
  },
  {
    kind: HomeRowKind.NewReleases,
    label: 'New releases',
    defaultTitle: 'New Releases',
    description: 'Latest release-date titles.',
    group: 'catalog',
  },
];

/** Typical shelves shown on a fresh homepage (catalog + recommended + top genres). */
export const HOME_LAYOUT_ROW_PRESETS: HomeRowPreset[] = [
  HOME_CATALOG_ROW_PRESETS[0]!,
  HOME_CATALOG_ROW_PRESETS[1]!,
  {
    kind: HomeRowKind.Recommended,
    label: 'Recommended',
    defaultTitle: 'Recommended for You',
    description: 'Personalized recommendations for the active profile.',
    group: 'personalized',
  },
  HOME_CATALOG_ROW_PRESETS[4]!,
  HOME_CATALOG_ROW_PRESETS[5]!,
  ...(['action', 'drama', 'adventure', 'thriller'] as const).map(
    (genre): HomeRowPreset => ({
      kind: HomeRowKind.Genre,
      label: genreDisplayName(genre),
      defaultTitle: genreDisplayName(genre),
      description: `${genreDisplayName(genre)} movies and series.`,
      group: 'genre',
      genre,
    }),
  ),
];

const FEATURED_GENRES = new Set(['action', 'drama', 'adventure', 'thriller']);

export const HOME_GENRE_ROW_PRESETS: HomeRowPreset[] = HOME_LAYOUT_ROW_PRESETS.filter(
  (preset) => preset.group === 'genre',
);

export const HOME_MORE_GENRE_ROW_PRESETS: HomeRowPreset[] = MOVIE_GENRES.filter(
  (genre) => !FEATURED_GENRES.has(genre),
).map(
  (genre): HomeRowPreset => ({
    kind: HomeRowKind.Genre,
    label: genreDisplayName(genre),
    defaultTitle: genreDisplayName(genre),
    description: `${genreDisplayName(genre)} movies and series.`,
    group: 'genre',
    genre,
  }),
);

export const HOME_LIBRARY_ROW_PRESET: HomeRowPreset = {
  kind: HomeRowKind.Library,
  label: 'Media library',
  defaultTitle: 'Media library',
  description: 'Published titles from a scanned media library folder.',
  group: 'library',
};

export const HOME_ADVANCED_ROW_PRESETS: HomeRowPreset[] = [
  {
    kind: HomeRowKind.Collection,
    label: 'Collection',
    defaultTitle: 'Collection',
    description: 'A curated movie or series collection.',
    group: 'advanced',
  },
  {
    kind: HomeRowKind.Genre,
    label: 'Genre row',
    defaultTitle: 'Genre picks',
    description: 'Titles from a specific genre.',
    group: 'advanced',
  },
  {
    kind: HomeRowKind.Manual,
    label: 'Manual picks',
    defaultTitle: 'Staff picks',
    description: 'Hand-picked movie or series IDs.',
    group: 'advanced',
  },
];

/** Personalized rows admins can opt into via CMS (watch history rows stay automatic). */
export const HOME_PERSONALIZED_ROW_PRESETS: HomeRowPreset[] = [
  {
    kind: HomeRowKind.Continue,
    label: 'Continue watching',
    defaultTitle: 'Continue Watching',
    description: 'Shown when a profile has in-progress playback.',
    group: 'personalized',
  },
  {
    kind: HomeRowKind.MyList,
    label: 'My list',
    defaultTitle: 'My List',
    description: 'Saved titles for the active profile.',
    group: 'personalized',
  },
  {
    kind: HomeRowKind.Favorites,
    label: 'Favorites',
    defaultTitle: 'Favorites',
    description: 'Profile favorites shelf.',
    group: 'personalized',
  },
  HOME_LAYOUT_ROW_PRESETS[2]!,
];

/** Always injected when profile data exists — not managed as CMS shelves. */
export const HOME_AUTO_PERSONALIZED_ROW_PRESETS: HomeRowPreset[] = [
  {
    kind: HomeRowKind.RecentlyWatched,
    label: 'Recently watched',
    defaultTitle: 'Recently Watched',
    description: 'Injected automatically from profile watch history.',
    group: 'personalized',
  },
  {
    kind: HomeRowKind.BecauseYouWatched,
    label: 'Because you watched',
    defaultTitle: 'Because You Watched',
    description: 'Affinity shelf based on recent viewing.',
    group: 'personalized',
  },
];

const PRESET_BY_KIND = new Map<HomeRowKindType, HomeRowPreset>(
  [
    ...HOME_CATALOG_ROW_PRESETS,
    HOME_LIBRARY_ROW_PRESET,
    ...HOME_ADVANCED_ROW_PRESETS,
    ...HOME_PERSONALIZED_ROW_PRESETS,
    ...HOME_AUTO_PERSONALIZED_ROW_PRESETS,
  ].map((preset) => [preset.kind, preset]),
);

export function homeRowPresetKey(preset: HomeRowPreset): string {
  if (preset.kind === HomeRowKind.Genre && preset.genre) {
    return `genre:${preset.genre}`;
  }
  return preset.kind;
}

export function homeRowPreset(kind: HomeRowKindType): HomeRowPreset | undefined {
  return PRESET_BY_KIND.get(kind);
}

export function homeRowKindLabel(kind: HomeRowKindType): string {
  return homeRowPreset(kind)?.label ?? kind.replaceAll('_', ' ');
}
