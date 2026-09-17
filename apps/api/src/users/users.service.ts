import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { ErrorCode, UserRole, isEndUserRole } from '@movie-server/shared';
import { User, UserDocument } from './schemas/user.schema';
import { PasswordService } from '../auth/password.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectConnection() private readonly connection: Connection,
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
    staffProfileId?: string | null;
    emailVerified?: boolean;
  }): Promise<UserDocument> {
    const passwordHash = await this.passwordService.hash(input.password);
    const role = input.role ?? UserRole.User;
    const payload: Record<string, unknown> = {
      email: input.email.toLowerCase(),
      passwordHash,
      displayName: input.displayName,
      role,
      emailVerified: input.emailVerified ?? false,
      tokenVersion: 0,
    };
    if (role === UserRole.SuperAdmin) {
      payload.staffProfileId = 'super_admin';
    } else if (role === UserRole.Admin) {
      payload.staffProfileId = input.staffProfileId?.trim() || 'administrator';
    }
    return this.userModel.create(payload);
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
    staffProfileId?: string;
    isActive?: boolean;
    sort?: 'newest' | 'name' | 'email';
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
    const filter: Record<string, unknown> = {};
    if (query.role) filter.role = query.role;
    if (query.staffProfileId) filter.staffProfileId = query.staffProfileId;
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

  async findBySearchTerm(q: string, limit = 10) {
    const term = q.trim();
    if (!term) return [];
    const regex = new RegExp(escapeRegex(term), 'i');
    const items = await this.userModel
      .find({
        $or: [{ email: regex }, { displayName: regex }],
      })
      .sort({ displayName: 1, email: 1 })
      .limit(Math.min(Math.max(limit, 1), 20))
      .select('_id displayName email')
      .lean()
      .exec();
    return items.map((item) => ({
      id: String(item._id),
      displayName: item.displayName,
      email: item.email,
    }));
  }

  async suggestAdmin(q: string, limit = 10) {
    const term = q.trim();
    if (!term) return [];
    const regex = new RegExp(escapeRegex(term), 'i');
    const items = await this.userModel
      .find({
        $or: [{ email: regex }, { displayName: regex }],
      })
      .sort({ displayName: 1, email: 1 })
      .limit(Math.min(Math.max(limit, 1), 20))
      .select('_id displayName email role isActive')
      .lean()
      .exec();
    return items.map((item) => ({
      id: String(item._id),
      displayName: item.displayName,
      email: item.email,
      role: item.role,
      isActive: item.isActive,
    }));
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
    if (isEndUserRole(role)) {
      user.staffProfileId = undefined;
    } else if (role === UserRole.SuperAdmin) {
      user.staffProfileId = 'super_admin';
    } else if (role === UserRole.Admin && !user.staffProfileId?.trim()) {
      user.staffProfileId = 'administrator';
    }
    user.tokenVersion += 1;
    await user.save();
    return user;
  }

  async patchAdmin(
    userId: string,
    input: {
      displayName?: string;
      email?: string;
      isActive?: boolean;
      emailVerified?: boolean;
      staffProfileId?: string;
      subscriptionStaffRules?: {
        view?: boolean | null;
        manage?: boolean | null;
      };
      password?: string;
    },
  ) {
    const user = await this.userModel.findById(userId).select('+tokenVersion +passwordHash');
    if (!user) return null;

    if (input.displayName) {
      user.displayName = input.displayName.trim().slice(0, 80);
    }

    if (input.email) {
      const nextEmail = input.email.toLowerCase().trim();
      if (nextEmail !== user.email) {
        const taken = await this.userModel.exists({ email: nextEmail, _id: { $ne: user._id } });
        if (taken) {
          throw new ConflictException({
            error: ErrorCode.Conflict,
            message: 'An account with that email already exists.',
          });
        }
        user.email = nextEmail;
      }
    }

    if (input.emailVerified !== undefined) {
      user.emailVerified = input.emailVerified;
    }

    if (input.password) {
      user.passwordHash = await this.passwordService.hash(input.password);
      user.passwordChangedAt = new Date();
      user.tokenVersion += 1;
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

    if (input.staffProfileId !== undefined) {
      const next = input.staffProfileId.trim() || 'administrator';
      if (next !== (user.staffProfileId?.trim() || 'administrator')) {
        user.staffProfileId = next;
        if (user.role === UserRole.Admin) {
          user.tokenVersion += 1;
        }
      }
    }

    if (input.subscriptionStaffRules !== undefined) {
      const current = user.subscriptionStaffRules ?? { view: null, manage: null };
      const next = {
        view:
          input.subscriptionStaffRules.view === undefined
            ? current.view ?? null
            : input.subscriptionStaffRules.view,
        manage:
          input.subscriptionStaffRules.manage === undefined
            ? current.manage ?? null
            : input.subscriptionStaffRules.manage,
      };
      const changed =
        next.view !== (current.view ?? null) || next.manage !== (current.manage ?? null);
      if (changed) {
        user.subscriptionStaffRules = next;
        if (user.role === UserRole.Admin) {
          user.tokenVersion += 1;
        }
      }
    }

    await user.save();
    return user;
  }

  async deleteAdmin(userId: string, actorId: string): Promise<UserDocument | null> {
    if (userId === actorId) {
      throw new ForbiddenException({
        error: ErrorCode.Forbidden,
        message: 'You cannot delete your own account.',
      });
    }

    const user = await this.userModel.findById(userId);
    if (!user) return null;

    if (user.role === UserRole.SuperAdmin) {
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

    const oid = user._id;
    const profiles = await this.connection.collection('profiles').find({ userId: oid }, { projection: { _id: 1 } }).toArray();
    const profileIds = profiles.map((profile) => profile._id);

    await user.deleteOne();

    if (profileIds.length > 0) {
      await Promise.all([
        this.connection.collection('profiles').deleteMany({ userId: oid }),
        this.connection.collection('watch_history').deleteMany({ profileId: { $in: profileIds } }),
        this.connection.collection('my_list').deleteMany({ profileId: { $in: profileIds } }),
        this.connection.collection('recommendations').deleteMany({ profileId: { $in: profileIds } }),
        this.connection.collection('favorites').deleteMany({ profileId: { $in: profileIds } }),
        this.connection.collection('media_reactions').deleteMany({ profileId: { $in: profileIds } }),
        this.connection.collection('user_ratings').deleteMany({ profileId: { $in: profileIds } }),
      ]);
    }

    return user;
  }

  async updateDisplayName(userId: string, displayName: string) {
    const user = await this.userModel.findById(userId);
    if (!user) return null;
    user.displayName = displayName.trim().slice(0, 80);
    await user.save();
    return user;
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
