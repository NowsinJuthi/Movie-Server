import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  ErrorCode,
  LICENSE_TRIAL_DAYS,
  looksLikeCentralLicenseKey,
  looksLikeSignedLicenseKey,
  normalizeLicenseKeyInput,
  type LicenseEdition,
  type LicenseStatusResponse,
} from '@movie-server/shared';
import { InstanceLicense, InstanceLicenseDocument } from './schemas/instance-license.schema';
import {
  AmarpinCentralClient,
  isCentralExplicitlyInvalid,
  type CentralLicenseResult,
} from './amarpin-central.client';
import {
  decryptLicenseKeyAtRest,
  encryptLicenseKeyAtRest,
} from './license-key-cipher';
import {
  fingerprintKey,
  issueLicenseKey,
  readInstallSeal,
  sealInstallAnchor,
  verifyLicenseKey,
} from './license-crypto';

type CentralCache = {
  checkedAt: number;
  valid: boolean;
  lastValidAt: number;
  nextCheckMs: number;
  graceMs: number;
};

@Injectable()
export class LicenseService implements OnModuleInit {
  private readonly logger = new Logger(LicenseService.name);
  private cached: LicenseStatusResponse | null = null;
  private cachedAt = 0;
  private centralCache: CentralCache | null = null;

  constructor(
    private readonly config: ConfigService,
    @InjectModel(InstanceLicense.name)
    private readonly model: Model<InstanceLicenseDocument>,
  ) {}

  private masterSecret(): string {
    const dedicated = this.config.get<string>('LICENSE_MASTER_SECRET')?.trim();
    return dedicated || this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
  }

  private sealPath(): string {
    const configured = this.config.get<string>('LICENSE_SEAL_DIR')?.trim();
    const root = configured || path.join(process.cwd(), 'storage', 'license');
    return path.join(root, 'install.seal');
  }

  private trialMs(): number {
    const days = this.config.get<number>('LICENSE_TRIAL_DAYS') ?? LICENSE_TRIAL_DAYS;
    return Math.max(1, days) * 24 * 60 * 60 * 1000;
  }

  private centralClient(): AmarpinCentralClient {
    const apiUrl =
      this.config.get<string>('AMARPIN_LICENSE_API_URL')?.trim() ||
      'https://license.amarpin.com/api';
    const websiteId = this.config.get<string>('AMARPIN_WEBSITE_ID')?.trim() || '';
    const siteSecret = this.config.get<string>('AMARPIN_SITE_SECRET')?.trim() || '';
    const productId = this.config.get<string>('AMARPIN_PRODUCT_ID')?.trim();
    return new AmarpinCentralClient({
      apiUrl,
      websiteId,
      siteSecret,
      productId: productId || undefined,
    });
  }

  private mapCentralEdition(product?: string): 'standard' | 'pro' {
    const text = String(product || '').toLowerCase();
    if (text.includes('pro')) {
      return 'pro';
    }
    return 'standard';
  }

  private parseCentralExpiry(expiresAt?: string): Date | null {
    const raw = String(expiresAt || '').trim();
    if (!raw) {
      return null;
    }
    const date = new Date(raw.includes('T') ? raw : `${raw}T23:59:59.999Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private centralMessage(result: CentralLicenseResult): string {
    const code = String(result.code || result.status || '').toUpperCase();
    const map: Record<string, string> = {
      INVALID_LICENSE: 'License key was not found. Check the key from license.amarpin.com.',
      ACTIVATION_LIMIT: 'This license has reached its activation limit. Deactivate another site first.',
      PRODUCT_MISMATCH:
        'License server reported a product mismatch. Remove AMARPIN_PRODUCT_ID from .env so only the key is checked.',
      EXPIRED: 'License has expired. Renew at license.amarpin.com.',
      REVOKED: 'License was revoked.',
      SUSPENDED: 'License is suspended.',
      DEACTIVATED: 'License is inactive.',
      UNAUTHORIZED:
        'Server cannot authenticate with license.amarpin.com (vendor AMARPIN_SITE_SECRET must match the license platform).',
      TRANSPORT_ERROR: result.message || 'Could not reach license.amarpin.com.',
    };
    return map[code] || result.message || `License not valid (${code || 'unknown'}).`;
  }

  async onModuleInit(): Promise<void> {
    await this.ensureInstallRecord();
    const doc = await this.model.findOne({ singleton: 'instance' });
    if (doc?.licensed && doc.licenseProvider === 'central') {
      await this.refreshCentralLicense(doc, true).catch((error) => {
        this.logger.warn(
          `Central license check on boot failed: ${error instanceof Error ? error.message : error}`,
        );
      });
    }
    const envKey = this.config.get<string>('LICENSE_KEY')?.trim();
    if (envKey) {
      try {
        await this.activate(envKey, { fromEnv: true });
        this.logger.log('LICENSE_KEY from environment activated.');
      } catch (error) {
        this.logger.warn(
          `LICENSE_KEY env activation failed: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
    this.cached = null;
  }

  async ensureInstallRecord(): Promise<InstanceLicenseDocument> {
    const secret = this.masterSecret();
    let seal: { installId: string; installedAt: string } | null = null;
    try {
      const raw = await fs.readFile(this.sealPath(), 'utf8');
      seal = readInstallSeal(secret, raw);
    } catch {
      seal = null;
    }

    let doc = await this.model.findOne({ singleton: 'instance' });
    if (!doc && seal) {
      doc = await this.model.create({
        singleton: 'instance',
        installId: seal.installId,
        installedAt: new Date(seal.installedAt),
        licensed: false,
      });
      this.logger.warn('Restored install anchor from sealed file (DB was empty).');
    }

    if (!doc) {
      const installId = randomUUID();
      const installedAt = new Date();
      doc = await this.model.create({
        singleton: 'instance',
        installId,
        installedAt,
        licensed: false,
      });
      await this.writeSeal(installId, installedAt.toISOString());
      this.logger.log(`License trial started at ${installedAt.toISOString()} (30-day window).`);
      return doc;
    }

    // Prefer the earlier installedAt between DB and seal (anti-reset)
    if (seal) {
      const sealDate = new Date(seal.installedAt);
      if (sealDate.getTime() < doc.installedAt.getTime()) {
        doc.installedAt = sealDate;
        doc.installId = seal.installId;
        await doc.save();
      } else if (doc.installId !== seal.installId) {
        await this.writeSeal(doc.installId, doc.installedAt.toISOString());
      }
    } else {
      await this.writeSeal(doc.installId, doc.installedAt.toISOString());
    }

    return doc;
  }

  private async writeSeal(installId: string, installedAtIso: string): Promise<void> {
    const file = this.sealPath();
    await fs.mkdir(path.dirname(file), { recursive: true });
    const seal = sealInstallAnchor(this.masterSecret(), installId, installedAtIso);
    await fs.writeFile(file, seal, { encoding: 'utf8', mode: 0o600 });
  }

  async getStatus(force = false): Promise<LicenseStatusResponse> {
    const now = Date.now();
    if (!force && this.cached && now - this.cachedAt < 5_000) {
      return this.cached;
    }
    const doc = await this.ensureInstallRecord();
    let centralOk: boolean | undefined;
    if (doc.licensed && doc.licenseProvider === 'central') {
      centralOk = await this.refreshCentralLicense(doc, force);
    }
    const status = this.toStatus(doc, centralOk);
    this.cached = status;
    this.cachedAt = now;
    return status;
  }

  async assertUsable(): Promise<LicenseStatusResponse> {
    const status = await this.getStatus(true);
    if (status.ok) return status;
    if (status.mode === 'locked') {
      throw new ForbiddenException({
        error: status.licensed ? ErrorCode.LicenseExpired : ErrorCode.LicenseTrialExpired,
        message: status.message,
        details: status,
      });
    }
    throw new ForbiddenException({
      error: ErrorCode.LicenseRequired,
      message: status.message,
      details: status,
    });
  }

  async activate(licenseKey: string, options: { fromEnv?: boolean } = {}) {
    const normalized = normalizeLicenseKeyInput(licenseKey);
    if (looksLikeCentralLicenseKey(normalized)) {
      return this.activateCentral(normalized, options);
    }
    if (looksLikeSignedLicenseKey(normalized)) {
      return this.activateLocal(normalized, options);
    }
    throw new BadRequestException({
      error: ErrorCode.LicenseInvalid,
      message:
        'Enter a license.amarpin.com key (AMP-PRO-…) or a self-hosted CV1. key (three dot-separated parts).',
    });
  }

  private async activateLocal(licenseKey: string, options: { fromEnv?: boolean } = {}) {
    const verified = verifyLicenseKey(this.masterSecret(), licenseKey);
    if (!verified.ok) {
      throw new BadRequestException({
        error: ErrorCode.LicenseInvalid,
        message: verified.reason,
      });
    }

    const doc = await this.ensureInstallRecord();
    const fingerprint = fingerprintKey(licenseKey);

    if (
      doc.licensed &&
      doc.licenseJti &&
      doc.licenseJti !== verified.payload.jti &&
      (!doc.licenseExpiresAt || doc.licenseExpiresAt.getTime() > Date.now())
    ) {
      this.logger.warn('Replacing an existing active license with a new key.');
    }

    doc.licensed = true;
    doc.licenseProvider = 'local';
    doc.licenseKeyEnc = null;
    doc.licenseKeyFingerprint = fingerprint;
    doc.licenseJti = verified.payload.jti;
    doc.edition = verified.payload.edition;
    doc.licenseExpiresAt =
      verified.payload.exp != null ? new Date(verified.payload.exp * 1000) : null;
    doc.activatedAt = new Date();
    await doc.save();
    this.centralCache = null;
    this.cached = null;

    if (!options.fromEnv) {
      this.logger.log(`License activated locally (${verified.payload.edition}).`);
    }
    return { ok: true as const, status: await this.getStatus(true) };
  }

  private async activateCentral(licenseKey: string, options: { fromEnv?: boolean } = {}) {
    const doc = await this.ensureInstallRecord();
    const client = this.centralClient();
    const result = await client.activate({
      licenseKey,
      installationId: doc.installId,
    });

    if (result.valid !== true) {
      throw new BadRequestException({
        error: ErrorCode.LicenseInvalid,
        message: this.centralMessage(result),
        details: { code: result.code, status: result.status },
      });
    }

    doc.licensed = true;
    doc.licenseProvider = 'central';
    doc.licenseKeyFingerprint = fingerprintKey(licenseKey);
    doc.licenseKeyEnc = encryptLicenseKeyAtRest(licenseKey, this.masterSecret());
    doc.licenseJti = String(result.licenseId || '').trim() || doc.licenseJti;
    doc.edition = this.mapCentralEdition(result.product);
    doc.licenseExpiresAt = this.parseCentralExpiry(result.expiresAt);
    doc.activatedAt = new Date();
    await doc.save();

    this.centralCache = {
      checkedAt: Date.now(),
      valid: true,
      lastValidAt: Date.now(),
      nextCheckMs: (result.nextCheckAfterSeconds ?? 6 * 3600) * 1000,
      graceMs: (result.gracePeriodHours ?? 72) * 3600 * 1000,
    };
    this.cached = null;

    if (!options.fromEnv) {
      this.logger.log(`License activated via license.amarpin.com (${doc.edition}).`);
    }
    return { ok: true as const, status: await this.getStatus(true) };
  }

  private async refreshCentralLicense(
    doc: InstanceLicenseDocument,
    force: boolean,
  ): Promise<boolean> {
    const now = Date.now();
    if (
      !force &&
      this.centralCache &&
      now - this.centralCache.checkedAt < this.centralCache.nextCheckMs
    ) {
      if (this.centralCache.valid) {
        return true;
      }
      if (now - this.centralCache.lastValidAt <= this.centralCache.graceMs) {
        return true;
      }
      return false;
    }

    const stored = doc.licenseKeyEnc
      ? decryptLicenseKeyAtRest(doc.licenseKeyEnc, this.masterSecret())
      : null;
    if (!stored) {
      this.logger.warn('Central license is missing encrypted key material.');
      this.centralCache = {
        checkedAt: now,
        valid: false,
        lastValidAt: 0,
        nextCheckMs: 6 * 3600 * 1000,
        graceMs: 72 * 3600 * 1000,
      };
      return false;
    }

    const result = await this.centralClient().validate({
      licenseKey: stored,
      installationId: doc.installId,
    });

    const nextCheckMs = (result.nextCheckAfterSeconds ?? 6 * 3600) * 1000;
    const graceMs = (result.gracePeriodHours ?? 72) * 3600 * 1000;

    if (result.valid === true) {
      const expiry = this.parseCentralExpiry(result.expiresAt);
      if (expiry) {
        doc.licenseExpiresAt = expiry;
        await doc.save();
      }
      this.centralCache = {
        checkedAt: now,
        valid: true,
        lastValidAt: now,
        nextCheckMs,
        graceMs,
      };
      return true;
    }

    if (isCentralExplicitlyInvalid(result)) {
      this.centralCache = {
        checkedAt: now,
        valid: false,
        lastValidAt: this.centralCache?.lastValidAt ?? 0,
        nextCheckMs,
        graceMs,
      };
      return false;
    }

    const lastValidAt = this.centralCache?.lastValidAt ?? doc.activatedAt?.getTime() ?? 0;
    const inGrace = now - lastValidAt <= graceMs;
    this.centralCache = {
      checkedAt: now,
      valid: false,
      lastValidAt,
      nextCheckMs,
      graceMs,
    };
    return inGrace;
  }

  /** Vendor helper — not exposed over HTTP. */
  issueKey(options: { edition?: 'standard' | 'pro'; days?: number | null } = {}): string {
    const expiresAt =
      options.days == null || options.days <= 0
        ? null
        : new Date(Date.now() + options.days * 24 * 60 * 60 * 1000);
    return issueLicenseKey(this.masterSecret(), {
      edition: options.edition ?? 'pro',
      expiresAt,
    });
  }

  private toStatus(doc: InstanceLicenseDocument, centralOk?: boolean): LicenseStatusResponse {
    const now = Date.now();
    const installedAt = doc.installedAt;
    const trialEndsAt = new Date(installedAt.getTime() + this.trialMs());
    const trialMsLeft = trialEndsAt.getTime() - now;
    const trialDaysRemaining = Math.max(0, Math.ceil(trialMsLeft / (24 * 60 * 60 * 1000)));
    const trialActive = trialMsLeft > 0;

    let licenseValid = false;
    if (doc.licensed) {
      if (doc.licenseProvider === 'central') {
        licenseValid = centralOk === true;
      } else {
        licenseValid = !doc.licenseExpiresAt || doc.licenseExpiresAt.getTime() > now;
      }
    }

    let mode: LicenseStatusResponse['mode'];
    let ok: boolean;
    let message: string;
    let edition: LicenseEdition | null = null;

    if (licenseValid) {
      mode = 'licensed';
      ok = true;
      edition = doc.edition ?? 'pro';
      message = doc.licenseExpiresAt
        ? `Licensed until ${doc.licenseExpiresAt.toISOString().slice(0, 10)}.`
        : 'Licensed (lifetime).';
    } else if (trialActive) {
      mode = 'trial';
      ok = true;
      edition = 'trial';
      message = `Trial active — ${trialDaysRemaining} day(s) remaining. Activate a license key to keep full access.`;
    } else {
      mode = 'locked';
      ok = false;
      edition = null;
      message = doc.licensed
        ? 'License expired. Enter a valid license key to unlock AmarPin.'
        : 'Free trial ended. Enter a valid license key to unlock AmarPin.';
    }

    return {
      ok,
      mode,
      edition,
      licensed: licenseValid,
      trial: trialActive && !licenseValid,
      locked: !ok,
      installId: doc.installId,
      installedAt: installedAt.toISOString(),
      trialEndsAt: trialEndsAt.toISOString(),
      trialDaysRemaining: licenseValid ? 0 : trialDaysRemaining,
      licenseExpiresAt: doc.licenseExpiresAt ? doc.licenseExpiresAt.toISOString() : null,
      activatedAt: doc.activatedAt ? doc.activatedAt.toISOString() : null,
      message,
    };
  }
}
