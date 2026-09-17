import { HomeRowKind, type HomeRowKind as HomeRowKindType } from './home';

export type HomeRowPresetGroup = 'catalog' | 'advanced' | 'personalized';

export type HomeRowPreset = {
  kind: HomeRowKindType;
  label: string;
  defaultTitle: string;
  description: string;
  group: HomeRowPresetGroup;
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

export const HOME_PERSONALIZED_ROW_PRESETS: HomeRowPreset[] = [
  {
    kind: HomeRowKind.Continue,
    label: 'Continue watching',
    defaultTitle: 'Continue Watching',
    description: 'Shown automatically when a profile has playback progress.',
    group: 'personalized',
  },
  {
    kind: HomeRowKind.RecentlyWatched,
    label: 'Recently watched',
    defaultTitle: 'Recently Watched',
    description: 'Profile watch history shelf.',
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
  {
    kind: HomeRowKind.Recommended,
    label: 'Recommended',
    defaultTitle: 'Recommended for You',
    description: 'Personalized recommendations.',
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
  [...HOME_CATALOG_ROW_PRESETS, ...HOME_ADVANCED_ROW_PRESETS, ...HOME_PERSONALIZED_ROW_PRESETS].map(
    (preset) => [preset.kind, preset],
  ),
);

export function homeRowPreset(kind: HomeRowKindType): HomeRowPreset | undefined {
  return PRESET_BY_KIND.get(kind);
}

export function homeRowKindLabel(kind: HomeRowKindType): string {
  return homeRowPreset(kind)?.label ?? kind.replaceAll('_', ' ');
}
