import {
  isEntitledStatus,
  qualityAllowed,
  SubscriptionStatus,
  VideoQuality,
} from '@movie-server/shared';

describe('subscription entitlement helpers', () => {
  const now = new Date('2026-06-01T12:00:00.000Z');
  const future = new Date('2026-07-01T12:00:00.000Z');
  const past = new Date('2026-05-01T12:00:00.000Z');

  it('entitles trial, active, cancelled-in-period, and grace windows', () => {
    expect(isEntitledStatus(SubscriptionStatus.Trial, now, future)).toBe(true);
    expect(isEntitledStatus(SubscriptionStatus.Active, now, future)).toBe(true);
    expect(isEntitledStatus(SubscriptionStatus.Cancelled, now, future)).toBe(true);
    expect(isEntitledStatus(SubscriptionStatus.Cancelled, now, past)).toBe(false);
    expect(isEntitledStatus(SubscriptionStatus.Pending, now, future)).toBe(false);
    expect(isEntitledStatus(SubscriptionStatus.Suspended, now, past, future)).toBe(true);
    expect(isEntitledStatus(SubscriptionStatus.Suspended, now, past, past)).toBe(false);
    expect(isEntitledStatus(SubscriptionStatus.Expired, now, past, future)).toBe(true);
    expect(isEntitledStatus(SubscriptionStatus.Expired, now, past)).toBe(false);
  });

  it('ranks video quality so Basic cannot play UHD', () => {
    expect(qualityAllowed(VideoQuality.Sd, VideoQuality.Sd)).toBe(true);
    expect(qualityAllowed(VideoQuality.Hd, VideoQuality.Sd)).toBe(true);
    expect(qualityAllowed(VideoQuality.Sd, VideoQuality.Uhd)).toBe(false);
    expect(qualityAllowed(VideoQuality.Uhd, VideoQuality.Hd)).toBe(true);
  });
});
