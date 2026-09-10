import {
  MaturityLevel,
  PRESET_AVATARS,
  type PublicProfile,
  type ProfileLanguage,
  type SubtitleLanguage,
} from '@movie-server/shared';
import { ProfileDocument } from './schemas/profile.schema';

export function profileAvatarUrl(profile: ProfileDocument, apiUrl?: string): string | null {
  if (!profile.avatarFileName) {
    return null;
  }
  const path = `/api/v1/uploads/avatars/${String(profile.userId)}/${profile.avatarFileName}`;
  return apiUrl ? `${apiUrl}${path.replace(/^\/api\/v1/, '')}` : path;
}

export function toPublicProfile(profile: ProfileDocument): PublicProfile {
  return {
    id: String(profile._id),
    userId: String(profile.userId),
    name: profile.name,
    avatarKey: profile.avatarKey || PRESET_AVATARS[0],
    avatarUrl: profile.avatarFileName
      ? `/api/v1/uploads/avatars/${String(profile.userId)}/${profile.avatarFileName}`
      : null,
    isKids: profile.isKids,
    isDefault: profile.isDefault,
    hasPin: Boolean(profile.hasPin),
    language: profile.language as ProfileLanguage,
    audioLanguage: profile.audioLanguage as ProfileLanguage,
    subtitleLanguage: profile.subtitleLanguage as SubtitleLanguage,
    maturityLevel: profile.maturityLevel as MaturityLevel,
    lastSelectedAt: profile.lastSelectedAt?.toISOString() ?? null,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}
