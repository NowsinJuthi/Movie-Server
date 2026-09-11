import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ErrorCode,
  MAX_PROFILES_PER_ACCOUNT,
  MaturityLevel,
  PRESET_AVATARS,
  type ProfileLanguage,
  type PublicProfile,
  type SubtitleLanguage,
} from '@movie-server/shared';
import { RequestUser } from '../auth/auth.types';
import { PasswordService } from '../auth/password.service';
import { SessionsService } from '../sessions/sessions.service';
import { UsersService } from '../users/users.service';
import { sniffImageMime } from '../common/security/image-bytes';
import { AvatarsService } from './avatars.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileAccessService } from './profile-access.service';
import { toPublicProfile } from './profile.mapper';
import { Profile, ProfileDocument } from './schemas/profile.schema';
import { WatchHistory } from './schemas/watch-history.schema';
import { MyListItem } from './schemas/my-list.schema';
import { Recommendation } from './schemas/recommendation.schema';
import { Favorite } from './schemas/favorite.schema';
import { MediaReactionDoc } from './schemas/media-reaction.schema';
import { UserRating } from './schemas/user-rating.schema';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectModel(Profile.name) private readonly profileModel: Model<ProfileDocument>,
    @InjectModel(WatchHistory.name) private readonly historyModel: Model<WatchHistory>,
    @InjectModel(MyListItem.name) private readonly listModel: Model<MyListItem>,
    @InjectModel(Recommendation.name) private readonly recommendationModel: Model<Recommendation>,
    @InjectModel(Favorite.name) private readonly favoriteModel: Model<Favorite>,
    @InjectModel(MediaReactionDoc.name) private readonly reactionModel: Model<MediaReactionDoc>,
    @InjectModel(UserRating.name) private readonly ratingModel: Model<UserRating>,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionsService,
    private readonly users: UsersService,
    private readonly avatars: AvatarsService,
    private readonly access: ProfileAccessService,
  ) {}

  async listAdmin(query: { q?: string; userId?: string; page?: number; limit?: number }) {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
    const filter: Record<string, unknown> = {};
    if (query.userId) {
      filter.userId = new Types.ObjectId(query.userId);
    }
    if (query.q?.trim()) {
      filter.name = new RegExp(query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }
    const [items, total] = await Promise.all([
      this.profileModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.profileModel.countDocuments(filter),
    ]);
    const userIds = [...new Set(items.map((item) => String(item.userId)))];
    const users = await this.users.findByIds(userIds);
    const byId = new Map(users.map((user) => [String(user._id), user]));
    return {
      items: items.map((item) => ({
        ...toPublicProfile(item),
        userEmail: byId.get(String(item.userId))?.email ?? '',
        userDisplayName: byId.get(String(item.userId))?.displayName ?? '',
      })),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async adminRemove(profileId: string): Promise<{ message: string }> {
    const profile = await this.profileModel.findById(profileId);
    if (!profile) {
      throw new NotFoundException({
        error: ErrorCode.NotFound,
        message: 'Profile not found.',
      });
    }
    return this.remove(String(profile.userId), profileId);
  }

  async list(userId: string): Promise<PublicProfile[]> {
    const user = await this.users.findById(userId);
    await this.ensureDefault(userId, user?.displayName);
    const profiles = await this.profileModel.find({ userId: new Types.ObjectId(userId) }).sort({
      isDefault: -1,
      createdAt: 1,
    });
    return profiles.map(toPublicProfile);
  }

  async get(userId: string, profileId: string): Promise<PublicProfile> {
    const profile = await this.access.getOwned(userId, profileId);
    return toPublicProfile(profile);
  }

  async create(userId: string, dto: CreateProfileDto): Promise<PublicProfile> {
    const count = await this.profileModel.countDocuments({ userId: new Types.ObjectId(userId) });
    const max = MAX_PROFILES_PER_ACCOUNT;
    if (count >= max) {
      throw new ForbiddenException({
        error: ErrorCode.ProfileLimitReached,
        message: `You can have up to ${max} profiles.`,
      });
    }

    const isFirst = count === 0;
    const isKids = Boolean(dto.isKids);
    try {
      const profile = await this.profileModel.create({
        userId: new Types.ObjectId(userId),
        name: dto.name,
        avatarKey: dto.avatarKey ?? PRESET_AVATARS[count % PRESET_AVATARS.length],
        isKids,
        isDefault: isFirst,
        language: (dto.language ?? 'en') as ProfileLanguage,
        audioLanguage: (dto.audioLanguage ?? dto.language ?? 'en') as ProfileLanguage,
        subtitleLanguage: (dto.subtitleLanguage ?? 'off') as SubtitleLanguage,
        maturityLevel: isKids ? MaturityLevel.Kids : (dto.maturityLevel ?? MaturityLevel.Mature),
        hasPin: Boolean(dto.pin),
        pinHash: dto.pin ? await this.passwords.hash(dto.pin) : undefined,
      });
      return toPublicProfile(profile);
    } catch (error) {
      this.rethrowDuplicateName(error);
      throw error;
    }
  }

  async ensureDefault(userId: string, displayName = 'Profile'): Promise<ProfileDocument> {
    const existing = await this.profileModel.findOne({ userId: new Types.ObjectId(userId) });
    if (existing) {
      return existing;
    }
    return this.profileModel.create({
      userId: new Types.ObjectId(userId),
      name: displayName.slice(0, 20) || 'Profile',
      avatarKey: PRESET_AVATARS[0],
      isDefault: true,
      isKids: false,
      language: 'en',
      audioLanguage: 'en',
      subtitleLanguage: 'off',
      maturityLevel: MaturityLevel.Mature,
      hasPin: false,
    });
  }

  async update(userId: string, profileId: string, dto: UpdateProfileDto): Promise<PublicProfile> {
    const profile = await this.access.getOwned(userId, profileId);
    if (dto.name) {
      profile.name = dto.name;
    }
    if (dto.avatarKey) {
      profile.avatarKey = dto.avatarKey;
    }
    if (dto.language) {
      profile.language = dto.language as ProfileLanguage;
    }
    if (dto.audioLanguage) {
      profile.audioLanguage = dto.audioLanguage as ProfileLanguage;
    }
    if (dto.subtitleLanguage) {
      profile.subtitleLanguage = dto.subtitleLanguage as SubtitleLanguage;
    }
    if (typeof dto.isKids === 'boolean') {
      profile.isKids = dto.isKids;
      if (dto.isKids) {
        profile.maturityLevel = MaturityLevel.Kids;
      }
    }
    if (dto.maturityLevel && !profile.isKids) {
      profile.maturityLevel = dto.maturityLevel;
    }
    try {
      await profile.save();
    } catch (error) {
      this.rethrowDuplicateName(error);
      throw error;
    }
    return toPublicProfile(profile);
  }

  async rememberPlaybackPrefs(
    userId: string,
    profileId: string,
    prefs: { audioLanguage?: ProfileLanguage; subtitleLanguage?: SubtitleLanguage },
  ): Promise<void> {
    const profile = await this.access.getOwned(userId, profileId);
    if (prefs.audioLanguage) {
      profile.audioLanguage = prefs.audioLanguage;
    }
    if (prefs.subtitleLanguage !== undefined) {
      profile.subtitleLanguage = prefs.subtitleLanguage;
    }
    await profile.save();
  }

  async remove(userId: string, profileId: string, sessionId?: string): Promise<{ message: string }> {
    const count = await this.profileModel.countDocuments({ userId: new Types.ObjectId(userId) });
    if (count <= 1) {
      throw new ForbiddenException({
        error: ErrorCode.Forbidden,
        message: 'You must keep at least one profile.',
      });
    }
    const profile = await this.access.getOwned(userId, profileId);
    const wasDefault = profile.isDefault;
    await this.avatars.remove(userId, profile.avatarFileName);
    const id = profile._id;
    await profile.deleteOne();
    await Promise.all([
      this.historyModel.deleteMany({ profileId: id }),
      this.listModel.deleteMany({ profileId: id }),
      this.recommendationModel.deleteMany({ profileId: id }),
      this.favoriteModel.deleteMany({ profileId: id }),
      this.reactionModel.deleteMany({ profileId: id }),
      this.ratingModel.deleteMany({ profileId: id }),
    ]);
    if (wasDefault) {
      const next = await this.profileModel.findOne({ userId: new Types.ObjectId(userId) }).sort({
        createdAt: 1,
      });
      if (next) {
        next.isDefault = true;
        await next.save();
      }
    }
    if (sessionId) {
      const session = await this.sessions.findById(sessionId);
      if (session && String(session.activeProfileId ?? '') === profileId) {
        await this.sessions.setActiveProfile(sessionId, null);
      }
    }
    return { message: 'Profile deleted.' };
  }

  async select(
    userId: string,
    profileId: string,
    sessionId: string,
    pin?: string,
  ): Promise<PublicProfile> {
    const profile = await this.access.getOwned(userId, profileId, true);
    if (profile.hasPin || profile.pinHash) {
      await this.assertPin(profile, pin);
    }
    profile.lastSelectedAt = new Date();
    profile.failedPinAttempts = 0;
    profile.pinLockUntil = undefined;
    await profile.save();
    await this.sessions.setActiveProfile(sessionId, profileId);
    return toPublicProfile(profile);
  }

  async ensureSessionProfile(user: RequestUser): Promise<string> {
    if (user.activeProfileId) {
      return user.activeProfileId;
    }
    const restored = await this.getActive(user.id, user.sessionId);
    if (restored?.id) {
      user.activeProfileId = restored.id;
      return restored.id;
    }
    const profiles = await this.list(user.id);
    const pick = profiles.find((profile) => profile.isDefault) ?? profiles[0];
    if (!pick) {
      throw new BadRequestException({
        error: ErrorCode.ValidationFailed,
        message: 'Create a profile before watching.',
      });
    }
    if (pick.hasPin) {
      throw new BadRequestException({
        error: ErrorCode.ProfilePinRequired,
        message: 'Select a profile before watching.',
      });
    }
    await this.select(user.id, pick.id, user.sessionId);
    user.activeProfileId = pick.id;
    return pick.id;
  }

  async getActive(userId: string, sessionId: string): Promise<PublicProfile | null> {
    const session = await this.sessions.findById(sessionId);
    if (session?.activeProfileId) {
      const profile = await this.profileModel.findOne({
        _id: session.activeProfileId,
        userId: new Types.ObjectId(userId),
      });
      if (profile) {
        return toPublicProfile(profile);
      }
    }
    // Admin → App often skips /profiles; auto-pick the default profile when it has no PIN.
    const fallback = await this.profileModel
      .findOne({ userId: new Types.ObjectId(userId), isDefault: true })
      .sort({ createdAt: 1 });
    const candidate =
      fallback ??
      (await this.profileModel.findOne({ userId: new Types.ObjectId(userId) }).sort({ createdAt: 1 }));
    if (!candidate || candidate.hasPin || candidate.pinHash) {
      return null;
    }
    candidate.lastSelectedAt = new Date();
    await candidate.save();
    await this.sessions.setActiveProfile(sessionId, String(candidate._id));
    return toPublicProfile(candidate);
  }

  async setPin(
    userId: string,
    profileId: string,
    pin: string,
    currentPin?: string,
  ): Promise<PublicProfile> {
    const profile = await this.access.getOwned(userId, profileId, true);
    if (profile.pinHash) {
      await this.assertPin(profile, currentPin);
    }
    profile.pinHash = await this.passwords.hash(pin);
    profile.hasPin = true;
    profile.failedPinAttempts = 0;
    profile.pinLockUntil = undefined;
    await profile.save();
    return toPublicProfile(profile);
  }

  async clearPin(userId: string, profileId: string, currentPin: string): Promise<PublicProfile> {
    const profile = await this.access.getOwned(userId, profileId, true);
    await this.assertPin(profile, currentPin);
    profile.pinHash = undefined;
    profile.hasPin = false;
    profile.failedPinAttempts = 0;
    profile.pinLockUntil = undefined;
    await profile.save();
    return toPublicProfile(profile);
  }

  async setAvatar(
    userId: string,
    profileId: string,
    file: { mimetype: string; buffer: Buffer; size: number },
  ): Promise<PublicProfile> {
    const mime = sniffImageMime(file.buffer);
    if (!mime || !this.avatars.isAllowed(mime) || file.size > this.avatars.maxBytes()) {
      throw new HttpException(
        {
          error: ErrorCode.ValidationFailed,
          message: 'Avatar must be a JPG, PNG, or WebP image under 2 MB.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    const profile = await this.access.getOwned(userId, profileId);
    const previous = profile.avatarFileName;
    const fileName = await this.avatars.save(userId, { mimetype: mime, buffer: file.buffer });
    profile.avatarFileName = fileName;
    await profile.save();
    await this.avatars.remove(userId, previous);
    return toPublicProfile(profile);
  }

  async clearAvatar(userId: string, profileId: string): Promise<PublicProfile> {
    const profile = await this.access.getOwned(userId, profileId);
    await this.avatars.remove(userId, profile.avatarFileName);
    profile.avatarFileName = null;
    await profile.save();
    return toPublicProfile(profile);
  }

  private async assertPin(profile: ProfileDocument, pin?: string): Promise<void> {
    if (profile.pinLockUntil && profile.pinLockUntil.getTime() > Date.now()) {
      throw new ForbiddenException({
        error: ErrorCode.ProfileLocked,
        message: 'This profile is temporarily locked after too many PIN attempts.',
      });
    }
    if (!pin) {
      throw new ForbiddenException({
        error: ErrorCode.ProfilePinRequired,
        message: 'This profile is PIN protected.',
      });
    }
    const ok = await this.passwords.compare(pin, profile.pinHash);
    if (ok) {
      return;
    }
    profile.failedPinAttempts = (profile.failedPinAttempts ?? 0) + 1;
    if (profile.failedPinAttempts >= 5) {
      profile.pinLockUntil = new Date(Date.now() + 15 * 60 * 1000);
      profile.failedPinAttempts = 0;
    }
    await profile.save();
    throw new UnauthorizedException({
      error: ErrorCode.ProfilePinInvalid,
      message: 'Incorrect PIN.',
    });
  }

  private rethrowDuplicateName(error: unknown): void {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: number }).code === 11000
    ) {
      throw new ConflictException({
        error: ErrorCode.Conflict,
        message: 'A profile with that name already exists.',
      });
    }
  }
}
