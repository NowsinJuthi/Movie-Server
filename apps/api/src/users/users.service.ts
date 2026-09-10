import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ErrorCode, UserRole } from '@movie-server/shared';
import { User, UserDocument } from './schemas/user.schema';
import { PasswordService } from '../auth/password.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly passwordService: PasswordService,
    private readonly config: ConfigService,
  ) {}

  findByEmail(email: string, withSecrets = false) {
    const query = this.userModel.findOne({ email: email.toLowerCase() });
    if (withSecrets) {
      query.select(
        '+passwordHash +tokenVersion +emailVerificationTokenHash +passwordResetTokenHash +failedLoginAttempts +lockUntil',
      );
    }
    return query.exec();
  }

  findById(id: string, withSecrets = false) {
    const query = this.userModel.findById(id);
    if (withSecrets) {
      query.select('+passwordHash +tokenVersion');
    }
    return query.exec();
  }

  findByIds(ids: string[]) {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return this.userModel.find({ _id: { $in: ids } }).select('email displayName').exec();
  }

  async createUser(input: {
    email: string;
    password: string;
    displayName: string;
    role?: UserRole;
    emailVerified?: boolean;
  }): Promise<UserDocument> {
    const passwordHash = await this.passwordService.hash(input.password);
    return this.userModel.create({
      email: input.email.toLowerCase(),
      passwordHash,
      displayName: input.displayName,
      role: input.role ?? UserRole.User,
      emailVerified: input.emailVerified ?? false,
      tokenVersion: 0,
    });
  }

  async incrementFailedLogins(user: UserDocument): Promise<void> {
    const maxAttempts = this.config.getOrThrow<number>('LOCKOUT_MAX_ATTEMPTS');
    const lockMinutes = this.config.getOrThrow<number>('LOCKOUT_DURATION_MINUTES');
    const attempts = (user.failedLoginAttempts ?? 0) + 1;
    user.failedLoginAttempts = attempts;
    if (attempts >= maxAttempts) {
      user.lockUntil = new Date(Date.now() + lockMinutes * 60 * 1000);
      user.failedLoginAttempts = 0;
    }
    await user.save();
  }

  async resetLockout(user: UserDocument): Promise<void> {
    if (user.failedLoginAttempts || user.lockUntil) {
      user.failedLoginAttempts = 0;
      user.lockUntil = undefined;
      await user.save();
    }
  }

  findByHashedToken(
    field: 'emailVerificationTokenHash' | 'passwordResetTokenHash',
    hash: string,
  ) {
    return this.userModel
      .findOne({ [field]: hash })
      .select('+passwordHash +tokenVersion +emailVerificationTokenHash +passwordResetTokenHash')
      .exec();
  }

  async countByRole(role: UserRole): Promise<number> {
    return this.userModel.countDocuments({ role }).exec();
  }

  async listUsers(limit = 50) {
    return this.userModel.find().sort({ createdAt: -1 }).limit(limit).exec();
  }

  async listAdmin(query: {
    q?: string;
    role?: UserRole;
    isActive?: boolean;
    sort?: 'newest' | 'name' | 'email';
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
    const filter: Record<string, unknown> = {};
    if (query.role) filter.role = query.role;
    if (query.isActive !== undefined) filter.isActive = query.isActive;
    if (query.q?.trim()) {
      const q = query.q.trim();
      filter.$or = [
        { email: new RegExp(escapeRegex(q), 'i') },
        { displayName: new RegExp(escapeRegex(q), 'i') },
      ];
    }
    const sort: Record<string, 1 | -1> =
      query.sort === 'name' ? { displayName: 1 } : query.sort === 'email' ? { email: 1 } : { createdAt: -1 };
    const [items, total] = await Promise.all([
      this.userModel.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).exec(),
      this.userModel.countDocuments(filter),
    ]);
    return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  async updateRole(userId: string, role: UserRole) {
    const user = await this.userModel.findById(userId).select('+tokenVersion');
    if (!user) {
      return null;
    }
    if (user.role === role) {
      return user;
    }
    user.role = role;
    user.tokenVersion += 1;
    await user.save();
    return user;
  }

  async patchAdmin(userId: string, input: { displayName?: string; isActive?: boolean }) {
    const user = await this.userModel.findById(userId).select('+tokenVersion');
    if (!user) return null;
    if (input.displayName) {
      user.displayName = input.displayName.trim().slice(0, 80);
    }
    if (input.isActive !== undefined && input.isActive !== user.isActive) {
      if (!input.isActive && user.role === UserRole.SuperAdmin) {
        const others = await this.userModel.countDocuments({
          _id: { $ne: user._id },
          role: UserRole.SuperAdmin,
          isActive: true,
        });
        if (others < 1) {
          throw new ForbiddenException({
            error: ErrorCode.Forbidden,
            message: 'Keep at least one active Super Admin.',
          });
        }
      }
      user.isActive = input.isActive;
      if (!input.isActive) {
        user.tokenVersion += 1;
      }
    }
    await user.save();
    return user;
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
