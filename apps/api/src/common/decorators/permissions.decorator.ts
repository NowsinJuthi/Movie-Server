import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '@movie-server/shared';
import { PERMISSIONS_ANY_KEY, PERMISSIONS_KEY } from '../constants';

export const Permissions = (...permissions: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/** User needs at least one of these permissions (unless Super Admin). */
export const PermissionsAny = (...permissions: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_ANY_KEY, permissions);
