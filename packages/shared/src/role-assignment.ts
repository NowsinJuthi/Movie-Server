import {
  STAFF_PROFILE_DEFINITIONS,
  STAFF_PROFILE_IDS,
  type StaffProfileId,
} from './permissions';
import {
  END_USER_ROLES,
  UserRole,
  isEndUserRole,
  type UserRole as UserRoleType,
} from './user';

const MEMBER_ROLE_LABELS: Record<(typeof END_USER_ROLES)[number], string> = {
  [UserRole.User]: 'User',
  [UserRole.Customer]: 'Customer',
  [UserRole.Vip]: 'VIP',
};

export type AssignableRoleOption = {
  value: string;
  label: string;
  group: 'Members' | 'Staff roles';
};

/** Same role labels used in Users and Roles & permissions. */
export function assignableRoleOptions(includeStaff: boolean): AssignableRoleOption[] {
  const members = END_USER_ROLES.map((role) => ({
    value: memberRoleKey(role),
    label: MEMBER_ROLE_LABELS[role],
    group: 'Members' as const,
  }));

  if (!includeStaff) {
    return members;
  }

  const staff = STAFF_PROFILE_DEFINITIONS.map((profile) => ({
    value: staffRoleKey(profile.id),
    label: profile.label,
    group: 'Staff roles' as const,
  }));

  return [...members, ...staff];
}

export function memberRoleKey(role: UserRoleType): string {
  return `member:${role}`;
}

export function staffRoleKey(profileId: StaffProfileId): string {
  return `staff:${profileId}`;
}

export function userToAssignableRole(user: {
  role: UserRoleType;
  staffProfileId?: string | null;
}): string {
  if (user.role === UserRole.SuperAdmin) {
    return staffRoleKey('super_admin');
  }
  if (user.role === UserRole.Admin) {
    const profile = user.staffProfileId?.trim();
    if (profile && STAFF_PROFILE_IDS.includes(profile as StaffProfileId)) {
      return staffRoleKey(profile as StaffProfileId);
    }
    return staffRoleKey('administrator');
  }
  return memberRoleKey(user.role);
}

export function parseAssignableRole(value: string): {
  role: UserRoleType;
  staffProfileId: string | null;
} {
  if (value.startsWith('member:')) {
    const role = value.slice('member:'.length) as UserRoleType;
    if (isEndUserRole(role)) {
      return { role, staffProfileId: null };
    }
  }

  if (value.startsWith('staff:')) {
    const profileId = value.slice('staff:'.length) as StaffProfileId;
    if (profileId === 'super_admin') {
      return { role: UserRole.SuperAdmin, staffProfileId: 'super_admin' };
    }
    if (STAFF_PROFILE_IDS.includes(profileId)) {
      return { role: UserRole.Admin, staffProfileId: profileId };
    }
  }

  return { role: UserRole.User, staffProfileId: null };
}

export function userRoleDisplayLabel(user: {
  role: UserRoleType;
  staffProfileId?: string | null;
}): string {
  if (user.role === UserRole.SuperAdmin) {
    return (
      STAFF_PROFILE_DEFINITIONS.find((profile) => profile.id === 'super_admin')?.label ??
      'Super Admin'
    );
  }

  if (user.role === UserRole.Admin) {
    const profile = user.staffProfileId?.trim() || 'administrator';
    return (
      STAFF_PROFILE_DEFINITIONS.find((item) => item.id === profile)?.label ??
      profile.replaceAll('_', ' ')
    );
  }

  if (isEndUserRole(user.role)) {
    return MEMBER_ROLE_LABELS[user.role];
  }

  return user.role.replaceAll('_', ' ');
}
