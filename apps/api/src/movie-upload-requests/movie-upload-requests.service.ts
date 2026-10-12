import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ErrorCode,
  ContentUploadRequestKind,
  MovieUploadRequestStatus,
  type AdminPage,
  type MovieUploadRequestRow,
} from '@movie-server/shared';
import { SiteSettingsService } from '../settings/site-settings.service';
import { ProfileAccessService } from '../profiles/profile-access.service';
import { UsersService } from '../users/users.service';
import type { RequestUser } from '../auth/auth.types';
import { CreateMovieUploadRequestDto } from './dto/create-movie-upload-request.dto';
import { QueryMovieUploadRequestsDto } from './dto/query-movie-upload-requests.dto';
import { UpdateMovieUploadRequestDto } from './dto/update-movie-upload-request.dto';
import {
  MovieUploadRequest,
  MovieUploadRequestDocument,
} from './schemas/movie-upload-request.schema';
import { toMovieUploadRequestRow } from './movie-upload-request.mapper';

@Injectable()
export class MovieUploadRequestsService {
  constructor(
    @InjectModel(MovieUploadRequest.name)
    private readonly model: Model<MovieUploadRequestDocument>,
    private readonly settings: SiteSettingsService,
    private readonly profileAccess: ProfileAccessService,
    private readonly users: UsersService,
  ) {}

  async assertFeatureEnabled(): Promise<void> {
    if (!(await this.settings.isMovieUploadRequestsEnabled())) {
      throw new ForbiddenException({
        error: ErrorCode.Forbidden,
        message: 'Movie upload requests are not available right now.',
      });
    }
  }

  async create(user: RequestUser, dto: CreateMovieUploadRequestDto): Promise<MovieUploadRequestRow> {
    await this.assertFeatureEnabled();

    const title = dto.title.trim();
    if (!title) {
      throw new BadRequestException({
        error: ErrorCode.ValidationFailed,
        message: 'Title is required.',
      });
    }

    const account = await this.users.findById(user.id);
    if (!account) {
      throw new NotFoundException({
        error: ErrorCode.NotFound,
        message: 'User not found.',
      });
    }

    let profileId: string | null = null;
    let profileName: string | null = null;
    const profileRef = dto.profileId ?? user.activeProfileId;
    if (profileRef) {
      const profile = await this.profileAccess.getOwned(user.id, profileRef);
      profileId = String(profile._id);
      profileName = profile.name;
    }

    const kind =
      dto.kind === ContentUploadRequestKind.Tv
        ? ContentUploadRequestKind.Tv
        : ContentUploadRequestKind.Movie;

    const doc = await this.model.create({
      kind,
      title,
      year: dto.year ?? null,
      note: dto.note?.trim() || null,
      userId: user.id,
      userEmail: user.email,
      userDisplayName: account.displayName,
      profileId,
      profileName,
      status: MovieUploadRequestStatus.Pending,
    });

    return toMovieUploadRequestRow(doc);
  }

  async listMine(user: RequestUser): Promise<MovieUploadRequestRow[]> {
    await this.assertFeatureEnabled();
    const docs = await this.model.find({ userId: user.id }).sort({ createdAt: -1 }).limit(50).exec();
    return docs.map(toMovieUploadRequestRow);
  }

  async adminList(query: QueryMovieUploadRequestsDto): Promise<AdminPage<MovieUploadRequestRow>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const filter: Record<string, unknown> = {};
    if (query.status) {
      filter.status = query.status;
    }
    if (query.kind) {
      filter.kind = query.kind;
    }
    if (query.q?.trim()) {
      const q = query.q.trim();
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { userEmail: { $regex: q, $options: 'i' } },
        { userDisplayName: { $regex: q, $options: 'i' } },
      ];
    }

    const [docs, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.model.countDocuments(filter),
    ]);

    return {
      items: docs.map(toMovieUploadRequestRow),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async adminUpdate(id: string, dto: UpdateMovieUploadRequestDto): Promise<MovieUploadRequestRow> {
    const doc = await this.model.findById(id);
    if (!doc) {
      throw new NotFoundException({
        error: ErrorCode.NotFound,
        message: 'Request not found.',
      });
    }
    if (dto.status !== undefined) {
      doc.status = dto.status;
    }
    if (dto.adminNote !== undefined) {
      doc.adminNote = dto.adminNote.trim() || null;
    }
    await doc.save();
    return toMovieUploadRequestRow(doc);
  }

  async countPending(): Promise<number> {
    return this.model.countDocuments({ status: MovieUploadRequestStatus.Pending });
  }
}
