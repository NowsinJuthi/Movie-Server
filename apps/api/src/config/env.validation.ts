import { z } from 'zod';

const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((value) => {
    if (typeof value === 'boolean') {
      return value;
    }
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  });

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4001),
  APP_NAME: z.string().min(1).default('CineVault'),
  APP_URL: z.string().url(),
  API_URL: z.string().url(),
  API_PREFIX: z.string().min(1).default('api/v1'),
  MONGODB_URI: z.string().min(1),
  REDIS_HOST: z.string().min(1).default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES: z.string().min(2).default('15m'),
  JWT_REFRESH_EXPIRES_DAYS: z.coerce.number().int().positive().default(7),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
  COOKIE_SECURE: booleanish.default(false),
  COOKIE_DOMAIN: z.string().optional().default(''),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  THROTTLE_TTL_MS: z.coerce.number().int().positive().default(60_000),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),
  AUTH_THROTTLE_TTL_MS: z.coerce.number().int().positive().default(900_000),
  AUTH_THROTTLE_LIMIT: z.coerce.number().int().positive().default(8),
  LOCKOUT_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOCKOUT_DURATION_MINUTES: z.coerce.number().int().positive().default(15),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  MAIL_FROM: z.string().min(1).default('CineVault <noreply@localhost>'),
  BOOTSTRAP_SUPERADMIN_EMAIL: z.string().email().optional(),
  BOOTSTRAP_SUPERADMIN_PASSWORD: z.string().min(10).optional(),
  MAX_PROFILES_PER_ACCOUNT: z.coerce.number().int().min(1).max(8).default(5),
  AVATAR_MAX_BYTES: z.coerce.number().int().positive().default(2_097_152),
  AVATAR_UPLOAD_DIR: z.string().optional(),
  ARTWORK_MAX_BYTES: z.coerce.number().int().positive().default(5_242_880),
  ARTWORK_UPLOAD_DIR: z.string().optional(),
  SUBSCRIPTION_REQUIRE_PAYMENT: booleanish.default(false),
  SUBSCRIPTION_GRACE_DAYS: z.coerce.number().int().min(0).max(30).default(3),
  SUBSCRIPTION_DEFAULT_CURRENCY: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/)
    .default('USD'),
  PAYMENT_PROVIDER: z.enum(['stripe', 'fake']).optional(),
  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),
  STRIPE_PUBLISHABLE_KEY: z.string().optional().default(''),
  PAYMENT_WEBHOOK_SECRET: z.string().min(16).default('whsec_test_cinevault_webhook_secret'),
  CORS_ORIGINS: z.string().min(1),
  MEDIA_MOVIES_DIR: z.string().optional().default(''),
  MEDIA_TV_DIR: z.string().optional().default(''),
  FFPROBE_PATH: z.string().optional().default('ffprobe'),
  FFMPEG_PATH: z.string().optional().default('ffmpeg'),
  MEDIA_PROBE: z.enum(['auto', 'ffprobe', 'fake']).optional().default('auto'),
  TMDB_API_KEY: z.string().optional().default(''),
  LIBRARY_AUTO_IMPORT: booleanish.default(true),
  LIBRARY_AUTO_PUBLISH: booleanish.default(true),
  STREAM_SESSION_TTL_MS: z.coerce.number().int().positive().default(90_000),
  /** HMAC secret for signing license keys. Falls back to JWT_ACCESS_SECRET when empty. */
  LICENSE_MASTER_SECRET: z.string().optional().default(''),
  /** Optional pre-activated key applied on API boot. */
  LICENSE_KEY: z.string().optional().default(''),
  LICENSE_TRIAL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  LICENSE_SEAL_DIR: z.string().optional().default(''),
  /** Set true in automated tests only — never on production. */
  LICENSE_DISABLED: booleanish.default(false),
});

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  assertProductionSecrets(parsed.data);
  return parsed.data;
}

function isLocalUrl(value: string): boolean {
  try {
    const { hostname } = new URL(value);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

function assertProductionSecrets(env: AppEnv): void {
  if (env.NODE_ENV !== 'production' || isLocalUrl(env.APP_URL)) {
    return;
  }
  const problems: string[] = [];
  if (env.JWT_ACCESS_SECRET.includes('change-me') || env.JWT_ACCESS_SECRET.includes('test-access-secret')) {
    problems.push('JWT_ACCESS_SECRET must be a unique production secret');
  }
  if (env.PAYMENT_WEBHOOK_SECRET === 'whsec_test_cinevault_webhook_secret') {
    problems.push('PAYMENT_WEBHOOK_SECRET must not use the example value');
  }
  if (env.BOOTSTRAP_SUPERADMIN_PASSWORD === 'ChangeMe_Admin_123!') {
    problems.push('BOOTSTRAP_SUPERADMIN_PASSWORD must be changed before public deployment');
  }
  if (!env.COOKIE_SECURE) {
    problems.push('COOKIE_SECURE must be true when serving a public production origin');
  }
  if (env.PAYMENT_PROVIDER === 'fake') {
    problems.push('PAYMENT_PROVIDER=fake is not allowed on a public production origin');
  }
  if (env.LICENSE_DISABLED) {
    problems.push('LICENSE_DISABLED must be false on a public production origin');
  }
  if (problems.length) {
    throw new Error(`Invalid environment configuration: ${problems.join('; ')}`);
  }
}
