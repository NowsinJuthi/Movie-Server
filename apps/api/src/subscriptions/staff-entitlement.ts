import {
  PLAN_FEATURES,
  PLAN_TIER_RANK,
  PlanTier,
  SubscriptionStatus,
  VideoQuality,
  type SubscriptionEntitlement,
} from '@movie-server/shared';

export function staffEntitlement(now = new Date()): SubscriptionEntitlement {
  const currentPeriodEnd = new Date(now);
  currentPeriodEnd.setUTCFullYear(currentPeriodEnd.getUTCFullYear() + 10);
  return {
    entitled: true,
    status: SubscriptionStatus.Active,
    planSlug: 'staff',
    tierRank: PLAN_TIER_RANK[PlanTier.Premium],
    maxVideoQuality: VideoQuality.Uhd,
    maxDevices: 8,
    maxStreams: 8,
    features: [...PLAN_FEATURES],
    currentPeriodEnd: currentPeriodEnd.toISOString(),
    gracePeriodEndsAt: null,
    trialEnd: null,
  };
}
