import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { UserRole } from '@movie-server/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { RolePermissionsService } from './role-permissions.service';

@Controller('role-permissions/admin')
@Roles(UserRole.Admin)
@Permissions('manage_roles_permissions')
export class RolePermissionsAdminController {
  constructor(private readonly service: RolePermissionsService) {}

  @Get()
  overview() {
    return this.service.getOverview();
  }

  @Patch('roles/:roleId')
  updateRole(@Param('roleId') roleId: string, @Body() dto: UpdateRolePermissionsDto) {
    return this.service.updateRole(roleId, dto.permissions ?? {});
  }

  @Post('roles/:roleId/reset')
  resetRole(@Param('roleId') roleId: string) {
    return this.service.resetRole(roleId);
  }

  @Post('reset')
  resetAll() {
    return this.service.resetAll();
  }
}
