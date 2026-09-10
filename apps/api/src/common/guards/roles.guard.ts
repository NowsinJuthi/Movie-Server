import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode, hasMinimumRole, UserRole } from '@movie-server/shared';
import { RequestUser } from '../../auth/auth.types';
import { ROLES_KEY } from '../constants';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) {
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

    const allowed = requiredRoles.some((role) => hasMinimumRole(user.role, role));
    if (!allowed) {
      throw new ForbiddenException({
        error: ErrorCode.Forbidden,
        message: 'Insufficient permissions.',
      });
    }
    return true;
  }
}
