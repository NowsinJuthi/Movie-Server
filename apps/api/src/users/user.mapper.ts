import { PublicUser, UserRole } from '@movie-server/shared';
import { UserDocument } from '../users/schemas/user.schema';

export function toPublicUser(user: UserDocument): PublicUser {
  return {
    id: String(user._id),
    email: user.email,
    displayName: user.displayName,
    role: user.role as UserRole,
    emailVerified: user.emailVerified,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
