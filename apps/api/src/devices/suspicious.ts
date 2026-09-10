import { SuspiciousReason } from '@movie-server/shared';

export type SessionRiskInput = {
  currentIp: string;
  previousIps: string[];
  activeDistinctIps: string[];
  isNewDevice: boolean;
  devicesCreatedLastDay: number;
  maxDevices: number;
  minutesSincePreviousSession?: number | null;
  previousIp?: string | null;
  refreshReuse?: boolean;
};

export type SessionRiskResult = {
  suspicious: boolean;
  flags: SuspiciousReason[];
  score: number;
};

const RAPID_IP_MINUTES = 5;

export function evaluateSessionRisk(input: SessionRiskInput): SessionRiskResult {
  const flags: SuspiciousReason[] = [];
  let score = 0;
  const currentIp = input.currentIp.trim();
  const previousIp = input.previousIp?.trim() || null;

  if (input.refreshReuse) {
    flags.push(SuspiciousReason.RefreshReuse);
    score += 80;
  }

  const liveIps = unique(input.activeDistinctIps.map((item) => item.trim()).filter(Boolean));
  if (liveIps.length >= 2) {
    flags.push(SuspiciousReason.ConcurrentIps);
    score += 25 + Math.min(liveIps.length * 5, 20);
  }

  if (
    currentIp &&
    previousIp &&
    currentIp !== previousIp &&
    input.minutesSincePreviousSession != null &&
    input.minutesSincePreviousSession <= RAPID_IP_MINUTES
  ) {
    flags.push(SuspiciousReason.RapidIpChange);
    score += 20;
  }

  if (input.isNewDevice && input.devicesCreatedLastDay >= Math.max(input.maxDevices + 1, 3)) {
    flags.push(SuspiciousReason.ManyDevices);
    score += 30;
  }

  return {
    suspicious: score >= 25 || flags.includes(SuspiciousReason.RefreshReuse),
    flags: unique(flags),
    score,
  };
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}
