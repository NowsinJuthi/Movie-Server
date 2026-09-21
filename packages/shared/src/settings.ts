export type PublicBranding = {
  siteName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
};

export type AdminSmtpSettings = {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  /** Never returns the real password — only whether one is stored. */
  passwordSet: boolean;
  fromName: string;
  fromEmail: string;
  /** Effective From header preview */
  fromHeader: string;
};

export type AdminEmailDomainSettings = {
  allowlist: string[];
  blocklist: string[];
  allowlistEnabled: boolean;
};

export type AdminSiteSettings = {
  siteName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  smtp: AdminSmtpSettings;
  /** True when SMTP can send (DB or env fallback). */
  smtpReady: boolean;
  /** When true, members see “Request movie” in the header and can submit titles. */
  movieUploadRequestsEnabled: boolean;
  emailDomains: AdminEmailDomainSettings;
  source: {
    siteName: 'database' | 'env';
    smtp: 'database' | 'env' | 'none';
  };
};

export type PublicRegistrationEmailPolicy = {
  allowlistEnabled: boolean;
  allowedDomains?: string[];
};

export type UpdateSiteSettingsInput = {
  siteName?: string;
  movieUploadRequestsEnabled?: boolean;
  emailDomains?: {
    allowlist?: string[];
    blocklist?: string[];
    allowlistEnabled?: boolean;
  };
  smtp?: {
    enabled?: boolean;
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    /** Omit or empty to keep existing; send a value to replace. */
    password?: string;
    fromName?: string;
    fromEmail?: string;
  };
};

export type SmtpTestResult = {
  ok: boolean;
  message: string;
};
