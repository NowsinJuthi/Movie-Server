import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  DEFAULT_STAFF_PROFILE_PERMISSIONS,
  PERMISSION_KEYS,
  STAFF_PROFILE_DEFINITIONS,
  STAFF_PROFILE_IDS,
  UserRole,
  hasMinimumRole,
  type AdminPermissions,
  type PermissionKey,
  type RolePermissionProfile,
  type StaffProfileId,
} from '@movie-server/shared';
import { RequestUser } from '../auth/auth.types';
import {
  RolePermissions,
  RolePermissionsDocument,
} from './schemas/role-permissions.schema';

export const ROLE_PERMISSIONS_KEY = 'global';

@Injectable()
export class RolePermissionsService {
  constructor(
    @InjectModel(RolePermissions.name)
    private readonly model: Model<RolePermissionsDocument>,
  ) {}

  async getOverview() {
    const doc = await this.getOrCreate();
    const roles = this.buildRoles(doc);
    return {
      roleCount: STAFF_PROFILE_DEFINITIONS.length,
      customizedCount: roles.filter((role) => role.customized).length,
      adminAccessCount: roles.filter((role) => role.permissions.admin_panel_access).length,
      roles,
    };
  }

  async updateRole(roleId: string, permissions: Record<string, boolean>) {
    if (!STAFF_PROFILE_IDS.includes(roleId as StaffProfileId)) {
      throw new NotFoundException('Role profile not found.');
    }

    const def = STAFF_PROFILE_DEFINITIONS.find((row) => row.id === roleId);
    if (def?.locked) {
      throw new BadRequestException('This role profile cannot be modified.');
    }

    const sanitized = this.sanitizePermissions(permissions);
    const doc = await this.getOrCreate();
    doc.roles[roleId] = sanitized;
    doc.markModified('roles');
    await doc.save();
    return this.buildRole(roleId as StaffProfileId, doc);
  }

  async resetRole(roleId: string) {
    if (!STAFF_PROFILE_IDS.includes(roleId as StaffProfileId)) {
      throw new NotFoundException('Role profile not found.');
    }

    const def = STAFF_PROFILE_DEFINITIONS.find((row) => row.id === roleId);
    if (def?.locked) {
      throw new BadRequestException('This role profile cannot be reset.');
    }

    const doc = await this.getOrCreate();
    delete doc.roles[roleId];
    doc.markModified('roles');
    await doc.save();
    return this.buildRole(roleId as StaffProfileId, doc);
  }

  async resetAll() {
    const doc = await this.getOrCreate();
    doc.roles = {};
    doc.markModified('roles');
    await doc.save();
    return this.getOverview();
  }

  async getEffectivePermissionsForUser(user: RequestUser): Promise<AdminPermissions> {
    if (user.role === UserRole.SuperAdmin) {
      return { ...DEFAULT_STAFF_PROFILE_PERMISSIONS.super_admin };
    }

    const profileId = this.resolveStaffProfileId(user);
    if (!profileId) {
      return this.emptyPermissions();
    }

    const doc = await this.getOrCreate();
    return this.buildRole(profileId, doc).permissions;
  }

  async userHasPermission(user: RequestUser, permission: PermissionKey): Promise<boolean> {
    if (user.role === UserRole.SuperAdmin) {
      return true;
    }
    const effective = await this.getEffectivePermissionsForUser(user);
    return Boolean(effective[permission]);
  }

  resolveStaffProfileId(user: {
    role: UserRole;
    staffProfileId?: string | null;
  }): StaffProfileId | null {
    if (user.role === UserRole.SuperAdmin) {
      return 'super_admin';
    }
    if (!hasMinimumRole(user.role, UserRole.Admin)) {
      return null;
    }
    const candidate = user.staffProfileId?.trim() || 'administrator';
    if (STAFF_PROFILE_IDS.includes(candidate as StaffProfileId)) {
      return candidate as StaffProfileId;
    }
    return 'administrator';
  }

  private async getOrCreate(): Promise<RolePermissionsDocument> {
    let doc = await this.model.findOne({ key: ROLE_PERMISSIONS_KEY }).exec();
    if (!doc) {
      doc = await this.model.create({ key: ROLE_PERMISSIONS_KEY, roles: {} });
    }
    return doc;
  }

  private buildRoles(doc: RolePermissionsDocument): RolePermissionProfile[] {
    return STAFF_PROFILE_IDS.map((id) => this.buildRole(id, doc));
  }

  private buildRole(roleId: StaffProfileId, doc: RolePermissionsDocument): RolePermissionProfile {
    const def = STAFF_PROFILE_DEFINITIONS.find((row) => row.id === roleId)!;
    const defaults = DEFAULT_STAFF_PROFILE_PERMISSIONS[roleId];
    const stored = doc.roles?.[roleId];
    const customized = Boolean(stored && Object.keys(stored).length > 0);
    const permissions = def.locked
      ? { ...defaults }
      : ({ ...defaults, ...this.sanitizePermissions(stored ?? {}) } as Record<
          PermissionKey,
          boolean
        >);

    return {
      id: roleId,
      label: def.label,
      description: def.description,
      locked: def.locked,
      summary: def.summary,
      customized,
      permissions,
    };
  }

  private sanitizePermissions(input: Record<string, boolean>): Record<PermissionKey, boolean> {
    const output = {} as Record<PermissionKey, boolean>;
    for (const key of PERMISSION_KEYS) {
      if (typeof input[key] === 'boolean') {
        output[key] = input[key];
      }
    }
    return output;
  }

  private emptyPermissions(): AdminPermissions {
    return Object.fromEntries(PERMISSION_KEYS.map((key) => [key, false])) as AdminPermissions;
  }
}
