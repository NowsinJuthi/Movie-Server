import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as nodemailer from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import {
  ErrorCode,
  RECOMMENDED_REGISTRATION_EMAIL_DOMAINS,
  normalizeEmailDomainList,
  type AdminSiteSettings,
  type EmailDomainPolicy,
  type PublicBranding,
  type PublicSiteFeatures,
  type SmtpTestResult,
  type UpdateSiteSettingsInput,
} from '@movie-server/shared';
import { BrandingStorageService, isBrandingKey } from './branding-storage.service';
import { SettingsSecretCrypto } from './settings-secret.crypto';
import { SiteSettings, SiteSettingsDocument } from './schemas/site-settings.schema';

export type ResolvedMailConfig = {
  appName: string;
  from: string;
  transporter: nodemailer.Transporter<SMTPTransport.SentMessageInfo> | null;
  source: 'database' | 'env' | 'none';
};

@Injectable()
export class SiteSettingsService implements OnModuleInit {
  private readonly logger = new Logger(SiteSettingsService.name);
  private mailCache: { at: number; value: ResolvedMailConfig } | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly crypto: SettingsSecretCrypto,
    private readonly branding: BrandingStorageService,
    @InjectModel(SiteSettings.name)
    private readonly model: Model<SiteSettingsDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    const doc = await this.ensureDoc();
    await this.ensureDefaultEmailAllowlist(doc);
  }

  private defaultEmailAllowlist(): string[] {
    return [...RECOMMENDED_REGISTRATION_EMAIL_DOMAINS];
  }

  private readEmailDomainPolicy(doc: SiteSettingsDocument): EmailDomainPolicy {
    const allowlist = normalizeEmailDomainList(doc.emailDomains?.allowlist ?? []);
    const blocklist = normalizeEmailDomainList(doc.emailDomains?.blocklist ?? []);
    return {
      allowlist,
      blocklist,
      allowlistEnabled: allowlist.length > 0,
    };
  }

  async getEmailDomainPolicy(): Promise<EmailDomainPolicy> {
    const doc = await this.ensureDoc();
    return this.readEmailDomainPolicy(doc);
  }

  private async ensureDefaultEmailAllowlist(doc: SiteSettingsDocument): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    if (!doc.emailDomains) {
      doc.emailDomains = {
        allowlist: [],
        blocklist: [],
        customized: false,
      };
    }
    if (doc.emailDomains.customized) {
      return;
    }
    if ((doc.emailDomains.allowlist?.length ?? 0) > 0) {
      return;
    }
    doc.emailDomains.allowlist = this.defaultEmailAllowlist();
    doc.emailDomains.blocklist = doc.emailDomains.blocklist ?? [];
    await doc.save();
  }

  invalidateMailCache(): void {
    this.mailCache = null;
  }

  async ensureDoc(): Promise<SiteSettingsDocument> {
    let doc = await this.model.findOne({ singleton: 'instance' });
    if (!doc) {
      doc = await this.model.create({
        singleton: 'instance',
        smtpEnabled: false,
        smtpHost: '',
        smtpPort: 587,
        smtpSecure: false,
        smtpUser: '',
        mailFromName: '',
        mailFromEmail: '',
      });
    }
    return doc;
  }

  private apiPrefix(): string {
    const prefix = this.config.get<string>('API_PREFIX') || 'api/v1';
    return prefix.startsWith('/') ? prefix : `/${prefix}`;
  }

  logoPublicPath(key?: string | null): string | null {
    return key && isBrandingKey(key) ? `${this.apiPrefix()}/settings/branding/logo` : null;
  }

  logoLightPublicPath(key?: string | null): string | null {
    return key && isBrandingKey(key) ? `${this.apiPrefix()}/settings/branding/logo/light` : null;
  }

  logoDarkPublicPath(key?: string | null): string | null {
    return key && isBrandingKey(key) ? `${this.apiPrefix()}/settings/branding/logo/dark` : null;
  }

  faviconPublicPath(key?: string | null): string | null {
    return key && isBrandingKey(key) ? `${this.apiPrefix()}/settings/branding/favicon` : null;
  }

  private resolveLightLogoKey(doc: SiteSettingsDocument): string | null {
    return doc.logoLightKey ?? doc.logoKey ?? doc.logoDarkKey ?? null;
  }

  private resolveDarkLogoKey(doc: SiteSettingsDocument): string | null {
    return doc.logoDarkKey ?? doc.logoKey ?? doc.logoLightKey ?? null;
  }

  async getPublicBranding(): Promise<PublicBranding> {
    const doc = await this.ensureDoc();
    const envName = this.config.get<string>('APP_NAME') || 'AmarPin';
    const lightKey = this.resolveLightLogoKey(doc);
    const darkKey = this.resolveDarkLogoKey(doc);
    return {
      siteName: doc.siteName?.trim() || envName,
      logoLightUrl: this.logoLightPublicPath(lightKey),
      logoDarkUrl: this.logoDarkPublicPath(darkKey),
      logoUrl: this.logoLightPublicPath(lightKey) ?? this.logoPublicPath(doc.logoKey),
      faviconUrl: this.faviconPublicPath(doc.faviconKey),
    };
  }

  async getPublicFeatures(): Promise<PublicSiteFeatures> {
    const doc = await this.ensureDoc();
    return { movieUploadRequestsEnabled: Boolean(doc.movieUploadRequestsEnabled) };
  }

  async isMovieUploadRequestsEnabled(): Promise<boolean> {
    const doc = await this.ensureDoc();
    return Boolean(doc.movieUploadRequestsEnabled);
  }

  async getAdminSettings(): Promise<AdminSiteSettings> {
    const doc = await this.ensureDoc();
    const envName = this.config.get<string>('APP_NAME') || 'AmarPin';
    const siteName = doc.siteName?.trim() || envName;
    const mail = await this.resolveMailConfig(true);

    const fromName = doc.mailFromName?.trim() || '';
    const fromEmail = doc.mailFromEmail?.trim() || '';
    const fromHeader =
      fromName && fromEmail
        ? `${fromName} <${fromEmail}>`
        : fromEmail || this.config.get<string>('MAIL_FROM') || '';

    return {
      siteName,
      logoLightUrl: doc.logoLightKey ? this.logoLightPublicPath(doc.logoLightKey) : null,
      logoDarkUrl: doc.logoDarkKey ? this.logoDarkPublicPath(doc.logoDarkKey) : null,
      logoUrl: this.logoPublicPath(doc.logoKey),
      faviconUrl: this.faviconPublicPath(doc.faviconKey),
      smtp: {
        enabled: doc.smtpEnabled,
        host: doc.smtpHost || '',
        port: doc.smtpPort || 587,
        secure: doc.smtpSecure || doc.smtpPort === 465,
        user: doc.smtpUser || '',
        passwordSet: Boolean(doc.smtpPasswordEnc),
        fromName,
        fromEmail,
        fromHeader,
      },
      smtpReady: Boolean(mail.transporter),
      movieUploadRequestsEnabled: Boolean(doc.movieUploadRequestsEnabled),
      emailDomains: this.readEmailDomainPolicy(doc),
      source: {
        siteName: doc.siteName?.trim() ? 'database' : 'env',
        smtp: mail.source === 'none' ? 'none' : mail.source,
      },
    };
  }

  async updateSettings(input: UpdateSiteSettingsInput): Promise<AdminSiteSettings> {
    const doc = await this.ensureDoc();

    if (input.siteName !== undefined) {
      const name = input.siteName.trim();
      if (name.length < 2 || name.length > 80) {
        throw new BadRequestException({
          error: ErrorCode.ValidationFailed,
          message: 'Site name must be 2–80 characters.',
        });
      }
      doc.siteName = name;
    }

    if (input.movieUploadRequestsEnabled !== undefined) {
      doc.movieUploadRequestsEnabled = input.movieUploadRequestsEnabled;
    }

    if (input.emailDomains) {
      if (!doc.emailDomains) {
        doc.emailDomains = { allowlist: [], blocklist: [], customized: false };
      }
      doc.emailDomains.customized = true;
      if (input.emailDomains.allowlist !== undefined) {
        doc.emailDomains.allowlist = normalizeEmailDomainList(input.emailDomains.allowlist);
      }
      if (input.emailDomains.blocklist !== undefined) {
        doc.emailDomains.blocklist = normalizeEmailDomainList(input.emailDomains.blocklist);
      }
    }

    if (input.smtp) {
      const smtp = input.smtp;
      if (smtp.enabled !== undefined) doc.smtpEnabled = smtp.enabled;
      if (smtp.host !== undefined) doc.smtpHost = smtp.host.trim();
      if (smtp.port !== undefined) {
        if (!Number.isFinite(smtp.port) || smtp.port < 1 || smtp.port > 65535) {
          throw new BadRequestException({
            error: ErrorCode.ValidationFailed,
            message: 'SMTP port must be between 1 and 65535.',
          });
        }
        doc.smtpPort = smtp.port;
      }
      if (smtp.secure !== undefined) doc.smtpSecure = smtp.secure;
      if (smtp.user !== undefined) doc.smtpUser = smtp.user.trim();
      if (smtp.fromName !== undefined) doc.mailFromName = smtp.fromName.trim();
      if (smtp.fromEmail !== undefined) doc.mailFromEmail = smtp.fromEmail.trim();
      if (smtp.password !== undefined && smtp.password.length > 0) {
        doc.smtpPasswordEnc = this.crypto.encrypt(smtp.password);
      }
    }

    await doc.save();
    this.invalidateMailCache();
    return this.getAdminSettings();
  }

  async uploadLogo(file: { mimetype: string; buffer: Buffer }): Promise<AdminSiteSettings> {
    const doc = await this.ensureDoc();
    if (file.buffer.length > this.branding.maxBytes()) {
      throw new BadRequestException({
        error: ErrorCode.ValidationFailed,
        message: 'Logo file is too large.',
      });
    }
    let key: string;
    try {
      key = await this.branding.save(file);
    } catch (error) {
      throw new BadRequestException({
        error: ErrorCode.ValidationFailed,
        message: error instanceof Error ? error.message : 'Invalid logo file.',
      });
    }
    const previous = doc.logoKey;
    doc.logoKey = key;
    await doc.save();
    await this.branding.remove(previous);
    return this.getAdminSettings();
  }

  async uploadFavicon(file: { mimetype: string; buffer: Buffer }): Promise<AdminSiteSettings> {
    const doc = await this.ensureDoc();
    if (file.buffer.length > this.branding.maxBytes()) {
      throw new BadRequestException({
        error: ErrorCode.ValidationFailed,
        message: 'Favicon file is too large.',
      });
    }
    let key: string;
    try {
      key = await this.branding.save(file);
    } catch (error) {
      throw new BadRequestException({
        error: ErrorCode.ValidationFailed,
        message: error instanceof Error ? error.message : 'Invalid favicon file.',
      });
    }
    const previous = doc.faviconKey;
    doc.faviconKey = key;
    await doc.save();
    await this.branding.remove(previous);
    return this.getAdminSettings();
  }

  async clearLogo(): Promise<AdminSiteSettings> {
    const doc = await this.ensureDoc();
    const previous = doc.logoKey;
    doc.logoKey = null;
    await doc.save();
    await this.branding.remove(previous);
    return this.getAdminSettings();
  }

  async uploadLogoLight(file: { mimetype: string; buffer: Buffer }): Promise<AdminSiteSettings> {
    return this.uploadThemeLogo(file, 'light');
  }

  async uploadLogoDark(file: { mimetype: string; buffer: Buffer }): Promise<AdminSiteSettings> {
    return this.uploadThemeLogo(file, 'dark');
  }

  private async uploadThemeLogo(
    file: { mimetype: string; buffer: Buffer },
    theme: 'light' | 'dark',
  ): Promise<AdminSiteSettings> {
    const doc = await this.ensureDoc();
    if (file.buffer.length > this.branding.maxBytes()) {
      throw new BadRequestException({
        error: ErrorCode.ValidationFailed,
        message: 'Logo file is too large.',
      });
    }
    let key: string;
    try {
      key = await this.branding.save(file);
    } catch (error) {
      throw new BadRequestException({
        error: ErrorCode.ValidationFailed,
        message: error instanceof Error ? error.message : 'Invalid logo file.',
      });
    }
    const previous = theme === 'light' ? doc.logoLightKey : doc.logoDarkKey;
    if (theme === 'light') {
      doc.logoLightKey = key;
    } else {
      doc.logoDarkKey = key;
    }
    await doc.save();
    await this.branding.remove(previous);
    return this.getAdminSettings();
  }

  async clearLogoLight(): Promise<AdminSiteSettings> {
    const doc = await this.ensureDoc();
    const previous = doc.logoLightKey;
    doc.logoLightKey = null;
    await doc.save();
    await this.branding.remove(previous);
    return this.getAdminSettings();
  }

  async clearLogoDark(): Promise<AdminSiteSettings> {
    const doc = await this.ensureDoc();
    const previous = doc.logoDarkKey;
    doc.logoDarkKey = null;
    await doc.save();
    await this.branding.remove(previous);
    return this.getAdminSettings();
  }

  async clearFavicon(): Promise<AdminSiteSettings> {
    const doc = await this.ensureDoc();
    const previous = doc.faviconKey;
    doc.faviconKey = null;
    await doc.save();
    await this.branding.remove(previous);
    return this.getAdminSettings();
  }

  async openLogo() {
    const doc = await this.ensureDoc();
    const key = doc.logoKey ?? this.resolveLightLogoKey(doc);
    if (!key) {
      throw new NotFoundException({ error: ErrorCode.NotFound, message: 'Logo not set.' });
    }
    return this.branding.open(key);
  }

  async openLogoLight() {
    const doc = await this.ensureDoc();
    const key = this.resolveLightLogoKey(doc);
    if (!key) {
      throw new NotFoundException({ error: ErrorCode.NotFound, message: 'Light logo not set.' });
    }
    return this.branding.open(key);
  }

  async openLogoDark() {
    const doc = await this.ensureDoc();
    const key = this.resolveDarkLogoKey(doc);
    if (!key) {
      throw new NotFoundException({ error: ErrorCode.NotFound, message: 'Dark logo not set.' });
    }
    return this.branding.open(key);
  }

  async openFavicon() {
    const doc = await this.ensureDoc();
    if (!doc.faviconKey) {
      throw new NotFoundException({ error: ErrorCode.NotFound, message: 'Favicon not set.' });
    }
    return this.branding.open(doc.faviconKey);
  }

  async resolveMailConfig(force = false): Promise<ResolvedMailConfig> {
    const now = Date.now();
    if (!force && this.mailCache && now - this.mailCache.at < 5_000) {
      return this.mailCache.value;
    }

    const doc = await this.ensureDoc();
    const envName = this.config.get<string>('APP_NAME') || 'AmarPin';
    const appName = doc.siteName?.trim() || envName;

    let value: ResolvedMailConfig;

    if (doc.smtpEnabled && doc.smtpHost?.trim()) {
      let password: string | undefined;
      if (doc.smtpPasswordEnc) {
        try {
          password = this.crypto.decrypt(doc.smtpPasswordEnc);
        } catch (error) {
          this.logger.warn(`Failed to decrypt SMTP password: ${error instanceof Error ? error.message : error}`);
        }
      }
      const port = doc.smtpPort || 587;
      const secure = doc.smtpSecure || port === 465;
      const transporter = nodemailer.createTransport({
        host: doc.smtpHost.trim(),
        port,
        secure,
        auth: doc.smtpUser
          ? {
              user: doc.smtpUser,
              pass: password || undefined,
            }
          : undefined,
      });

      const fromName = doc.mailFromName?.trim();
      const fromEmail = doc.mailFromEmail?.trim();
      const from =
        fromName && fromEmail
          ? `${fromName} <${fromEmail}>`
          : fromEmail || this.config.get<string>('MAIL_FROM') || `${appName} <noreply@localhost>`;

      value = { appName, from, transporter, source: 'database' };
    } else {
      const host = this.config.get<string>('SMTP_HOST')?.trim();
      if (host) {
        const port = this.config.get<number>('SMTP_PORT') ?? 587;
        const transporter = nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: this.config.get<string>('SMTP_USER')
            ? {
                user: this.config.get<string>('SMTP_USER'),
                pass: this.config.get<string>('SMTP_PASS'),
              }
            : undefined,
        });
        value = {
          appName,
          from: this.config.getOrThrow<string>('MAIL_FROM'),
          transporter,
          source: 'env',
        };
      } else {
        value = {
          appName,
          from: this.config.get<string>('MAIL_FROM') || `${appName} <noreply@localhost>`,
          transporter: null,
          source: 'none',
        };
      }
    }

    this.mailCache = { at: now, value };
    return value;
  }

  async testSmtp(to: string): Promise<SmtpTestResult> {
    const mail = await this.resolveMailConfig(true);
    if (!mail.transporter) {
      return {
        ok: false,
        message: 'SMTP is not configured. Save host/credentials in System settings or set SMTP_* env vars.',
      };
    }
    try {
      await mail.transporter.verify();
      await mail.transporter.sendMail({
        from: mail.from,
        to,
        subject: `${mail.appName} SMTP test`,
        text: `This is a test email from ${mail.appName}. SMTP is working.`,
      });
      return { ok: true, message: `Test email sent to ${to}.` };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'SMTP test failed.',
      };
    }
  }
}
