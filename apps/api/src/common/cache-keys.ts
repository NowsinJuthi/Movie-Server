export const HOME_LAYOUT_KEY = 'home:layout:v';

export function homeCacheKey(profileId: string, layoutVersion = '0'): string {
  return `home:v2:${layoutVersion}:${profileId}`;
}

export function recommendationsCacheKey(profileId: string): string {
  return `recs:v1:${profileId}`;
}

export function entitlementCacheKey(userId: string): string {
  return `entitlement:v1:${userId}`;
}

export async function invalidateHomeProfileCache(
  redis: { get(key: string): Promise<string | null>; del(...keys: string[]): Promise<number> },
  profileId: string,
): Promise<void> {
  const version = (await redis.get(HOME_LAYOUT_KEY)) ?? '0';
  await redis.del(homeCacheKey(profileId, version), homeCacheKey(profileId, '0'));
}

export const RECOMMENDATION_QUEUE = 'recommendations';
