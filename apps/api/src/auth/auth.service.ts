import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AUTH_COOKIE, ErrorCode, PublicUser, UserRole } from '@movie-server/shared';
import { Request, Response } from 'express';
import { generateOpaqueToken, hashToken, parseExpiryToMs } from '../common/security/tokens';
import { MailService } from '../mail/mail.service';
import { RedisService } from '../redis/redis.service';
import { SessionsService } from '../sessions/sessions.service';
import { toPublicSession } from '../sessions/session.mapper';
import { DevicesService } from '../devices/devices.service';
import { parseUserAgent } from '../devices/device-ua';
import { evaluateSessionRisk } from '../devices/suspicious';
import { SubscriptionAccessService } from '../subscriptions/subscription-access.service';
import { PlaybackSessionStore } from '../stream/playback-session.store';
import { UserDocument } from '../users/schemas/user.schema';
import { toPublicUser } from '../users/user.mapper';
import { UsersService } from '../users/users.service';
import { AuthCookies } from './auth-cookies';
import { AccessTokenPayload, RequestUser } from './auth.types';
import { PasswordService } from './password.service';

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly cookies: AuthCookies;

  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    @Inject(forwardRef(() => DevicesService)) private readonly devices: DevicesService,
    private readonly access: SubscriptionAccessService,
    @Inject(forwardRef(() => PlaybackSessionStore)) private readonly playback: PlaybackSessionStore,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly redis: RedisService,
  ) {
    this.cookies = new AuthCookies(config);
  }

  async register(
    input: {
      email: string;
      password: string;
      displayName: string;
    },
    ip?: string,
  ): Promise<{ message: string; user: PublicUser }> {
    await this.enforceAuthRateLimit(ip, 'register');
    const existing = await this.users.findByEmail(input.email);
    if (existing) {
      throw new ConflictException({
        error: ErrorCode.Conflict,
        message: 'An account with that email already exists.',
      });
    }

    const user = await this.users.createUser(input);
    await this.issueEmailVerification(user);
    return {
      message: 'Account created. Check your email to verify your address.',
      user: toPublicUser(user),
    };
  }

  async login(
    input: { email: string; password: string; deviceId?: string; deviceName?: string },
    req: Request,
    res: Response,
  ): Promise<{ user: PublicUser }> {
    await this.enforceAuthRateLimit(req.ip, 'login');
    const user = await this.users.findByEmail(input.email, true);
    const passwordOk = await this.passwords.compare(input.password, user?.passwordHash);

    if (user?.lockUntil && user.lockUntil.getTime() > Date.now()) {
      throw new ForbiddenException({
        error: ErrorCode.AccountLocked,
        message: 'Account is temporarily locked after too many failed sign-in attempts.',
      });
    }

    if (!user || !passwordOk) {
      if (user) {
        await this.users.incrementFailedLogins(user);
      }
      throw new UnauthorizedException({
        error: ErrorCode.InvalidCredentials,
        message: 'Invalid email or password.',
      });
    }

    if (!user.isActive) {
      throw new ForbiddenException({
        error: ErrorCode.InactiveAccount,
        message: 'This account has been disabled.',
      });
    }

    if (!user.emailVerified) {
      throw new ForbiddenException({
        error: ErrorCode.EmailNotVerified,
        message: 'Verify your email before signing in.',
      });
    }

    await this.users.resetLockout(user);
    user.lastLoginAt = new Date();
    await user.save();
    await this.establishSession(user, req, res, {
      deviceId: input.deviceId,
      deviceName: input.deviceName,
    });
    return { user: toPublicUser(user) };
  }

  async logout(req: Request, res: Response, user?: RequestUser): Promise<{ message: string }> {
    const refreshToken = req.cookies?.[AUTH_COOKIE.Refresh] as string | undefined;
    if (refreshToken) {
      const session = await this.sessions.findActiveByRefreshToken(refreshToken);
      if (session) {
        const deviceKey = session.deviceKey;
        const userId = String(session.userId);
        await this.sessions.revoke(session);
        if (deviceKey && !(await this.sessions.hasActiveDevice(userId, deviceKey))) {
          await this.playback.stopForDevice(userId, deviceKey);
        }
      }
    }
    if (user) {
      await this.denyAccess(user);
    }
    this.cookies.clearAuthCookies(res);
    return { message: 'Signed out.' };
  }

  async logoutAll(res: Response, user: RequestUser): Promise<{ message: string }> {
    await this.playback.stopAllForUser(user.id);
    await this.devices.revokeAllForUser(user.id);
    await this.sessions.revokeAllForUser(user.id);
    const dbUser = await this.users.findById(user.id, true);
    if (dbUser) {
      dbUser.tokenVersion += 1;
      await dbUser.save();
    }
    await this.denyAccess(user);
    this.cookies.clearAuthCookies(res);
    return { message: 'Signed out of all sessions.' };
  }

  async listSessions(user: RequestUser) {
    const sessions = await this.sessions.listActiveForUser(user.id);
    return { sessions: sessions.map((item) => toPublicSession(item, user.sessionId)) };
  }

  async revokeSession(user: RequestUser, sessionId: string, res: Response) {
    const session = await this.sessions.revokeById(user.id, sessionId);
    if (!session) {
      throw new NotFoundException({
        error: ErrorCode.NotFound,
        message: 'Session not found.',
      });
    }
    if (session.deviceKey && !(await this.sessions.hasActiveDevice(user.id, session.deviceKey))) {
      await this.playback.stopForDevice(user.id, session.deviceKey);
    }
    const current = sessionId === user.sessionId;
    if (current) {
      await this.denyAccess(user);
      this.cookies.clearAuthCookies(res);
    }
    return { message: current ? 'Signed out.' : 'Session signed out.', current };
  }

  async refresh(req: Request, res: Response): Promise<{ user: PublicUser }> {
    const refreshToken = req.cookies?.[AUTH_COOKIE.Refresh] as string | undefined;
    if (!refreshToken) {
      throw new UnauthorizedException({
        error: ErrorCode.Unauthorized,
        message: 'Refresh token missing.',
      });
    }
    await this.enforceAuthRateLimit(req.ip, 'refresh');

    const reused = await this.sessions.findReusedRefreshToken(refreshToken);
    if (reused) {
      const grace = await this.sessions.findRefreshGrace(refreshToken);
      if (grace) {
        const user = await this.users.findById(String(reused.userId), true);
        if (user && user.isActive && !reused.revoked) {
          const accessToken = await this.signAccessToken(user, grace.sessionId);
          this.cookies.setAuthCookies(res, accessToken, grace.refreshToken);
          return { user: toPublicUser(user) };
        }
      }
      if (this.redis.isMemory) {
        this.cookies.clearAuthCookies(res);
        throw new UnauthorizedException({
          error: ErrorCode.InvalidToken,
          message: 'Invalid refresh token.',
        });
      }
      await this.sessions.markRefreshReuse(String(reused.userId));
      await this.playback.stopAllForUser(String(reused.userId));
      await this.sessions.revokeAllForUser(String(reused.userId));
      this.cookies.clearAuthCookies(res);
      throw new UnauthorizedException({
        error: ErrorCode.SessionRevoked,
        message: 'Refresh token reuse detected. All sessions were revoked.',
      });
    }

    const session = await this.sessions.findActiveByRefreshToken(refreshToken);
    if (!session) {
      this.cookies.clearAuthCookies(res);
      throw new UnauthorizedException({
        error: ErrorCode.InvalidToken,
        message: 'Invalid refresh token.',
      });
    }

    const user = await this.users.findById(String(session.userId), true);
    if (!user || !user.isActive) {
      await this.sessions.revoke(session);
      this.cookies.clearAuthCookies(res);
      throw new UnauthorizedException({
        error: ErrorCode.Unauthorized,
        message: 'Invalid refresh token.',
      });
    }

    const rotated = await this.sessions.rotate(session, this.refreshExpiry());
    const accessToken = await this.signAccessToken(user, String(rotated.session._id));
    this.cookies.setAuthCookies(res, accessToken, rotated.refreshToken);
    return { user: toPublicUser(user) };
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const user = await this.findUserByHashedToken('emailVerificationTokenHash', token);
    if (
      !user ||
      !user.emailVerificationExpiresAt ||
      user.emailVerificationExpiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedException({
        error: ErrorCode.InvalidToken,
        message: 'Verification link is invalid or has expired.',
      });
    }

    user.emailVerified = true;
    user.emailVerificationTokenHash = undefined;
    user.emailVerificationExpiresAt = undefined;
    await user.save();
    return { message: 'Email verified. You can now sign in.' };
  }

  async resendVerification(email: string, ip?: string): Promise<{ message: string }> {
    await this.enforceAuthRateLimit(ip, 'resend');
    const user = await this.users.findByEmail(email, true);
    if (user && !user.emailVerified) {
      await this.issueEmailVerification(user);
    }
    return { message: 'If an unverified account exists, a new email has been sent.' };
  }

  async forgotPassword(email: string, ip?: string): Promise<{ message: string }> {
    await this.enforceAuthRateLimit(ip, 'forgot');
    const user = await this.users.findByEmail(email, true);
    if (user && user.isActive) {
      const token = generateOpaqueToken();
      user.passwordResetTokenHash = hashToken(token);
      user.passwordResetExpiresAt = new Date(Date.now() + RESET_TTL_MS);
      await user.save();
      await this.mail.enqueuePasswordReset(user.email, user.displayName, token);
    }
    return { message: 'If an account exists, password reset instructions have been sent.' };
  }

  async resetPassword(token: string, password: string, ip?: string): Promise<{ message: string }> {
    await this.enforceAuthRateLimit(ip, 'reset');
    const user = await this.findUserByHashedToken('passwordResetTokenHash', token);
    if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException({
        error: ErrorCode.InvalidToken,
        message: 'Reset link is invalid or has expired.',
      });
    }

    user.passwordHash = await this.passwords.hash(password);
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;
    user.passwordChangedAt = new Date();
    user.tokenVersion += 1;
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();
    await this.playback.stopAllForUser(String(user._id));
    await this.sessions.revokeAllForUser(String(user._id));
    return { message: 'Password updated. Sign in with your new password.' };
  }

  async changePassword(
    userRef: RequestUser,
    currentPassword: string,
    newPassword: string,
    res: Response,
  ): Promise<{ message: string }> {
    const user = await this.users.findById(userRef.id, true);
    if (!user) {
      throw new UnauthorizedException({
        error: ErrorCode.Unauthorized,
        message: 'Authentication required.',
      });
    }
    const ok = await this.passwords.compare(currentPassword, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({
        error: ErrorCode.InvalidCredentials,
        message: 'Current password is incorrect.',
      });
    }
    user.passwordHash = await this.passwords.hash(newPassword);
    user.passwordChangedAt = new Date();
    user.tokenVersion += 1;
    await user.save();
    await this.playback.stopAllForUser(userRef.id);
    await this.sessions.revokeAllForUser(userRef.id);
    this.cookies.clearAuthCookies(res);
    return { message: 'Password changed. Please sign in again.' };
  }

  async me(userRef: RequestUser): Promise<{ user: PublicUser }> {
    const user = await this.users.findById(userRef.id);
    if (!user) {
      throw new UnauthorizedException({
        error: ErrorCode.Unauthorized,
        message: 'Authentication required.',
      });
    }
    return { user: toPublicUser(user) };
  }

  async updateAccount(userRef: RequestUser, displayName: string): Promise<{ user: PublicUser }> {
    const user = await this.users.updateDisplayName(userRef.id, displayName);
    if (!user) {
      throw new UnauthorizedException({
        error: ErrorCode.Unauthorized,
        message: 'Authentication required.',
      });
    }
    return { user: toPublicUser(user) };
  }

  async validateAccessPayload(payload: AccessTokenPayload, clientIp?: string): Promise<RequestUser> {
    if (payload.typ !== 'access') {
      throw new UnauthorizedException({
        error: ErrorCode.InvalidToken,
        message: 'Invalid access token.',
      });
    }

    const denied = await this.redis.client.get(`auth:deny:${payload.jti}`);
    if (denied) {
      throw new UnauthorizedException({
        error: ErrorCode.SessionRevoked,
        message: 'Session has been revoked.',
      });
    }

    const session = await this.sessions.findById(payload.sid);
    if (!session || session.revoked || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException({
        error: ErrorCode.SessionRevoked,
        message: 'Session has been revoked.',
      });
    }

    const user = await this.users.findById(payload.sub, true);
    if (!user || !user.isActive) {
      throw new UnauthorizedException({
        error: ErrorCode.Unauthorized,
        message: 'Authentication required.',
      });
    }
    if (user.tokenVersion !== payload.tv) {
      throw new UnauthorizedException({
        error: ErrorCode.SessionRevoked,
        message: 'Session has been revoked.',
      });
    }

    const ip = clientIp?.trim() || undefined;
    await this.sessions.touch(payload.sid, ip ? { ip } : undefined);
    if (session.deviceKey) {
      await this.devices.touch(String(user._id), session.deviceKey, ip ? { ip } : undefined);
    }

    const rules = user.subscriptionStaffRules;
    return {
      id: String(user._id),
      email: user.email,
      role: user.role,
      staffProfileId: user.staffProfileId?.trim() || null,
      subscriptionStaffRules:
        user.role === UserRole.Admin || user.role === UserRole.SuperAdmin
          ? {
              view: rules?.view ?? null,
              manage: rules?.manage ?? null,
            }
          : null,
      sessionId: payload.sid,
      tokenVersion: user.tokenVersion,
      jti: payload.jti,
      activeProfileId: session.activeProfileId ? String(session.activeProfileId) : null,
      deviceKey: session.deviceKey || null,
    };
  }

  private async enforceAuthRateLimit(ip: string | undefined, action: string): Promise<void> {
    // Local dev uses in-memory Redis; production VPS keeps IP throttling enabled.
    if (this.redis.isMemory) {
      return;
    }
    const nodeEnv = this.config.get<string>('NODE_ENV') ?? 'development';
    if (nodeEnv !== 'production') {
      return;
    }
    const limit = this.config.get<number>('AUTH_THROTTLE_LIMIT') ?? 8;
    const ttl = this.config.get<number>('AUTH_THROTTLE_TTL_MS') ?? 900_000;
    const key = `auth:rl:${action}:${ip || 'unknown'}`;
    const hits = await this.redis.client.incr(key);
    if (hits === 1) {
      await this.redis.client.pexpire(key, ttl);
    }
    if (hits > limit) {
      throw new HttpException(
        {
          error: ErrorCode.TooManyRequests,
          message: 'Too many authentication attempts. Please try again later.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async issueEmailVerification(user: UserDocument): Promise<void> {
    const token = generateOpaqueToken();
    user.emailVerificationTokenHash = hashToken(token);
    user.emailVerificationExpiresAt = new Date(Date.now() + VERIFY_TTL_MS);
    await user.save();
    await this.mail.enqueueVerification(user.email, user.displayName, token);
  }

  private async establishSession(
    user: UserDocument,
    req: Request,
    res: Response,
    deviceInput?: { deviceId?: string; deviceName?: string },
  ): Promise<void> {
    const userId = String(user._id);
    const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : '';
    const ip = req.ip ?? '';
    const parsed = parseUserAgent(userAgent);
    const previous = await this.sessions.previousForUser(userId);
    const liveIps = await this.sessions.activeDistinctIps(userId);
    const { device, isNew } = await this.devices.upsertFromAuth({
      userId,
      deviceKey: deviceInput?.deviceId,
      deviceName: deviceInput?.deviceName,
      userAgent,
      ip,
    });
    const createdLastDay = await this.devices.createdLastDay(userId);
    const entitlement = await this.access.getEntitlement(userId);
    const minutesSincePreviousSession =
      previous != null ? (Date.now() - previous.createdAt.getTime()) / 60_000 : null;
    const risk = evaluateSessionRisk({
      currentIp: ip,
      previousIps: liveIps,
      activeDistinctIps: [...liveIps, ip].filter(Boolean),
      isNewDevice: isNew,
      devicesCreatedLastDay: createdLastDay,
      maxDevices: Math.max(entitlement.maxDevices, 1),
      minutesSincePreviousSession,
      previousIp: previous?.ip ?? null,
    });
    if (device && risk.suspicious) {
      await this.devices.markSuspicious(String(device._id), risk.flags);
    }
    const { session, refreshToken } = await this.sessions.create({
      userId,
      userAgent,
      ip,
      expiresAt: this.refreshExpiry(),
      deviceId: device ? String(device._id) : null,
      deviceKey: device?.deviceKey ?? '',
      clientName: (deviceInput?.deviceName || device?.name || parsed.name).slice(0, 80),
      deviceType: parsed.type,
      browser: parsed.browser ?? '',
      suspicious: risk.suspicious,
      flags: risk.flags,
    });
    const accessToken = await this.signAccessToken(user, String(session._id));
    this.cookies.setAuthCookies(res, accessToken, refreshToken);
  }

  private async signAccessToken(user: UserDocument, sessionId: string): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: String(user._id),
      email: user.email,
      role: user.role,
      tv: user.tokenVersion ?? 0,
      sid: sessionId,
      jti: generateOpaqueToken(16),
      typ: 'access',
    };
    return this.jwt.signAsync(payload);
  }

  private async denyAccess(user: RequestUser): Promise<void> {
    const ttl = Math.ceil(
      parseExpiryToMs(this.config.getOrThrow<string>('JWT_ACCESS_EXPIRES')) / 1000,
    );
    await this.redis.client.set(`auth:deny:${user.jti}`, '1', 'EX', ttl);
    await this.redis.client.del(`auth:session:${user.sessionId}`);
  }

  private refreshExpiry(): Date {
    const days = this.config.getOrThrow<number>('JWT_REFRESH_EXPIRES_DAYS');
    return new Date(Date.now() + days * 86_400_000);
  }

  private findUserByHashedToken(
    field: 'emailVerificationTokenHash' | 'passwordResetTokenHash',
    token: string,
  ) {
    return this.users.findByHashedToken(field, hashToken(token));
  }
}
