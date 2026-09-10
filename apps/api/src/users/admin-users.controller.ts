import { Body, Controller, Get, NotFoundException, Param, Patch, Query } from '@nestjs/common';
import { ErrorCode, UserRole, type AdminUserRow } from '@movie-server/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { UsersService } from './users.service';
import { toPublicUser } from './user.mapper';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { QueryUsersDto, PatchUserDto } from './dto/query-users.dto';
import { SessionsService } from '../sessions/sessions.service';
import { UserDocument } from './schemas/user.schema';

@Controller('admin/users')
@Roles(UserRole.Admin)
export class AdminUsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly sessions: SessionsService,
  ) {}

  @Get()
  async list(@Query() query: QueryUsersDto) {
    const result = await this.usersService.listAdmin(query);
    return {
      users: result.items.map(toAdminUser),
      items: result.items.map(toAdminUser),
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    };
  }

  @Patch(':id')
  async patch(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: PatchUserDto) {
    const user = await this.usersService.patchAdmin(id, dto);
    if (!user) {
      throw new NotFoundException({ error: ErrorCode.NotFound, message: 'User not found.' });
    }
    if (dto.isActive === false) {
      await this.sessions.revokeAllForUser(id);
    }
    return { user: toAdminUser(user) };
  }

  @Patch(':id/role')
  @Roles(UserRole.SuperAdmin)
  async updateRole(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateUserRoleDto) {
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
}

function toAdminUser(user: UserDocument): AdminUserRow {
  return {
    ...toPublicUser(user),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  };
}
