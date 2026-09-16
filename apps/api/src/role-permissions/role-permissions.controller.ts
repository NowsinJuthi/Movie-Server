import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../auth/auth.types';
import { RolePermissionsService } from './role-permissions.service';

@Controller('role-permissions')
export class RolePermissionsController {
  constructor(private readonly service: RolePermissionsService) {}

  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    return this.service.getEffectivePermissionsForUser(user);
  }
}
