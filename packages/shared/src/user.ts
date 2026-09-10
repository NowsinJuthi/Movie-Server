export const UserRole = {
  User: 'user',
  Admin: 'admin',
  SuperAdmin: 'super_admin',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const USER_ROLES = [UserRole.User, UserRole.Admin, UserRole.SuperAdmin] as const;

export const ROLE_RANK: Record<UserRole, number> = {
  [UserRole.User]: 1,
  [UserRole.Admin]: 2,
  [UserRole.SuperAdmin]: 3,
};

export function hasMinimumRole(current: UserRole, required: UserRole): boolean {
  return ROLE_RANK[current] >= ROLE_RANK[required];
}

export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  emailVerified: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
