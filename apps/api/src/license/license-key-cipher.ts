import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const VERSION = 'v1';

/** Encrypt license key at rest (central re-validation). */
export function encryptLicenseKeyAtRest(plaintext: string, masterSecret: string): string {
  const key = createHash('sha256').update(`license-at-rest:${masterSecret}`, 'utf8').digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), enc.toString('base64url')].join(
    '.',
  );
}

export function decryptLicenseKeyAtRest(payload: string, masterSecret: string): string | null {
  const parts = payload.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    return null;
  }
  try {
    const iv = Buffer.from(parts[1], 'base64url');
    const tag = Buffer.from(parts[2], 'base64url');
    const data = Buffer.from(parts[3], 'base64url');
    const key = createHash('sha256').update(`license-at-rest:${masterSecret}`, 'utf8').digest();
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(data), decipher.final()]);
    return plain.toString('utf8');
  } catch {
    return null;
  }
}
