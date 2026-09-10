export type AdminSmbServer = {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  domain: string;
  share: string;
  enabled: boolean;
  lastOkAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminSmbBrowseEntry = {
  name: string;
  path: string;
  kind: 'directory' | 'file';
  sizeBytes: number | null;
  isVideo: boolean;
};

export type AdminSmbServersResponse = {
  servers: AdminSmbServer[];
};

export type AdminSmbServerResponse = {
  server: AdminSmbServer;
};

export type AdminSmbBrowseResponse = {
  serverId: string;
  share: string;
  path: string;
  parentPath: string | null;
  entries: AdminSmbBrowseEntry[];
};

export type AdminSmbTestResponse = {
  ok: boolean;
  message: string;
  server: AdminSmbServer;
};
