"use client";

import {
  hasMinimumRole,
  LIBRARY_KINDS,
  UserRole,
  type AdminLibrary,
  type AdminLibraryItem,
  type AdminLibraryScan,
} from "@movie-server/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Film,
  FolderOpen,
  HardDrive,
  ListVideo,
  Pencil,
  Power,
  RefreshCw,
  ScanSearch,
  Server,
  Trash2,
  Tv,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import styles from "@/components/admin/libraries-page.module.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { libraryApi } from "@/lib/library-api";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";

export default function AdminLibrariesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, status } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("Movies");
  const [kind, setKind] = useState<(typeof LIBRARY_KINDS)[number]>("movies");
  const [rootPath, setRootPath] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminLibrary | null>(null);
  const [editName, setEditName] = useState("");
  const [editRootPath, setEditRootPath] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");

  const librariesQuery = useQuery({
    queryKey: ["admin-libraries"],
    queryFn: libraryApi.list,
    enabled: Boolean(user && hasMinimumRole(user.role, UserRole.Admin)),
  });

  const scansQuery = useQuery({
    queryKey: ["admin-library-scans"],
    queryFn: libraryApi.scans,
    enabled: Boolean(user && hasMinimumRole(user.role, UserRole.Admin)),
    refetchInterval: (query) => {
      const active = query.state.data?.scans.some(
        (scan) => scan.status === "queued" || scan.status === "running",
      );
      return active ? 1000 : 8000;
    },
  });

  const itemsQuery = useQuery({
    queryKey: ["admin-library-items", selectedId],
    queryFn: () => libraryApi.items(selectedId!),
    enabled: Boolean(selectedId && user && hasMinimumRole(user.role, UserRole.Admin)),
  });

  const activeScan = scansQuery.data?.scans[0] as AdminLibraryScan | undefined;
  const logsQuery = useQuery({
    queryKey: ["admin-library-scan-logs", activeScan?.id],
    queryFn: () => libraryApi.logs(activeScan!.id),
    enabled: Boolean(activeScan?.id),
    refetchInterval:
      activeScan?.status === "running" || activeScan?.status === "queued" ? 1000 : false,
  });

  useEffect(() => {
    if (activeScan?.status === "completed") {
      queryClient.invalidateQueries({ queryKey: ["admin-libraries"] });
      queryClient.invalidateQueries({ queryKey: ["admin-library-items"] });
    }
  }, [activeScan?.status, queryClient]);

  useEffect(() => {
    if (status === "anonymous") {
      router.replace("/login?next=/admin/libraries");
    } else if (user && !hasMinimumRole(user.role, UserRole.Admin)) {
      router.replace("/unauthorized");
    }
  }, [status, user, router]);

  const create = useMutation({
    mutationFn: () => libraryApi.create({ name, kind, rootPath }),
    onSuccess: (data) => {
      setRootPath("");
      setSelectedId(data.library.id);
      queryClient.invalidateQueries({ queryKey: ["admin-libraries"] });
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : "Could not create library."),
  });

  const scan = useMutation({
    mutationFn: (libraryId?: string) => libraryApi.startScan({ libraryId, full: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-library-scans"] });
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : "Could not start scan."),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => libraryApi.cancel(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-library-scans"] }),
  });

  const toggle = useMutation({
    mutationFn: (library: AdminLibrary) =>
      libraryApi.update(library.id, { enabled: !library.enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-libraries"] }),
  });

  const removeLibrary = useMutation({
    mutationFn: (id: string) => libraryApi.remove(id),
    onSuccess: (_data, id) => {
      if (selectedId === id) setSelectedId(null);
      if (editing?.id === id) setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["admin-libraries"] });
      queryClient.invalidateQueries({ queryKey: ["admin-library-items"] });
      queryClient.invalidateQueries({ queryKey: ["admin-library-scans"] });
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : "Could not delete library."),
  });

  const updateLibrary = useMutation({
    mutationFn: (opts?: { clearImage?: boolean }) => {
      if (!editing) throw new Error("No library selected");
      const imageUrl = editImageUrl.trim();
      const body: { name: string; rootPath?: string; imageUrl?: string | null } = {
        name: editName.trim(),
      };
      if (editing.provider !== "smb") {
        body.rootPath = editRootPath.trim();
      }
      if (opts?.clearImage) {
        body.imageUrl = null;
      } else if (imageUrl.startsWith("http")) {
        body.imageUrl = imageUrl;
      }
      return libraryApi.update(editing.id, body);
    },
    onSuccess: (data) => {
      setEditing(data.library);
      setEditName(data.library.name);
      setEditRootPath(data.library.rootPath);
      setEditImageUrl(data.library.imageUrl?.startsWith("http") ? data.library.imageUrl : "");
      queryClient.invalidateQueries({ queryKey: ["admin-libraries"] });
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : "Could not update library."),
  });

  const uploadImage = useMutation({
    mutationFn: (file: File) => {
      if (!editing) throw new Error("No library selected");
      return libraryApi.uploadImage(editing.id, file);
    },
    onSuccess: (data) => {
      setEditing(data.library);
      setEditImageUrl("");
      queryClient.invalidateQueries({ queryKey: ["admin-libraries"] });
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : "Could not upload image."),
  });

  function openEdit(library: AdminLibrary) {
    setError(null);
    setEditing(library);
    setEditName(library.name);
    setEditRootPath(library.rootPath);
    setEditImageUrl(library.imageUrl?.startsWith("http") ? library.imageUrl : "");
  }

  const libraries = librariesQuery.data?.libraries ?? [];
  const items = itemsQuery.data?.items ?? [];

  const totals = useMemo(() => {
    return libraries.reduce(
      (acc, library) => {
        acc.items += library.itemCount;
        acc.missing += library.missingCount;
        acc.unmatched += library.unmatchedCount;
        return acc;
      },
      { items: 0, missing: 0, unmatched: 0 },
    );
  }, [libraries]);

  const scanPct =
    activeScan && activeScan.total > 0
      ? Math.min(100, Math.round((activeScan.processed / activeScan.total) * 100))
      : activeScan?.status === "running"
        ? 12
        : 0;

  if (status === "loading" || status === "idle" || !user || !hasMinimumRole(user.role, UserRole.Admin)) {
    return (
      <AdminPage title="Media libraries" description="Connect folders, scan media, and keep posters in sync.">
        <p className="text-sm text-muted-foreground">Checking access...</p>
      </AdminPage>
    );
  }

  return (
    <AdminPage
      title="Media libraries"
      description="Connect folders, scan media, and keep posters in sync from local artwork or TMDB."
      error={error}
      actions={
        <Button
          variant="outline"
          onClick={() => scan.mutate(undefined)}
          disabled={scan.isPending}
          className="gap-2"
        >
          <ScanSearch className="h-4 w-4" />
          Scan all
        </Button>
      }
    >
      <div className={styles.layout}>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Libraries</span>
            <span className={styles.statValue}>{libraries.length}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Indexed files</span>
            <span className={styles.statValue}>{totals.items}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Missing</span>
            <span className={styles.statValue}>{totals.missing}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Unmatched</span>
            <span className={styles.statValue}>{totals.unmatched}</span>
          </div>
        </div>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <h2 className={styles.panelTitle}>Add library</h2>
              <p className={styles.panelHint}>
                Point to an absolute folder on this server. Movies and series import on scan.
              </p>
            </div>
          </div>
          <form
            className={styles.formGrid}
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              create.mutate();
            }}
          >
            <div className={styles.field}>
              <Label htmlFor="lib-name">Name</Label>
              <Input
                id="lib-name"
                className={styles.inputLike}
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>
            <div className={styles.field}>
              <Label htmlFor="lib-kind">Kind</Label>
              <select
                id="lib-kind"
                className={styles.select}
                value={kind}
                onChange={(event) => setKind(event.target.value as (typeof LIBRARY_KINDS)[number])}
              >
                <option value="movies">Movies</option>
                <option value="tv">TV</option>
              </select>
            </div>
            <div className={styles.field}>
              <Label htmlFor="lib-root">Media directory</Label>
              <Input
                id="lib-root"
                className={styles.inputLike}
                value={rootPath}
                onChange={(event) => setRootPath(event.target.value)}
                placeholder="D:\Media\Movies"
                required
              />
            </div>
            <Button type="submit" disabled={create.isPending} className="gap-2">
              <HardDrive className="h-4 w-4" />
              {create.isPending ? "Adding..." : "Add library"}
            </Button>
          </form>
        </section>

        {libraries.length === 0 ? (
          <div className={styles.empty}>
            <HardDrive className="mx-auto mb-3 h-8 w-8 opacity-60" />
            <p>No libraries yet. Add a folder above or import one from Samba file manager.</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {libraries.map((library) => {
              const KindIcon = library.kind === "tv" ? Tv : Film;
              return (
                <article
                  key={library.id}
                  className={cn(styles.card, selectedId === library.id && styles.cardSelected)}
                >
                  <div className={styles.cardMedia}>
                    {library.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={library.imageUrl} alt="" />
                    ) : (
                      <span className={styles.cardMediaFallback} aria-hidden />
                    )}
                    <div className={styles.cardBadgeRow}>
                      <span className={cn(styles.badge, styles.badgeKind)}>
                        <KindIcon className="h-3 w-3" />
                        {library.kind}
                      </span>
                      <span
                        className={cn(
                          styles.badge,
                          library.enabled ? styles.badgeOn : styles.badgeOff,
                        )}
                      >
                        {library.enabled ? "Enabled" : "Disabled"}
                      </span>
                      {library.provider === "smb" ? (
                        <span className={styles.badge}>
                          <Server className="h-3 w-3" />
                          Samba
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className={styles.cardBody}>
                    <div>
                      <h3 className={styles.cardTitle}>{library.name}</h3>
                      <p className={styles.cardPath} title={library.rootPath}>
                        <FolderOpen className="mr-1 inline h-3.5 w-3.5" />
                        {library.rootPath || library.rootLabel}
                      </p>
                      {library.provider === "smb" ? (
                        <p className={styles.cardMeta}>
                          {library.smbShare ?? library.rootLabel}
                        </p>
                      ) : null}
                    </div>

                    <div className={styles.metrics}>
                      <div className={styles.metric}>
                        <span className={styles.metricLabel}>Items</span>
                        <span className={styles.metricValue}>{library.itemCount}</span>
                      </div>
                      <div className={styles.metric}>
                        <span className={styles.metricLabel}>Missing</span>
                        <span className={styles.metricValue}>{library.missingCount}</span>
                      </div>
                      <div className={styles.metric}>
                        <span className={styles.metricLabel}>Gaps</span>
                        <span className={styles.metricValue}>{library.unmatchedCount}</span>
                      </div>
                    </div>

                    <div className={styles.actions}>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openEdit(library)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => setSelectedId(library.id)}
                      >
                        <ListVideo className="h-3.5 w-3.5" />
                        Items
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => scan.mutate(library.id)}
                        disabled={scan.isPending}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        {library.enabled ? "Rescan" : "Scan"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5"
                        onClick={() => toggle.mutate(library)}
                      >
                        <Power className="h-3.5 w-3.5" />
                        {library.enabled ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                        disabled={removeLibrary.isPending}
                        onClick={() => {
                          const ok = window.confirm(
                            `Delete library “${library.name}”? Catalog items from this folder may be removed if they are no longer playable.`,
                          );
                          if (!ok) return;
                          setError(null);
                          removeLibrary.mutate(library.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {editing ? (
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h2 className={styles.panelTitle}>Edit library</h2>
                <p className={styles.panelHint}>Update name, media directory, and cover picture.</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)} className="gap-1">
                <X className="h-4 w-4" />
                Close
              </Button>
            </div>

            <form
              className={styles.editGrid}
              onSubmit={(event) => {
                event.preventDefault();
                setError(null);
                updateLibrary.mutate();
              }}
            >
              <div className={styles.preview}>
                {editing.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={editing.imageUrl} alt="" />
                ) : (
                  <div className={styles.previewEmpty}>No picture</div>
                )}
              </div>

              <div className="grid gap-4">
                <div className={styles.field}>
                  <Label htmlFor="edit-lib-name">Name</Label>
                  <Input
                    id="edit-lib-name"
                    className={styles.inputLike}
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <Label htmlFor="edit-lib-root">Media directory</Label>
                  <Input
                    id="edit-lib-root"
                    className={styles.inputLike}
                    value={editRootPath}
                    onChange={(event) => setEditRootPath(event.target.value)}
                    placeholder="D:\Media\Movies"
                    required={editing.provider !== "smb"}
                    disabled={editing.provider === "smb"}
                    readOnly={editing.provider === "smb"}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {editing.provider === "smb"
                      ? "Samba library paths are managed from Samba file manager."
                      : "Change the folder path, then run a scan so items refresh."}
                  </p>
                </div>
                <div className={styles.field}>
                  <Label htmlFor="edit-lib-image">Picture URL (https)</Label>
                  <Input
                    id="edit-lib-image"
                    className={styles.inputLike}
                    value={editImageUrl}
                    onChange={(event) => setEditImageUrl(event.target.value)}
                    placeholder="https://example.com/library.jpg"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Paste an https image URL, or upload a JPEG / PNG / WebP below.
                  </p>
                </div>
                <div className={styles.field}>
                  <Label htmlFor="edit-lib-file">Upload picture</Label>
                  <Input
                    id="edit-lib-file"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="mt-1"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        setError(null);
                        uploadImage.mutate(file);
                      }
                      event.target.value = "";
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={updateLibrary.isPending || uploadImage.isPending}>
                    Save changes
                  </Button>
                  {editing.imageUrl ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={updateLibrary.isPending || uploadImage.isPending}
                      onClick={() => {
                        setError(null);
                        setEditImageUrl("");
                        updateLibrary.mutate({ clearImage: true });
                      }}
                    >
                      Clear picture
                    </Button>
                  ) : null}
                  <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </form>
          </section>
        ) : null}

        {activeScan ? (
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h2 className={styles.panelTitle}>
                  Scan {activeScan.status}
                  {activeScan.total > 0 ? ` · ${activeScan.processed}/${activeScan.total}` : ""}
                </h2>
                <p className={styles.panelHint}>
                  Matched {activeScan.matched} · Missing {activeScan.missing} · Duplicates{" "}
                  {activeScan.duplicates} · Errors {activeScan.errors}
                </p>
              </div>
              {activeScan.status === "running" || activeScan.status === "queued" ? (
                <Button size="sm" variant="outline" onClick={() => cancel.mutate(activeScan.id)}>
                  Cancel
                </Button>
              ) : null}
            </div>
            <div className={styles.scanBar}>
              <div className={styles.scanFill} style={{ width: `${scanPct}%` }} />
            </div>
            <div className={cn(styles.logs, "brand-scrollbar")}>
              {(logsQuery.data?.logs ?? []).length === 0 ? (
                <div>Waiting for scan output...</div>
              ) : (
                (logsQuery.data?.logs ?? []).map((log) => (
                  <div key={log.id}>
                    <strong>{log.level.toUpperCase()}</strong> · {log.message}
                  </div>
                ))
              )}
            </div>
          </section>
        ) : null}

        {selectedId ? (
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h2 className={styles.panelTitle}>Library items</h2>
                <p className={styles.panelHint}>
                  {items.length} file{items.length === 1 ? "" : "s"} in the selected library.
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSelectedId(null)} className="gap-1">
                <X className="h-4 w-4" />
                Close
              </Button>
            </div>
            <div className={styles.itemsWrap}>
              <table className={styles.itemsTable}>
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Status</th>
                    <th>Match</th>
                    <th>Resolution</th>
                    <th>Codec</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: AdminLibraryItem) => {
                    const status = item.ignored ? "ignored" : item.status;
                    const statusClass =
                      status === "matched" || status === "imported"
                        ? styles.statusMatched
                        : status === "missing" || status === "unmatched"
                          ? styles.statusMissing
                          : status === "error"
                            ? styles.statusError
                            : undefined;
                    return (
                      <tr key={item.id}>
                        <td>{item.fileName}</td>
                        <td>
                          <span className={cn(styles.statusPill, statusClass)}>{status}</span>
                        </td>
                        <td>{item.ignored ? "excluded" : (item.matchTitle ?? item.match)}</td>
                        <td>{item.probe?.resolution ?? "—"}</td>
                        <td>{item.probe?.videoCodec ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {items.length === 0 ? (
                <p className="px-4 py-8 text-sm text-muted-foreground">No items indexed yet.</p>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </AdminPage>
  );
}
