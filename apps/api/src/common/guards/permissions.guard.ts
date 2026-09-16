import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode, PermissionKey, UserRole } from '@movie-server/shared';
import { RequestUser } from '../../auth/auth.types';
import { RolePermissionsService } from '../../role-permissions/role-permissions.service';
import { PERMISSIONS_KEY } from '../constants';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rolePermissions: RolePermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PermissionKey[] | undefined>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException({
        error: ErrorCode.Forbidden,
        message: 'Insufficient permissions.',
      });
    }

    if (user.role === UserRole.SuperAdmin) {
      return true;
    }

    for (const permission of required) {
      const allowed = await this.rolePermissions.userHasPermission(user, permission);
      if (!allowed) {
        throw new ForbiddenException({
          error: ErrorCode.Forbidden,
          message: 'Insufficient permissions.',
        });
      }
    }
    return true;
  }
}
