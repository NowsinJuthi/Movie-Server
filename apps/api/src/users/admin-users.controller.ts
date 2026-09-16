import {
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ErrorCode,
  UserRole,
  canAssignRole,
  isStaffRole,
  type AdminUserRow,
} from '@movie-server/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { toAdminUserRow, toPublicUser } from './user.mapper';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { PatchUserDto, QueryUserSuggestDto, QueryUsersDto } from './dto/query-users.dto';
import { SessionsService } from '../sessions/sessions.service';
import { AdminUserSubscriptionService } from './admin-user-subscription.service';
import { UserDocument } from './schemas/user.schema';
import { RequestUser } from '../auth/auth.types';
import { Permissions } from '../common/decorators/permissions.decorator';

@Controller('admin/users')
@Roles(UserRole.Admin)
export class AdminUsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly sessions: SessionsService,
    private readonly subscriptions: AdminUserSubscriptionService,
  ) {}

  @Get('suggest')
  @Permissions('view_users')
  async suggest(@Query() query: QueryUserSuggestDto) {
    const users = await this.usersService.suggestAdmin(query.q, query.limit);
    return { users };
  }

  @Get()
  @Permissions('view_users')
  async list(@Query() query: QueryUsersDto) {
    const result = await this.usersService.listAdmin(query);
    const summaries = await this.subscriptions.summariesForUsers(
      result.items.map((user) => String(user._id)),
    );
    const items = result.items.map((user) => toAdminUser(user, summaries.get(String(user._id)) ?? null));
    return {
      users: items,
      items,
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    };
  }

  @Post()
  @Permissions('manage_users')
  async create(@CurrentUser() actor: RequestUser, @Body() dto: CreateAdminUserDto) {
    const role = dto.role ?? UserRole.User;
    if (!canAssignRole(actor.role, role)) {
      throw new ForbiddenException({
        error: ErrorCode.Forbidden,
        message: 'You cannot create accounts with that role.',
      });
    }

    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException({
        error: ErrorCode.Conflict,
        message: 'An account with that email already exists.',
      });
    }

    const user = await this.usersService.createUser({
      email: dto.email,
      displayName: dto.displayName,
      password: dto.password,
      role,
      emailVerified: dto.emailVerified ?? true,
    });

    return { user: toAdminUser(user) };
  }

  @Patch(':id')
  @Permissions('manage_users')
  async patch(
    @CurrentUser() actor: RequestUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: PatchUserDto,
  ) {
    const existing = await this.usersService.findById(id);
    if (!existing) {
      throw new NotFoundException({ error: ErrorCode.NotFound, message: 'User not found.' });
    }
    this.assertCanManage(actor, existing.role);

    if (dto.role !== undefined && dto.role !== existing.role) {
      if (isStaffRole(existing.role) && actor.role !== UserRole.SuperAdmin) {
        throw new ForbiddenException({
          error: ErrorCode.Forbidden,
          message: 'Only Super Admin can change staff roles.',
        });
      }
      if (!canAssignRole(actor.role, dto.role)) {
        throw new ForbiddenException({
          error: ErrorCode.Forbidden,
          message: 'You cannot assign that role.',
        });
      }
      await this.usersService.updateRole(id, dto.role);
    }

    const password = dto.password?.trim() ? dto.password.trim() : undefined;
    const user = await this.usersService.patchAdmin(id, {
      displayName: dto.displayName,
      email: dto.email,
      isActive: dto.isActive,
      emailVerified: dto.emailVerified,
      staffProfileId: dto.staffProfileId,
      subscriptionStaffRules: dto.subscriptionStaffRules,
      password,
    });
    if (!user) {
      throw new NotFoundException({ error: ErrorCode.NotFound, message: 'User not found.' });
    }

    const shouldRevoke =
      dto.isActive === false ||
      Boolean(password) ||
      (dto.role !== undefined && dto.role !== existing.role) ||
      (dto.staffProfileId !== undefined &&
        dto.staffProfileId !== (existing.staffProfileId?.trim() || 'administrator'));
    if (shouldRevoke) {
      await this.sessions.revokeAllForUser(id);
    }

    return { user: toAdminUser(user) };
  }

  @Delete(':id')
  @Permissions('manage_users')
  async remove(@CurrentUser() actor: RequestUser, @Param('id', ParseObjectIdPipe) id: string) {
    const existing = await this.usersService.findById(id);
    if (!existing) {
      throw new NotFoundException({ error: ErrorCode.NotFound, message: 'User not found.' });
    }
    this.assertCanManage(actor, existing.role);

    const user = await this.usersService.deleteAdmin(id, actor.id);
    if (!user) {
      throw new NotFoundException({ error: ErrorCode.NotFound, message: 'User not found.' });
    }
    await this.sessions.revokeAllForUser(id);
    return { message: 'User deleted.', id };
  }

  @Patch(':id/role')
  @Permissions('manage_users')
  async updateRole(
    @CurrentUser() actor: RequestUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    const existing = await this.usersService.findById(id);
    if (!existing) {
      throw new NotFoundException({
        error: ErrorCode.NotFound,
        message: 'User not found.',
      });
    }
    if (isStaffRole(existing.role) && actor.role !== UserRole.SuperAdmin) {
      throw new ForbiddenException({
        error: ErrorCode.Forbidden,
        message: 'Only Super Admin can change staff roles.',
      });
    }
    if (!canAssignRole(actor.role, dto.role)) {
      throw new ForbiddenException({
        error: ErrorCode.Forbidden,
        message: 'You cannot assign that role.',
      });
    }

    const user = await this.usersService.updateRole(id, dto.role);
    if (!user) {
      throw new NotFoundException({
        error: ErrorCode.NotFound,
        message: 'User not found.',
      });
    }
    await this.sessions.revokeAllForUser(id);
    return { user: toPublicUser(user) };
  }

  private assertCanManage(actor: RequestUser, targetRole: UserRole) {
    if (actor.role === UserRole.SuperAdmin) return;
    if (isStaffRole(targetRole)) {
      throw new ForbiddenException({
        error: ErrorCode.Forbidden,
        message: 'Only Super Admin can manage staff accounts.',
      });
    }
  }
}

function toAdminUser(
  user: UserDocument,
  subscription: AdminUserRow['subscription'] = null,
): AdminUserRow {
  return {
    ...toAdminUserRow(user),
    subscription,
  };
}
