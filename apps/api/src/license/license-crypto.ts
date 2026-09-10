import { createHmac, createHash, randomBytes, timingSafeEqual } from 'crypto';

export type LicensePayload = {
  v: 1;
  edition: 'standard' | 'pro';
  /** Unix seconds; null = never expires */
  exp: number | null;
  /** Unique key id */
  jti: string;
};

const PREFIX = 'CV1';

function b64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromB64url(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(normalized, 'base64');
}

function hmac(secret: string, data: string): Buffer {
  return createHmac('sha256', secret).update(data, 'utf8').digest();
}

export function fingerprintKey(licenseKey: string): string {
  return createHash('sha256').update(licenseKey.trim(), 'utf8').digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Issue a signed license key (vendor tool / offline generation). */
export function issueLicenseKey(
  masterSecret: string,
  options: { edition?: 'standard' | 'pro'; expiresAt?: Date | null } = {},
): string {
  const payload: LicensePayload = {
    v: 1,
    edition: options.edition ?? 'pro',
    exp: options.expiresAt ? Math.floor(options.expiresAt.getTime() / 1000) : null,
    jti: randomBytes(8).toString('hex'),
  };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(hmac(masterSecret, `${PREFIX}.${body}`));
  return `${PREFIX}.${body}.${sig}`;
}

export function verifyLicenseKey(
  masterSecret: string,
  licenseKey: string,
): { ok: true; payload: LicensePayload } | { ok: false; reason: string } {
  const raw = licenseKey.trim();
  const parts = raw.split('.');
  if (parts.length !== 3 || parts[0] !== PREFIX) {
    return { ok: false, reason: 'Malformed license key.' };
  }
  const [, body, sig] = parts;
  if (!body || !sig) {
    return { ok: false, reason: 'Malformed license key.' };
  }
  const expected = b64url(hmac(masterSecret, `${PREFIX}.${body}`));
  if (!safeEqual(expected, sig)) {
    return { ok: false, reason: 'License signature is invalid.' };
  }
  try {
    const payload = JSON.parse(fromB64url(body).toString('utf8')) as LicensePayload;
    if (payload.v !== 1 || (payload.edition !== 'standard' && payload.edition !== 'pro')) {
      return { ok: false, reason: 'Unsupported license payload.' };
    }
    if (payload.exp != null && payload.exp * 1000 <= Date.now()) {
      return { ok: false, reason: 'License key has expired.' };
    }
    if (!payload.jti || typeof payload.jti !== 'string') {
      return { ok: false, reason: 'Invalid license id.' };
    }
    return { ok: true, payload };
  } catch {
    return { ok: false, reason: 'Corrupt license payload.' };
  }
}

export function sealInstallAnchor(
  masterSecret: string,
  installId: string,
  installedAtIso: string,
): string {
  const body = b64url(JSON.stringify({ installId, installedAt: installedAtIso }));
  const sig = b64url(hmac(masterSecret, `install.${body}`));
  return `${body}.${sig}`;
}

export function readInstallSeal(
  masterSecret: string,
  seal: string,
): { installId: string; installedAt: string } | null {
  const parts = seal.trim().split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;
  const expected = b64url(hmac(masterSecret, `install.${body}`));
  if (!safeEqual(expected, sig)) return null;
  try {
    const parsed = JSON.parse(fromB64url(body).toString('utf8')) as {
      installId?: string;
      installedAt?: string;
    };
    if (!parsed.installId || !parsed.installedAt) return null;
    return { installId: parsed.installId, installedAt: parsed.installedAt };
  } catch {
    return null;
  }
}
