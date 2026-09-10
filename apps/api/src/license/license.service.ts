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
  type LicenseEdition,
  type LicenseStatusResponse,
} from '@movie-server/shared';
import { InstanceLicense, InstanceLicenseDocument } from './schemas/instance-license.schema';
import {
  fingerprintKey,
  issueLicenseKey,
  readInstallSeal,
  sealInstallAnchor,
  verifyLicenseKey,
} from './license-crypto';

@Injectable()
export class LicenseService implements OnModuleInit {
  private readonly logger = new Logger(LicenseService.name);
  private cached: LicenseStatusResponse | null = null;
  private cachedAt = 0;

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

  async onModuleInit(): Promise<void> {
    await this.ensureInstallRecord();
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
    const status = this.toStatus(doc);
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
    const verified = verifyLicenseKey(this.masterSecret(), licenseKey);
    if (!verified.ok) {
      throw new BadRequestException({
        error: ErrorCode.LicenseInvalid,
        message: verified.reason,
      });
    }

    const doc = await this.ensureInstallRecord();
    const fingerprint = fingerprintKey(licenseKey);

    // Prevent reusing a different already-bound key id if one is active and still valid
    if (
      doc.licensed &&
      doc.licenseJti &&
      doc.licenseJti !== verified.payload.jti &&
      (!doc.licenseExpiresAt || doc.licenseExpiresAt.getTime() > Date.now())
    ) {
      // Allow replacement — vendor reissue is OK; just log
      this.logger.warn('Replacing an existing active license with a new key.');
    }

    doc.licensed = true;
    doc.licenseKeyFingerprint = fingerprint;
    doc.licenseJti = verified.payload.jti;
    doc.edition = verified.payload.edition;
    doc.licenseExpiresAt =
      verified.payload.exp != null ? new Date(verified.payload.exp * 1000) : null;
    doc.activatedAt = new Date();
    await doc.save();
    this.cached = null;

    if (!options.fromEnv) {
      this.logger.log(`License activated (${verified.payload.edition}).`);
    }
    return { ok: true as const, status: await this.getStatus(true) };
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

  private toStatus(doc: InstanceLicenseDocument): LicenseStatusResponse {
    const now = Date.now();
    const installedAt = doc.installedAt;
    const trialEndsAt = new Date(installedAt.getTime() + this.trialMs());
    const trialMsLeft = trialEndsAt.getTime() - now;
    const trialDaysRemaining = Math.max(0, Math.ceil(trialMsLeft / (24 * 60 * 60 * 1000)));
    const trialActive = trialMsLeft > 0;

    let licenseValid = false;
    if (doc.licensed) {
      licenseValid = !doc.licenseExpiresAt || doc.licenseExpiresAt.getTime() > now;
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
        ? 'License expired. Enter a valid license key to unlock CineVault.'
        : 'Free trial ended. Enter a valid license key to unlock CineVault.';
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
