import { UserRole } from '@movie-server/shared';

export type AccessTokenPayload = {
  sub: string;
  email: string;
  role: UserRole;
  tv: number;
  sid: string;
  jti: string;
  typ: 'access';
};

export type RequestUser = {
  id: string;
  email: string;
  role: UserRole;
  staffProfileId: string | null;
  subscriptionStaffRules: {
    view: boolean | null;
    manage: boolean | null;
  } | null;
  sessionId: string;
  tokenVersion: number;
  jti: string;
  activeProfileId: string | null;
  deviceKey: string | null;
};
