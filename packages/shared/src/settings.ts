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

export type AdminSiteSettings = {
  siteName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  smtp: AdminSmtpSettings;
  /** True when SMTP can send (DB or env fallback). */
  smtpReady: boolean;
  source: {
    siteName: 'database' | 'env';
    smtp: 'database' | 'env' | 'none';
  };
};

export type UpdateSiteSettingsInput = {
  siteName?: string;
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
