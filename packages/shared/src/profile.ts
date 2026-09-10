export const MAX_PROFILES_PER_ACCOUNT = 5;

export const PROFILE_LANGUAGES = [
  'en',
  'bn',
  'hi',
  'es',
  'fr',
  'de',
  'it',
  'pt',
  'ja',
  'ko',
  'zh',
  'ar',
] as const;

export type ProfileLanguage = (typeof PROFILE_LANGUAGES)[number];

export const SUBTITLE_LANGUAGES = [...PROFILE_LANGUAGES, 'off'] as const;
export type SubtitleLanguage = (typeof SUBTITLE_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  bn: 'Bangla',
  hi: 'Hindi',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  ar: 'Arabic',
  off: 'Off',
};

const LANGUAGE_ALIASES: Record<string, ProfileLanguage> = {
  eng: 'en',
  english: 'en',
  ben: 'bn',
  bangla: 'bn',
  bengali: 'bn',
  hin: 'hi',
  hindi: 'hi',
  spa: 'es',
  spanish: 'es',
  fre: 'fr',
  fra: 'fr',
  french: 'fr',
  ger: 'de',
  deu: 'de',
  german: 'de',
  ita: 'it',
  italian: 'it',
  por: 'pt',
  portuguese: 'pt',
  jpn: 'ja',
  japanese: 'ja',
  kor: 'ko',
  korean: 'ko',
  chi: 'zh',
  zho: 'zh',
  chinese: 'zh',
  ara: 'ar',
  arabic: 'ar',
};

export function normalizeLanguageCode(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  return value.trim().toLowerCase().slice(0, 12) || null;
}

export function asProfileLanguage(value?: string | null): ProfileLanguage | null {
  const code = normalizeLanguageCode(value);
  if (!code) {
    return null;
  }
  if ((PROFILE_LANGUAGES as readonly string[]).includes(code)) {
    return code as ProfileLanguage;
  }
  return LANGUAGE_ALIASES[code] ?? null;
}

export function languageLabel(code?: string | null): string {
  if (!code || code === 'und') {
    return 'Unknown';
  }
  const normalized = asProfileLanguage(code) ?? normalizeLanguageCode(code);
  if (!normalized) {
    return 'Unknown';
  }
  return LANGUAGE_LABELS[normalized] ?? normalized.toUpperCase();
}

export const MaturityLevel = {
  Kids: 'kids',
  Teens: 'teens',
  Mature: 'mature',
} as const;

export type MaturityLevel = (typeof MaturityLevel)[keyof typeof MaturityLevel];

export const MATURITY_LEVELS = [
  MaturityLevel.Kids,
  MaturityLevel.Teens,
  MaturityLevel.Mature,
] as const;

export const PRESET_AVATARS = [
  'preset-0',
  'preset-1',
  'preset-2',
  'preset-3',
  'preset-4',
  'preset-5',
  'preset-6',
  'preset-7',
] as const;

export type PresetAvatar = (typeof PRESET_AVATARS)[number];

export const RecommendationReason = {
  Watched: 'because_you_watched',
  MyList: 'from_your_list',
  Continue: 'continue_watching',
  Favorite: 'from_your_favorites',
  Genre: 'because_you_like_genre',
  Similar: 'similar_to_watched',
  Rated: 'because_you_rated',
  Trending: 'trending_for_you',
} as const;

export type RecommendationReason =
  (typeof RecommendationReason)[keyof typeof RecommendationReason];

export type PublicProfile = {
  id: string;
  userId: string;
  name: string;
  avatarKey: string;
  avatarUrl: string | null;
  isKids: boolean;
  isDefault: boolean;
  hasPin: boolean;
  language: ProfileLanguage;
  audioLanguage: ProfileLanguage;
  subtitleLanguage: SubtitleLanguage;
  maturityLevel: MaturityLevel;
  lastSelectedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WatchProgress = {
  id: string;
  profileId: string;
  mediaId: string;
  progressSeconds: number;
  durationSeconds: number;
  completed: boolean;
  lastWatchedAt: string;
};

export type MyListItem = {
  id: string;
  profileId: string;
  mediaId: string;
  addedAt: string;
};

export type RecommendationItem = {
  id: string;
  profileId: string;
  mediaId: string;
  score: number;
  reason: RecommendationReason;
  strategy?: string;
  sourceMediaId?: string | null;
};
