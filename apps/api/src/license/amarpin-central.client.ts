import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const HMAC_OMIT = new Set(['hmac', 'signature', 'idToken']);

export type CentralLicenseResult = {
  success?: boolean;
  valid?: boolean;
  status?: string;
  code?: string;
  message?: string;
  licenseId?: string;
  product?: string;
  expiresAt?: string;
  features?: Record<string, boolean>;
  nextCheckAfterSeconds?: number;
  gracePeriodHours?: number;
  grace?: boolean;
  signature?: string;
  signedWith?: string;
};

export type CentralClientConfig = {
  apiUrl: string;
  /** Optional — per-site id from license.amarpin.com; not required for Movie-Server installs. */
  websiteId?: string;
  /** Vendor platform secret (same on every customer VPS). Falls back to license key for HMAC. */
  siteSecret?: string;
  productId?: string;
  timeoutMs?: number;
};

function resolveHmacSecret(config: CentralClientConfig, licenseKey: string): string {
  const site = config.siteSecret?.trim();
  if (site) {
    return site;
  }
  return licenseKey.trim();
}

function verifyResponseSignature(
  json: CentralLicenseResult,
  licenseKey: string,
  config: CentralClientConfig,
): boolean {
  if (!json.signature) {
    return true;
  }
  const record = json as Record<string, unknown>;
  const candidates = [
    config.siteSecret?.trim(),
    licenseKey.trim(),
  ].filter(Boolean) as string[];
  for (const secret of candidates) {
    if (verifyHmac(record, json.signature, secret)) {
      return true;
    }
  }
  return false;
}

function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  const type = typeof value;
  if (type === 'number' || type === 'boolean' || type === 'string') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map((item) => canonicalJson(item)).join(',') + ']';
  }
  if (type === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record)
      .filter((key) => !HMAC_OMIT.has(key) && record[key] !== undefined)
      .sort();
    return (
      '{' +
      keys.map((key) => JSON.stringify(key) + ':' + canonicalJson(record[key])).join(',') +
      '}'
    );
  }
  return JSON.stringify(String(value));
}

function signHmac(body: Record<string, unknown>, secret: string): string {
  return createHmac('sha256', secret).update(canonicalJson(body)).digest('base64');
}

function verifyHmac(body: Record<string, unknown>, signature: string, secret: string): boolean {
  if (!secret || !signature) {
    return false;
  }
  const expected = signHmac(body, secret);
  const given = String(signature).trim().replace(/\s/g, '');
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  if (a.length === b.length && timingSafeEqual(a, b)) {
    return true;
  }
  const hex = createHmac('sha256', secret).update(canonicalJson(body)).digest('hex');
  return given.toLowerCase() === hex.toLowerCase();
}

const EXPLICIT_NEGATIVE = new Set([
  'REVOKED',
  'SUSPENDED',
  'EXPIRED',
  'INACTIVE',
  'DEACTIVATED',
  'INVALID_LICENSE',
  'PRODUCT_MISMATCH',
  'ACTIVATION_LIMIT',
  'NOT_ACTIVATED',
]);

export function isCentralExplicitlyInvalid(result: CentralLicenseResult | null): boolean {
  if (!result) {
    return true;
  }
  if (result.valid === true) {
    return false;
  }
  const code = String(result.code || result.status || '').toUpperCase();
  return EXPLICIT_NEGATIVE.has(code);
}

export class AmarpinCentralClient {
  constructor(private readonly config: CentralClientConfig) {}

  async activate(params: {
    licenseKey: string;
    installationId: string;
    version?: string;
  }): Promise<CentralLicenseResult> {
    return this.post('activate', params.licenseKey, params.installationId, params.version);
  }

  async validate(params: {
    licenseKey: string;
    installationId: string;
    version?: string;
  }): Promise<CentralLicenseResult> {
    return this.post('validate', params.licenseKey, params.installationId, params.version);
  }

  private async post(
    action: string,
    licenseKey: string,
    installationId: string,
    version?: string,
  ): Promise<CentralLicenseResult> {
    const body: Record<string, unknown> = {
      action,
      licenseKey: licenseKey.trim(),
      installationId: installationId.trim(),
      timestamp: Math.floor(Date.now() / 1000),
      nonce: randomBytes(16).toString('hex'),
    };
    const websiteId = this.config.websiteId?.trim();
    if (websiteId) {
      body.websiteId = websiteId;
    }
    const productId = this.config.productId?.trim();
    if (productId) {
      body.productId = productId;
    }
    if (version?.trim()) {
      body.version = version.trim();
    }
    const hmacSecret = resolveHmacSecret(this.config, licenseKey);
    body.hmac = signHmac(body, hmacSecret);

    const controller = new AbortController();
    const timeoutMs = this.config.timeoutMs ?? 20_000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(this.config.apiUrl.replace(/\/$/, ''), {
        method: 'POST',
        headers: {
          'content-type': 'application/json; charset=utf-8',
          accept: 'application/json',
          'user-agent': 'movie-server-license/1',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await res.text();
      let json: CentralLicenseResult | null = null;
      try {
        json = JSON.parse(text) as CentralLicenseResult;
      } catch {
        json = null;
      }
      if (!json || typeof json !== 'object') {
        return {
          success: false,
          valid: false,
          code: 'TRANSPORT_ERROR',
          message: `License server returned HTTP ${res.status}`,
        };
      }
      if (json.signature && !verifyResponseSignature(json, licenseKey, this.config)) {
        return {
          success: false,
          valid: false,
          code: 'TRANSPORT_ERROR',
          message: 'License server response signature mismatch',
        };
      }
      if (json.success === false) {
        return {
          ...json,
          valid: false,
          code: json.code || 'SERVER_ERROR',
          message: json.message || json.code || 'License request failed',
        };
      }
      return json;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'License server unreachable';
      return {
        success: false,
        valid: false,
        code: 'TRANSPORT_ERROR',
        message,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
