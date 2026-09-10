import { PLAN_FEATURES, PlanTier, SubscriptionStatus, VideoQuality } from '@movie-server/shared';
import { staffEntitlement } from './staff-entitlement';

describe('staffEntitlement', () => {
  it('grants catalog access so admins can browse home without a paid plan', () => {
    const entitlement = staffEntitlement(new Date('2026-09-10T00:00:00.000Z'));
    expect(entitlement.entitled).toBe(true);
    expect(entitlement.status).toBe(SubscriptionStatus.Active);
    expect(entitlement.planSlug).toBe('staff');
    expect(entitlement.maxVideoQuality).toBe(VideoQuality.Uhd);
    expect(entitlement.features).toEqual(expect.arrayContaining([...PLAN_FEATURES]));
    expect(entitlement.tierRank).toBeGreaterThan(0);
    expect(PlanTier.Premium).toBe('premium');
  });
});
