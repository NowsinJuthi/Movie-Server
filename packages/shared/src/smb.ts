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

export type AdminSmbUploadResponse = {
  ok: boolean;
  serverId: string;
  path: string;
  filename: string;
  remotePath: string;
  sizeBytes: number;
  libraryId: string | null;
  libraryName: string | null;
  scan: { id: string } | null;
};
