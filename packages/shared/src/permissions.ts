export const PERMISSION_KEYS = [
  'admin_panel_access',
  'dashboard_analytics',
  'view_movies',
  'manage_movies',
  'view_series',
  'manage_series',
  'manage_collections',
  'manage_genres_tags',
  'manage_home_curation',
  'manage_libraries',
  'upload_smb_files',
  'manage_smb_files',
  'view_stream_sessions',
  'view_users',
  'manage_users',
  'view_profiles',
  'manage_profiles',
  'view_subscriptions',
  'manage_plans',
  'manage_subscriptions',
  'manage_billing',
  'manage_settings',
  'manage_license',
  'view_audit_logs',
  'manage_jobs',
  'manage_roles_permissions',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const STAFF_PROFILE_IDS = [
  'super_admin',
  'administrator',
  'content_manager',
  'library_manager',
  'media_uploader',
  'billing_manager',
  'support_staff',
] as const;

export type StaffProfileId = (typeof STAFF_PROFILE_IDS)[number];

export const PERMISSION_GROUPS: Array<{
  key: string;
  label: string;
  permissions: Array<{
    key: PermissionKey;
    label: string;
    description: string;
  }>;
}> = [
  {
    key: 'admin_panel',
    label: 'ADMIN PANEL',
    permissions: [
      {
        key: 'admin_panel_access',
        label: 'Admin panel access',
        description: 'Open the administration area',
      },
      {
        key: 'dashboard_analytics',
        label: 'Dashboard & analytics',
        description: 'View dashboard KPIs and system overview',
      },
    ],
  },
  {
    key: 'catalog',
    label: 'CATALOG',
    permissions: [
      {
        key: 'view_movies',
        label: 'View movies',
        description: 'Browse the movie catalog in admin',
      },
      {
        key: 'manage_movies',
        label: 'Manage movies',
        description: 'Create, edit, and delete movies and media assets',
      },
      {
        key: 'view_series',
        label: 'View TV series',
        description: 'Browse series, seasons, and episodes',
      },
      {
        key: 'manage_series',
        label: 'Manage TV series',
        description: 'Create, edit, and delete series content',
      },
      {
        key: 'manage_collections',
        label: 'Manage collections',
        description: 'Curate movie and series collections',
      },
      {
        key: 'manage_genres_tags',
        label: 'Genres, tags & tracks',
        description: 'Manage genres, tags, and audio/subtitle tracks',
      },
      {
        key: 'manage_home_curation',
        label: 'Homepage curation',
        description: 'Featured rows, slider, and homepage layout',
      },
    ],
  },
  {
    key: 'library',
    label: 'LIBRARY & STREAMS',
    permissions: [
      {
        key: 'manage_libraries',
        label: 'Media libraries',
        description: 'Add libraries and run scans',
      },
      {
        key: 'upload_smb_files',
        label: 'Samba upload',
        description: 'Browse shares and upload videos (no server setup or delete)',
      },
      {
        key: 'manage_smb_files',
        label: 'Samba file manager',
        description: 'Connect Samba servers, link libraries, and remove servers',
      },
      {
        key: 'view_stream_sessions',
        label: 'Sessions & streams',
        description: 'Monitor active playback sessions',
      },
    ],
  },
  {
    key: 'accounts',
    label: 'ACCOUNTS',
    permissions: [
      {
        key: 'view_users',
        label: 'View users',
        description: 'Browse user accounts',
      },
      {
        key: 'manage_users',
        label: 'Manage users',
        description: 'Create, edit, and deactivate user accounts',
      },
      {
        key: 'view_profiles',
        label: 'View profiles',
        description: 'Browse viewer profiles',
      },
      {
        key: 'manage_profiles',
        label: 'Manage profiles',
        description: 'Delete or manage viewer profiles',
      },
      {
        key: 'view_subscriptions',
        label: 'View subscriptions',
        description: 'See subscription status on user accounts and browse subscriptions',
      },
    ],
  },
  {
    key: 'billing',
    label: 'BILLING',
    permissions: [
      {
        key: 'manage_plans',
        label: 'Subscription plans',
        description: 'Create and edit subscription plans',
      },
      {
        key: 'manage_subscriptions',
        label: 'Manage subscriptions',
        description: 'Grant, activate, suspend, and edit user subscriptions',
      },
      {
        key: 'manage_billing',
        label: 'Payments & invoices',
        description: 'View payments and billing records',
      },
    ],
  },
  {
    key: 'system',
    label: 'SYSTEM',
    permissions: [
      {
        key: 'manage_settings',
        label: 'Site settings',
        description: 'Branding, SMTP, and general configuration',
      },
      {
        key: 'manage_license',
        label: 'License',
        description: 'Activate and manage the server license',
      },
      {
        key: 'view_audit_logs',
        label: 'Audit logs',
        description: 'Read admin activity logs',
      },
      {
        key: 'manage_jobs',
        label: 'Background jobs',
        description: 'View queue status and job history',
      },
    ],
  },
  {
    key: 'security',
    label: 'SECURITY',
    permissions: [
      {
        key: 'manage_roles_permissions',
        label: 'Roles & permissions',
        description: 'Configure staff access levels',
      },
    ],
  },
];

export const STAFF_PROFILE_DEFINITIONS: Array<{
  id: StaffProfileId;
  label: string;
  description: string;
  locked: boolean;
  summary: string[];
}> = [
  {
    id: 'super_admin',
    label: 'Super Admin',
    description: 'Full unrestricted access — cannot be modified.',
    locked: true,
    summary: [
      'Unrestricted access to every admin area.',
      'Manage staff accounts and role profiles.',
      'This profile cannot be restricted.',
    ],
  },
  {
    id: 'administrator',
    label: 'Administrator',
    description: 'Full admin access for day-to-day operations.',
    locked: false,
    summary: [
      'Access all catalog, library, billing, and account tools.',
      'Manage settings, license, and background jobs.',
      'Can configure roles unless restricted here.',
    ],
  },
  {
    id: 'content_manager',
    label: 'Content manager',
    description: 'Movies, series, metadata, and homepage curation.',
    locked: false,
    summary: [
      'Manage movies, TV series, collections, and genres.',
      'Curate featured content and homepage rows.',
      'No billing, user management, or system settings.',
    ],
  },
  {
    id: 'library_manager',
    label: 'Library manager',
    description: 'Media libraries, Samba uploads, and stream monitoring.',
    locked: false,
    summary: [
      'Add and scan media libraries.',
      'Use the Samba file manager and monitor streams.',
      'No catalog editing or billing access.',
    ],
  },
  {
    id: 'media_uploader',
    label: 'Media uploader',
    description: 'Upload videos via Samba without delete or catalog access.',
    locked: false,
    summary: [
      'Browse configured Samba shares and upload video files.',
      'Cannot remove servers, link libraries, or delete movies.',
      'No access to movies, billing, or user management.',
    ],
  },
  {
    id: 'billing_manager',
    label: 'Billing manager',
    description: 'Plans, subscriptions, and payments.',
    locked: false,
    summary: [
      'Manage subscription plans and user subscriptions.',
      'View payments and billing records.',
      'No catalog or library management.',
    ],
  },
  {
    id: 'support_staff',
    label: 'Support staff',
    description: 'Read-only access to users, profiles, and audit logs.',
    locked: false,
    summary: [
      'View users, profiles, subscriptions, and playback sessions.',
      'Read audit logs for troubleshooting.',
      'Cannot change catalog, billing, or settings.',
    ],
  },
];

function allPermissions(value: boolean): Record<PermissionKey, boolean> {
  return Object.fromEntries(PERMISSION_KEYS.map((key) => [key, value])) as Record<
    PermissionKey,
    boolean
  >;
}

export const DEFAULT_STAFF_PROFILE_PERMISSIONS: Record<
  StaffProfileId,
  Record<PermissionKey, boolean>
> = {
  super_admin: allPermissions(true),
  administrator: allPermissions(true),
  content_manager: {
    ...allPermissions(false),
    admin_panel_access: true,
    dashboard_analytics: true,
    view_movies: true,
    manage_movies: true,
    view_series: true,
    manage_series: true,
    manage_collections: true,
    manage_genres_tags: true,
    manage_home_curation: true,
  },
  library_manager: {
    ...allPermissions(false),
    admin_panel_access: true,
    dashboard_analytics: true,
    manage_libraries: true,
    upload_smb_files: true,
    manage_smb_files: true,
    view_stream_sessions: true,
  },
  media_uploader: {
    ...allPermissions(false),
    admin_panel_access: true,
    upload_smb_files: true,
  },
  billing_manager: {
    ...allPermissions(false),
    admin_panel_access: true,
    dashboard_analytics: true,
    manage_plans: true,
    manage_subscriptions: true,
    manage_billing: true,
  },
  support_staff: {
    ...allPermissions(false),
    admin_panel_access: true,
    view_users: true,
    view_profiles: true,
    view_subscriptions: true,
    view_stream_sessions: true,
    view_audit_logs: true,
  },
};

export type RolePermissionProfile = {
  id: StaffProfileId;
  label: string;
  description: string;
  locked: boolean;
  summary: string[];
  customized: boolean;
  permissions: Record<PermissionKey, boolean>;
};

export type RolePermissionsOverview = {
  roleCount: number;
  customizedCount: number;
  adminAccessCount: number;
  roles: RolePermissionProfile[];
};

export type AdminPermissions = Record<PermissionKey, boolean>;
