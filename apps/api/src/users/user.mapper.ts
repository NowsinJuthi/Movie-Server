import { PublicUser, UserRole, hasMinimumRole } from '@movie-server/shared';
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

export function toAdminUserRow(user: UserDocument) {
  const rules = user.subscriptionStaffRules;
  return {
    ...toPublicUser(user),
    staffProfileId: user.staffProfileId?.trim() || null,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    subscription: null,
    subscriptionRules: hasMinimumRole(user.role as UserRole, UserRole.Admin)
      ? {
          view: rules?.view ?? null,
          manage: rules?.manage ?? null,
        }
      : null,
  };
}
