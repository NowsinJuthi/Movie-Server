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
import { Folder, Film, HardDrive, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { useAuthStore } from "@/stores/auth-store";
import { ApiError } from "@/lib/api";
import { smbApi } from "@/lib/smb-api";
import { libraryApi } from "@/lib/library-api";
import { ScreenMessage } from "@/components/profiles/pin-dialog";

export default function AdminFileManagerPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, status } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [browsePath, setBrowsePath] = useState("");
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("445");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [domain, setDomain] = useState("WORKGROUP");
  const [share, setShare] = useState("");
  const [libraryName, setLibraryName] = useState("");
  const [libraryKind, setLibraryKind] = useState<LibraryKind>("movies");
  const [pendingDir, setPendingDir] = useState<AdminSmbBrowseEntry | null>(null);

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
    }
  }, [status, user, router]);

  const create = useMutation({
    mutationFn: () =>
      smbApi.create({
        name: name.trim() || `${host}/${share}`,
        host: host.trim(),
        port: Number(port) || 445,
        username: username.trim(),
        password,
        domain: domain.trim() || "WORKGROUP",
        share: share.trim(),
      }),
    onSuccess: (data) => {
      setPassword("");
      setSelectedId(data.server.id);
      setBrowsePath("");
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
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : "Connection test failed."),
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

  if (!user || !hasMinimumRole(user.role, UserRole.Admin)) {
    return <ScreenMessage>Checking access...</ScreenMessage>;
  }

  return (
    <main className="flex h-full min-h-dvh w-full flex-col overflow-hidden bg-background p-3 sm:p-4 md:p-5 lg:p-6 lg:min-h-0">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card/40">
        <header className="shrink-0 border-b border-border px-4 py-3 sm:px-5">
          <h1 className="text-xl font-semibold">Samba file manager</h1>
          <p className="text-sm text-muted-foreground">
            Connect an Ubuntu Samba share with IP, username and password, browse folders, then add a
            directory directly as a movie or TV library.
          </p>
        </header>

        {error ? (
          <div className="shrink-0 border-b border-border px-4 py-2 sm:px-5">
            <Alert>{error}</Alert>
          </div>
        ) : null}

        <form
          className="grid shrink-0 gap-3 border-b border-border px-4 py-3 sm:px-5 md:grid-cols-3 lg:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            create.mutate();
          }}
        >
          <div>
            <Label htmlFor="smb-name">Display name</Label>
            <Input id="smb-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Home NAS" />
          </div>
          <div>
            <Label htmlFor="smb-host">Server IP / host</Label>
            <Input
              id="smb-host"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="192.168.0.10"
              required
            />
          </div>
          <div>
            <Label htmlFor="smb-port">Port</Label>
            <Input id="smb-port" value={port} onChange={(e) => setPort(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="smb-share">Share name</Label>
            <Input
              id="smb-share"
              value={share}
              onChange={(e) => setShare(e.target.value)}
              placeholder="movies"
              required
            />
          </div>
          <div>
            <Label htmlFor="smb-user">Username</Label>
            <Input id="smb-user" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="smb-pass">Password</Label>
            <Input
              id="smb-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="smb-domain">Domain</Label>
            <Input id="smb-domain" value={domain} onChange={(e) => setDomain(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Connecting..." : "Add Samba server"}
            </Button>
          </div>
        </form>

        <div className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[16rem_1fr]">
          <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-background/60">
            <h2 className="shrink-0 border-b border-border px-3 py-2 text-sm font-medium text-muted-foreground">
              Servers
            </h2>
            <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
              {servers.map((server: AdminSmbServer) => (
                <li key={server.id}>
                  <button
                    type="button"
                    className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                      selectedId === server.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-secondary"
                    }`}
                    onClick={() => {
                      setSelectedId(server.id);
                      setBrowsePath("");
                      setPendingDir(null);
                      setError(null);
                    }}
                  >
                    <Server className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{server.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {server.host}/{server.share}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              {servers.length === 0 ? (
                <li className="px-2 py-6 text-center text-xs text-muted-foreground">No Samba servers yet</li>
              ) : null}
            </ul>
          </section>

          <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-background/60">
            {!selected ? (
              <div className="flex min-h-[16rem] flex-1 flex-col items-center justify-center gap-2 text-sm text-muted-foreground lg:min-h-0">
                <HardDrive className="h-8 w-8 opacity-50" />
                Select or add a Samba server to browse folders
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-medium">{selected.name}</h2>
                    <p className="truncate text-xs text-muted-foreground">
                      {`\\\\${selected.host}\\${selected.share}${
                        browsePath ? `\\${browsePath.replace(/\//g, "\\")}` : ""
                      }`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => test.mutate(selected.id)} disabled={test.isPending}>
                      Test
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Remove ${selected.name}?`)) remove.mutate(selected.id);
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={browsePath === ""}
                    onClick={() => setBrowsePath(parentPath ?? "")}
                  >
                    Up
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setBrowsePath("")}>
                    Share root
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => browseQuery.refetch()}
                    disabled={browseQuery.isFetching}
                  >
                    Refresh
                  </Button>
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
                    Add current folder
                  </Button>
                </div>

                {browseQuery.isError ? (
                  <div className="shrink-0 px-3 py-2">
                    <Alert>
                      {browseQuery.error instanceof ApiError
                        ? browseQuery.error.message
                        : "Could not browse this share."}
                    </Alert>
                  </div>
                ) : null}

                <div className="min-h-0 flex-1 overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-secondary text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Size</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => (
                        <tr key={entry.path} className="border-t border-border">
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              className="inline-flex items-center gap-2 hover:text-primary"
                              onClick={() => {
                                if (entry.kind === "directory") {
                                  setBrowsePath(entry.path);
                                  setPendingDir(null);
                                }
                              }}
                            >
                              {entry.kind === "directory" ? (
                                <Folder className="h-4 w-4 text-primary" />
                              ) : (
                                <Film className="h-4 w-4 text-muted-foreground" />
                              )}
                              {entry.name}
                            </button>
                          </td>
                          <td className="px-3 py-2 capitalize text-muted-foreground">
                            {entry.kind === "directory" ? "Folder" : entry.isVideo ? "Video" : "File"}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {entry.sizeBytes != null ? formatBytes(entry.sizeBytes) : "—"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {entry.kind === "directory" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setPendingDir(entry);
                                  setLibraryName(entry.name);
                                }}
                              >
                                Add to library
                              </Button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                      {!browseQuery.isLoading && entries.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                            Empty folder
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>

        {pendingDir && selected ? (
          <section className="shrink-0 border-t border-primary/30 bg-primary/5 px-4 py-3 sm:px-5">
            <h2 className="text-base font-medium">Add folder as media library</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {`\\\\${selected.host}\\${selected.share}${
                pendingDir.path ? `\\${pendingDir.path.replace(/\//g, "\\")}` : ""
              }`}
            </p>
            <form
              className="mt-3 grid gap-3 md:grid-cols-3"
              onSubmit={(event) => {
                event.preventDefault();
                setError(null);
                addLibrary.mutate();
              }}
            >
              <div>
                <Label htmlFor="lib-name">Library name</Label>
                <Input
                  id="lib-name"
                  value={libraryName}
                  onChange={(e) => setLibraryName(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="lib-kind">Kind</Label>
                <select
                  id="lib-kind"
                  className="flex h-10 w-full rounded-md border border-input bg-background/60 px-3 text-sm"
                  value={libraryKind}
                  onChange={(e) => setLibraryKind(e.target.value as LibraryKind)}
                >
                  <option value="movies">Movies</option>
                  <option value="tv">TV</option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" disabled={addLibrary.isPending}>
                  {addLibrary.isPending ? "Adding..." : "Create library & scan"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setPendingDir(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
