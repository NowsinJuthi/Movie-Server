import { evaluateSessionRisk, type SessionRiskInput } from './suspicious';
import { SuspiciousReason } from '@movie-server/shared';

describe('evaluateSessionRisk', () => {
  const base: SessionRiskInput = {
    currentIp: '10.0.0.8',
    previousIps: ['10.0.0.8'],
    activeDistinctIps: ['10.0.0.8'],
    isNewDevice: false,
    devicesCreatedLastDay: 1,
    maxDevices: 2,
  };

  it('stays quiet for a normal repeat sign-in', () => {
    const result = evaluateSessionRisk(base);
    expect(result.suspicious).toBe(false);
    expect(result.flags).toEqual([]);
  });

  it('flags concurrent distinct IPs', () => {
    const result = evaluateSessionRisk({
      ...base,
      activeDistinctIps: ['10.0.0.8', '203.0.113.4'],
    });
    expect(result.flags).toContain(SuspiciousReason.ConcurrentIps);
    expect(result.suspicious).toBe(true);
  });

  it('flags a rapid IP change', () => {
    const result = evaluateSessionRisk({
      ...base,
      previousIp: '198.51.100.10',
      minutesSincePreviousSession: 1,
    });
    expect(result.flags).toContain(SuspiciousReason.RapidIpChange);
  });

  it('flags a burst of new devices', () => {
    const result = evaluateSessionRisk({
      ...base,
      isNewDevice: true,
      devicesCreatedLastDay: 5,
      maxDevices: 1,
    });
    expect(result.flags).toContain(SuspiciousReason.ManyDevices);
    expect(result.suspicious).toBe(true);
  });

  it('treats refresh-token reuse as high risk', () => {
    const result = evaluateSessionRisk({ ...base, refreshReuse: true });
    expect(result.flags).toContain(SuspiciousReason.RefreshReuse);
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.suspicious).toBe(true);
  });
});
