import {
  PLAN_FEATURES,
  PLAN_TIER_RANK,
  PlanTier,
  SubscriptionStatus,
  VideoQuality,
  type SubscriptionEntitlement,
} from '@movie-server/shared';

/** Complimentary premium access for accounts with the VIP role. */
export function vipEntitlement(now = new Date()): SubscriptionEntitlement {
  const currentPeriodEnd = new Date(now);
  currentPeriodEnd.setUTCFullYear(currentPeriodEnd.getUTCFullYear() + 10);
  return {
    entitled: true,
    status: SubscriptionStatus.Active,
    planSlug: 'vip',
    tierRank: PLAN_TIER_RANK[PlanTier.Premium],
    maxVideoQuality: VideoQuality.Uhd,
    maxDevices: 4,
    maxStreams: 4,
    features: [...PLAN_FEATURES],
    currentPeriodEnd: currentPeriodEnd.toISOString(),
    gracePeriodEndsAt: null,
    trialEnd: null,
  };
}
