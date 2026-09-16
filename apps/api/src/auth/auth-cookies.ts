import { AUTH_COOKIE } from '@movie-server/shared';
import { ConfigService } from '@nestjs/config';
import { CookieOptions, Response } from 'express';
import { isLocalDevOrigin } from '../common/is-local-url';
import { parseExpiryToMs } from '../common/security/tokens';

export class AuthCookies {
  constructor(private readonly config: ConfigService) {}

  private isLocalDev(): boolean {
    if (this.config.get<string>('REDIS_HOST') === 'memory') {
      return true;
    }
    const nodeEnv = this.config.get<string>('NODE_ENV') ?? 'development';
    if (nodeEnv !== 'production') {
      return true;
    }
    return isLocalDevOrigin(
      this.config.get<string>('APP_URL'),
      this.config.get<string>('API_URL'),
    );
  }

  private base(): CookieOptions {
    const localDev = this.isLocalDev();
    const domain = localDev ? undefined : this.config.get<string>('COOKIE_DOMAIN') || undefined;
    const sameSite = this.config.get<'lax' | 'strict' | 'none'>('COOKIE_SAME_SITE') ?? 'lax';
    return {
      httpOnly: true,
      secure: localDev
        ? false
        : this.config.get<boolean>('COOKIE_SECURE') ||
          this.config.get('NODE_ENV') === 'production',
      sameSite,
      domain,
      path: '/',
    };
  }

  setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    const accessMs = parseExpiryToMs(this.config.getOrThrow<string>('JWT_ACCESS_EXPIRES'));
    const refreshDays = this.config.getOrThrow<number>('JWT_REFRESH_EXPIRES_DAYS');
    res.cookie(AUTH_COOKIE.Access, accessToken, { ...this.base(), maxAge: accessMs });
    res.cookie(AUTH_COOKIE.Refresh, refreshToken, {
      ...this.base(),
      maxAge: refreshDays * 86_400_000,
    });
  }

  clearAuthCookies(res: Response): void {
    const options = this.base();
    res.clearCookie(AUTH_COOKIE.Access, options);
    res.clearCookie(AUTH_COOKIE.Refresh, options);
  }
}
