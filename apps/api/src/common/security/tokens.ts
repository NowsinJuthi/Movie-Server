import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function tokensMatch(token: string, tokenHash: string): boolean {
  const computed = Buffer.from(hashToken(token));
  const stored = Buffer.from(tokenHash);
  if (computed.length !== stored.length) {
    return false;
  }
  return timingSafeEqual(computed, stored);
}

export function parseExpiryToMs(expires: string): number {
  const match = /^(\d+)([smhd])$/.exec(expires);
  if (!match) {
    return 15 * 60 * 1000;
  }
  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return amount * (multipliers[unit] ?? 60_000);
}
