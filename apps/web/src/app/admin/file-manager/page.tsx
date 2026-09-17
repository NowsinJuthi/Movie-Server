"use client";

import {
  hasMinimumRole,
  UserRole,
  type AdminSmbBrowseEntry,
  type AdminSmbServer,
  type LibraryKind,
} from "@movie-server/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUp,
  ChevronRight,
  Film,
  Folder,
  FolderPlus,
  HardDrive,
  Home,
  Loader2,
  PlugZap,
  Plus,
  RefreshCw,
  Server,
  Trash2,
  X,
} from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import styles from "@/components/admin/file-manager-page.module.css";
import { SmbUploadPanel } from "@/components/admin/smb-upload-panel";
import {
  SmbUploadStatusCard,
  type SmbUploadStatus,
} from "@/components/admin/smb-upload-toast";
import { ScreenMessage } from "@/components/profiles/pin-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminPermissions } from "@/hooks/use-admin-permissions";
import { useAuthStore } from "@/stores/auth-store";
import { ApiError } from "@/lib/api";
import { smbApi } from "@/lib/smb-api";
import { libraryApi } from "@/lib/library-api";
import { cn } from "@/lib/utils";

export default function AdminFileManagerPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, status } = useAuthStore();
  const { can, canAny, isLoading: permissionsLoading } = useAdminPermissions();
  const canManageSmb = can("manage_smb_files");
  const canUseSmb = canAny("upload_smb_files", "manage_smb_files");
  const [error, setError] = useState<string | null>(null);
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [browsePath, setBrowsePath] = useState("");
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("445");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [domain, setDomain] = useState("");
  const [share, setShare] = useState("");
  const [libraryName, setLibraryName] = useState("");
  const [libraryKind, setLibraryKind] = useState<LibraryKind>("movies");
  const [pendingDir, setPendingDir] = useState<AdminSmbBrowseEntry | null>(null);
  const [updatePassword, setUpdatePassword] = useState("");
  const [credentialsSaved, setCredentialsSaved] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<SmbUploadStatus | null>(null);

  const serversQuery = useQuery({
    queryKey: ["admin-smb-servers"],
    queryFn: smbApi.list,
    enabled: Boolean(user && hasMinimumRole(user.role, UserRole.Admin)),
  });

  const browseQuery = useQuery({
    queryKey: ["admin-smb-browse", selectedId, browsePath],
    queryFn: () => smbApi.browse(selectedId!, browsePath),
    enabled: Boolean(selectedId && user && hasMinimumRole(user.role, UserRole.Admin)),
  });

  useEffect(() => {
    if (status === "anonymous") {
      router.replace("/login?next=/admin/file-manager");
    } else if (user && !hasMinimumRole(user.role, UserRole.Admin)) {
      router.replace("/unauthorized");
    } else if (user && hasMinimumRole(user.role, UserRole.Admin) && !permissionsLoading && !canUseSmb) {
      router.replace("/unauthorized");
    }
  }, [status, user, router, permissionsLoading, canUseSmb]);

  const create = useMutation({
    mutationFn: () =>
      smbApi.create({
        name: name.trim() || `${host}/${share}`,
        host: host.trim(),
        port: Number(port) || 445,
        username: username.trim(),
        password,
        domain: domain.trim(),
        share: share.trim(),
      }),
    onSuccess: (data) => {
      setPassword("");
      setSelectedId(data.server.id);
      setBrowsePath("");
      setShowConnectForm(false);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["admin-smb-servers"] });
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : "Could not add Samba server."),
  });

  const test = useMutation({
    mutationFn: (id: string) => smbApi.test(id),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["admin-smb-servers"] });
      void browseQuery.refetch();
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : "Connection test failed."),
  });

  const updateCredentials = useMutation({
    mutationFn: async () => {
      if (!selectedId || !updatePassword.trim()) throw new Error("Password required");
      await smbApi.saveCredentials(selectedId, updatePassword);
    },
    onSuccess: async () => {
      setUpdatePassword("");
      setCredentialsSaved(true);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-smb-servers"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-smb-browse", selectedId, browsePath] });
      if (!selectedId) return;
      try {
        await smbApi.test(selectedId);
        await browseQuery.refetch();
      } catch (err) {
        setError(
          err instanceof ApiError
            ? `Password saved, but connection failed: ${err.message}`
            : "Password saved, but connection test failed.",
        );
        await browseQuery.refetch();
      }
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : "Could not save Samba password."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => smbApi.remove(id),
    onSuccess: (_data, id) => {
      if (selectedId === id) {
        setSelectedId(null);
        setBrowsePath("");
      }
      queryClient.invalidateQueries({ queryKey: ["admin-smb-servers"] });
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : "Could not remove server."),
  });

  const addLibrary = useMutation({
    mutationFn: () => {
      if (!selectedId || !pendingDir) throw new Error("No folder selected");
      return smbApi.addLibrary({
        serverId: selectedId,
        path: pendingDir.path,
        name: libraryName.trim() || pendingDir.name,
        kind: libraryKind,
      });
    },
    onSuccess: async (data) => {
      setPendingDir(null);
      setLibraryName("");
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-libraries"] });
      await libraryApi.startScan({ libraryId: data.library.id, full: true });
      router.push("/admin/libraries");
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : "Could not add folder as media library."),
  });

  const servers = serversQuery.data?.servers ?? [];
  const selected = useMemo(
    () => servers.find((server) => server.id === selectedId) ?? null,
    [servers, selectedId],
  );
  const entries = browseQuery.data?.entries ?? [];
  const parentPath = browseQuery.data?.parentPath;
  const pathSegments = browsePath ? browsePath.split("/").filter(Boolean) : [];
  const showCredentialsPanel =
    Boolean(selected) && (Boolean(selected?.lastError) || browseQuery.isError);

  const uncPath = selected
    ? `\\\\${selected.host}\\${selected.share}${browsePath ? `\\${browsePath.replace(/\//g, "\\")}` : ""}`
    : "";

  if (!user || !hasMinimumRole(user.role, UserRole.Admin) || permissionsLoading || !canUseSmb) {
    return <ScreenMessage>Checking access...</ScreenMessage>;
  }

  const pageError =
    error ??
    (serversQuery.error instanceof ApiError
      ? serversQuery.error.message
      : serversQuery.error
        ? "Could not load Samba servers."
        : null);

  return (
    <AdminPage
      title="Samba file manager"
      description={
        canManageSmb
          ? "Connect network storage, browse shares, upload videos, and link folders to media libraries."
          : "Browse configured Samba shares and upload videos. Server setup and delete require Library manager access."
      }
      error={pageError}
      actions={
        canManageSmb ? (
          <Button
            type="button"
            size="sm"
            variant={showConnectForm ? "ghost" : "outline"}
            onClick={() => setShowConnectForm((open) => !open)}
          >
            {showConnectForm ? (
              <>
                <X className="mr-2 h-4 w-4" />
                Close
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Connect server
              </>
            )}
          </Button>
        ) : null
      }
    >
      <div className={styles.layout}>
        {showConnectForm && canManageSmb ? (
          <section className={styles.connectPanel}>
            <div className={styles.connectHead}>
              <div>
                <h2 className={styles.connectTitle}>Connect Samba server</h2>
                <p className={styles.connectHint}>
                  Use the Samba account from your server (<code className="text-xs">pdbedit -L</code>), not your
                  Windows login unless they match. Leave domain blank for WORKGROUP.
                </p>
              </div>
            </div>
            <form
              className={styles.connectBody}
              onSubmit={(event) => {
                event.preventDefault();
                setError(null);
                create.mutate();
              }}
            >
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <Label htmlFor="smb-name">Display name</Label>
                  <Input id="smb-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Data-Storage" />
                </div>
                <div className={styles.field}>
                  <Label htmlFor="smb-host">Server IP / host</Label>
                  <Input
                    id="smb-host"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="192.168.0.10"
                    required
                  />
                </div>
                <div className={styles.field}>
                  <Label htmlFor="smb-port">Port</Label>
                  <Input id="smb-port" value={port} onChange={(e) => setPort(e.target.value)} />
                </div>
                <div className={styles.field}>
                  <Label htmlFor="smb-share">Share name</Label>
                  <Input
                    id="smb-share"
                    value={share}
                    onChange={(e) => setShare(e.target.value)}
                    placeholder="Data-Storage"
                    required
                  />
                </div>
                <div className={styles.field}>
                  <Label htmlFor="smb-user">Username</Label>
                  <Input
                    id="smb-user"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="samba-user"
                    required
                  />
                </div>
                <div className={styles.field}>
                  <Label htmlFor="smb-pass">Password</Label>
                  <Input
                    id="smb-pass"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <Label htmlFor="smb-domain">Domain (optional)</Label>
                  <Input
                    id="smb-domain"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="WORKGROUP"
                  />
                </div>
                <div className={styles.field} style={{ display: "flex", alignItems: "flex-end" }}>
                  <Button type="submit" disabled={create.isPending} className="w-full sm:w-auto">
                    {create.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Connecting…
                      </>
                    ) : (
                      <>
                        <PlugZap className="mr-2 h-4 w-4" />
                        Save & connect
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </section>
        ) : null}

        <div className={styles.workspace}>
          <aside className={styles.sidebar}>
            <div className={styles.sidebarHead}>
              <h2 className={styles.sidebarTitle}>Servers</h2>
              <span className="text-xs text-muted-foreground">{servers.length}</span>
            </div>
            <ul className={styles.serverList}>
              {servers.map((server: AdminSmbServer) => (
                <li key={server.id}>
                  <button
                    type="button"
                    className={cn(styles.serverBtn, selectedId === server.id && styles.serverBtnActive)}
                    onClick={() => {
                      setSelectedId(server.id);
                      setBrowsePath("");
                      setPendingDir(null);
                      setUploadStatus(null);
                      setError(null);
                      setCredentialsSaved(false);
                      setUpdatePassword("");
                    }}
                  >
                    <span className={styles.serverIcon}>
                      <Server className="h-4 w-4" />
                    </span>
                    <span className={styles.serverMeta}>
                      <span className={styles.serverName}>{server.name}</span>
                      <span className={styles.serverHost}>
                        {server.host}/{server.share}
                      </span>
                      <span className="mt-1.5 inline-flex">
                        <ServerStatusBadge server={server} />
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              {servers.length === 0 ? (
                <li className="px-3 py-8 text-center text-xs text-muted-foreground">
                  No servers yet. Click <strong>Connect server</strong> above.
                </li>
              ) : null}
            </ul>
          </aside>

          <section className={styles.main}>
            {!selected ? (
              <div className={styles.mainEmpty}>
                <HardDrive className="h-10 w-10 opacity-40" />
                <p className="text-sm font-medium text-foreground">Select a Samba server</p>
                <p className="max-w-sm text-xs">
                  Choose a server from the sidebar to browse folders, upload videos, or create a media library.
                </p>
              </div>
            ) : (
              <>
                <header className={styles.mainHead}>
                  <div className="min-w-0 flex-1">
                    <h2 className={styles.mainTitle}>{selected.name}</h2>
                    <p className={styles.uncPath} title={uncPath}>
                      {uncPath}
                    </p>
                  </div>
                  <div className={styles.toolbar}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => test.mutate(selected.id)}
                      disabled={test.isPending}
                    >
                      {test.isPending ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <PlugZap className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Test connection
                    </Button>
                    {canManageSmb ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm(`Remove "${selected.name}" from AmarPin? Linked libraries must be deleted first.`)) {
                            remove.mutate(selected.id);
                          }
                        }}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </header>

                {showCredentialsPanel ? (
                  <div className={styles.credPanel}>
                    <h3 className={styles.credTitle}>Connection required</h3>
                    {credentialsSaved ? (
                      <p className="mb-2 text-sm text-primary">Password saved. Test the connection or browse again.</p>
                    ) : null}
                    <p className={styles.credMessage}>
                      {browseQuery.error instanceof ApiError
                        ? browseQuery.error.message
                        : selected.lastError ||
                          "Could not reach this share. Re-enter the Samba password or verify host and share name."}
                    </p>
                    <form
                      className="flex flex-wrap items-end gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        setError(null);
                        setCredentialsSaved(false);
                        updateCredentials.mutate();
                      }}
                    >
                      <div className="min-w-[12rem] flex-1">
                        <Label htmlFor="smb-update-pass">Samba password</Label>
                        <Input
                          id="smb-update-pass"
                          type="password"
                          value={updatePassword}
                          onChange={(e) => setUpdatePassword(e.target.value)}
                          placeholder="Share password"
                          required
                        />
                      </div>
                      <Button type="submit" size="sm" disabled={updateCredentials.isPending || !updatePassword}>
                        {updateCredentials.isPending ? "Saving…" : "Save password"}
                      </Button>
                    </form>
                  </div>
                ) : null}

                <nav className={styles.breadcrumb} aria-label="Folder path">
                  <button type="button" className={styles.crumb} onClick={() => setBrowsePath("")}>
                    <Home className="h-3.5 w-3.5" />
                    Share root
                  </button>
                  {pathSegments.map((segment, index) => {
                    const path = pathSegments.slice(0, index + 1).join("/");
                    const isLast = index === pathSegments.length - 1;
                    return (
                      <span key={path} className="inline-flex items-center">
                        <ChevronRight className={styles.crumbSep} aria-hidden />
                        <button
                          type="button"
                          className={cn(styles.crumb, isLast && styles.crumbActive)}
                          onClick={() => !isLast && setBrowsePath(path)}
                          disabled={isLast}
                        >
                          {segment}
                        </button>
                      </span>
                    );
                  })}
                </nav>

                <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2 sm:px-4">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={browsePath === ""}
                    onClick={() => setBrowsePath(parentPath ?? "")}
                  >
                    <ArrowUp className="mr-1.5 h-3.5 w-3.5" />
                    Up
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => browseQuery.refetch()}
                    disabled={browseQuery.isFetching}
                  >
                    {browseQuery.isFetching ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Refresh
                  </Button>
                  {canManageSmb ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setPendingDir({
                          name: browsePath ? browsePath.split("/").pop() || selected.share : selected.share,
                          path: browsePath,
                          kind: "directory",
                          sizeBytes: null,
                          isVideo: false,
                        });
                        setLibraryName(
                          browsePath ? browsePath.split("/").pop() || selected.share : selected.name,
                        );
                      }}
                    >
                      <FolderPlus className="mr-1.5 h-3.5 w-3.5" />
                      Library from current folder
                    </Button>
                  ) : null}
                </div>

                <SmbUploadPanel
                  serverId={selected.id}
                  directoryPath={browsePath}
                  directoryLabel={uncPath}
                  onStatusChange={setUploadStatus}
                  onUploaded={() => {
                    void browseQuery.refetch();
                  }}
                />

                <div className={styles.fileTableWrap}>
                  {browseQuery.isLoading ? (
                    <div className={styles.emptyFolder}>
                      <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin opacity-60" />
                      Loading folder…
                    </div>
                  ) : (
                    <table className={styles.fileTable}>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Type</th>
                          <th>Size</th>
                          <th style={{ width: "8.5rem" }} />
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((entry) => (
                          <tr key={entry.path} className={styles.fileRow}>
                            <td>
                              <button
                                type="button"
                                className={styles.fileNameBtn}
                                onClick={() => {
                                  if (entry.kind === "directory") {
                                    setBrowsePath(entry.path);
                                    setPendingDir(null);
                                    setUploadStatus(null);
                                  }
                                }}
                                disabled={entry.kind !== "directory"}
                              >
                                {entry.kind === "directory" ? (
                                  <Folder className="h-4 w-4 shrink-0 text-primary" />
                                ) : (
                                  <Film className="h-4 w-4 shrink-0 text-muted-foreground" />
                                )}
                                <span>{entry.name}</span>
                              </button>
                            </td>
                            <td className="text-muted-foreground">
                              {entry.kind === "directory" ? "Folder" : entry.isVideo ? "Video" : "File"}
                            </td>
                            <td className="text-muted-foreground">
                              {entry.sizeBytes != null ? formatBytes(entry.sizeBytes) : "—"}
                            </td>
                            <td className="text-right">
                              {canManageSmb && entry.kind === "directory" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setPendingDir(entry);
                                    setLibraryName(entry.name);
                                  }}
                                >
                                  Add library
                                </Button>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                        {entries.length === 0 ? (
                          <tr>
                            <td colSpan={4} className={styles.emptyFolder}>
                              <p className={styles.emptyFolderLabel}>This folder is empty</p>
                              {uploadStatus ? (
                                <div className={styles.uploadStatusInline}>
                                  <SmbUploadStatusCard {...uploadStatus} inline />
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  )}
                  {uploadStatus && entries.length > 0 ? (
                    <div className={styles.uploadStatusFooter}>
                      <SmbUploadStatusCard {...uploadStatus} inline />
                    </div>
                  ) : null}
                </div>

                {pendingDir && canManageSmb ? (
                  <div className={styles.librarySheet}>
                    <h3 className={styles.librarySheetTitle}>Create media library</h3>
                    <p className={styles.librarySheetPath}>
                      {`\\\\${selected.host}\\${selected.share}${
                        pendingDir.path ? `\\${pendingDir.path.replace(/\//g, "\\")}` : ""
                      }`}
                    </p>
                    <form
                      className={styles.libraryForm}
                      onSubmit={(event) => {
                        event.preventDefault();
                        setError(null);
                        addLibrary.mutate();
                      }}
                    >
                      <div className={styles.field}>
                        <Label htmlFor="lib-name">Library name</Label>
                        <Input
                          id="lib-name"
                          value={libraryName}
                          onChange={(e) => setLibraryName(e.target.value)}
                          required
                        />
                      </div>
                      <div className={styles.field}>
                        <Label htmlFor="lib-kind">Content type</Label>
                        <select
                          id="lib-kind"
                          className={styles.select}
                          value={libraryKind}
                          onChange={(e) => setLibraryKind(e.target.value as LibraryKind)}
                        >
                          <option value="movies">Movies</option>
                          <option value="tv">TV series</option>
                        </select>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button type="submit" disabled={addLibrary.isPending}>
                          {addLibrary.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Creating…
                            </>
                          ) : (
                            "Create & scan"
                          )}
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setPendingDir(null)}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </div>
      </div>
    </AdminPage>
  );
}

function ServerStatusBadge({ server }: { server: AdminSmbServer }) {
  if (server.lastError) {
    return (
      <span className={cn(styles.badge, styles.badgeOffline)}>
        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
        Offline
      </span>
    );
  }
  if (server.lastOkAt) {
    return (
      <span className={cn(styles.badge, styles.badgeOnline)}>
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Connected
      </span>
    );
  }
  return <span className={cn(styles.badge, styles.badgeIdle)}>Not tested</span>;
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
