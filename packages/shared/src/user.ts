export const UserRole = {
  User: 'user',
  Customer: 'customer',
  Vip: 'vip',
  Admin: 'admin',
  SuperAdmin: 'super_admin',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const USER_ROLES = [
  UserRole.User,
  UserRole.Customer,
  UserRole.Vip,
  UserRole.Admin,
  UserRole.SuperAdmin,
] as const;

/** End-user roles (not staff). Admins may create / assign these. */
export const END_USER_ROLES = [UserRole.User, UserRole.Customer, UserRole.Vip] as const;

export const ROLE_RANK: Record<UserRole, number> = {
  [UserRole.User]: 1,
  [UserRole.Customer]: 2,
  [UserRole.Vip]: 3,
  [UserRole.Admin]: 4,
  [UserRole.SuperAdmin]: 5,
};

export function hasMinimumRole(current: UserRole, required: UserRole): boolean {
  return ROLE_RANK[current] >= ROLE_RANK[required];
}

export function isStaffRole(role: UserRole): boolean {
  return hasMinimumRole(role, UserRole.Admin);
}

export function isEndUserRole(role: UserRole): boolean {
  return (END_USER_ROLES as readonly UserRole[]).includes(role);
}

/** Whether `actor` may assign `targetRole` to another account. */
export function canAssignRole(actor: UserRole, targetRole: UserRole): boolean {
  if (actor === UserRole.SuperAdmin) return true;
  if (hasMinimumRole(actor, UserRole.Admin)) return isEndUserRole(targetRole);
  return false;
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
