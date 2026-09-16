import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '@movie-server/shared';
import { PERMISSIONS_KEY } from '../constants';

export const Permissions = (...permissions: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
