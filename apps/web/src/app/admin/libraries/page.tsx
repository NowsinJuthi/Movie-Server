"use client";

import { hasMinimumRole, LIBRARY_KINDS, UserRole, type AdminLibrary, type AdminLibraryItem, type AdminLibraryScan } from "@movie-server/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth-store";
import { ApiError } from "@/lib/api";
import { libraryApi } from "@/lib/library-api";
import { ScreenMessage } from "@/components/profiles/pin-dialog";
import { AdminPage } from "@/components/admin/admin-page";

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
      const active = query.state.data?.scans.some((scan) => scan.status === "queued" || scan.status === "running");
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
    refetchInterval: activeScan?.status === "running" || activeScan?.status === "queued" ? 1000 : false,
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
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : "Could not create library."),
  });

  const scan = useMutation({
    mutationFn: (libraryId?: string) => libraryApi.startScan({ libraryId, full: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-library-scans"] });
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : "Could not start scan."),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => libraryApi.cancel(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-library-scans"] }),
  });

  const toggle = useMutation({
    mutationFn: (library: AdminLibrary) => libraryApi.update(library.id, { enabled: !library.enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-libraries"] }),
  });

  const updateLibrary = useMutation({
    mutationFn: (opts?: { clearImage?: boolean }) => {
      if (!editing) throw new Error("No library selected");
      const imageUrl = editImageUrl.trim();
      const body: { name: string; imageUrl?: string | null } = {
        name: editName.trim(),
      };
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
      setEditImageUrl(data.library.imageUrl?.startsWith("http") ? data.library.imageUrl : "");
      queryClient.invalidateQueries({ queryKey: ["admin-libraries"] });
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : "Could not update library."),
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
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : "Could not upload image."),
  });

  function openEdit(library: AdminLibrary) {
    setError(null);
    setEditing(library);
    setEditName(library.name);
    setEditImageUrl(library.imageUrl?.startsWith("http") ? library.imageUrl : "");
  }

  if (!user || !hasMinimumRole(user.role, UserRole.Admin)) {
    return <ScreenMessage>Checking access...</ScreenMessage>;
  }

  const libraries = librariesQuery.data?.libraries ?? [];
  const items = itemsQuery.data?.items ?? [];

  return (
    <AdminPage
      title="Media libraries"
      description="Add a folder and scan — movies and series are created automatically, with posters from poster.jpg in the folder or TMDB if TMDB_API_KEY is set."
      error={error}
      actions={
        <Button variant="outline" onClick={() => scan.mutate(undefined)} disabled={scan.isPending}>
          Scan all
        </Button>
      }
    >
        <form
          className="grid gap-4 rounded-xl border border-border p-4 md:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            create.mutate();
          }}
        >
          <div>
            <Label htmlFor="lib-name">Name</Label>
            <Input id="lib-name" value={name} onChange={(event) => setName(event.target.value)} required />
          </div>
          <div>
            <Label htmlFor="lib-kind">Kind</Label>
            <select
              id="lib-kind"
              className="flex h-10 w-full rounded-md border border-input bg-background/60 px-3 text-sm"
              value={kind}
              onChange={(event) => setKind(event.target.value as (typeof LIBRARY_KINDS)[number])}
            >
              <option value="movies">Movies</option>
              <option value="tv">TV</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="lib-root">Media directory</Label>
            <Input
              id="lib-root"
              value={rootPath}
              onChange={(event) => setRootPath(event.target.value)}
              placeholder="Absolute folder on this server"
              required
            />
          </div>
          <div className="md:col-span-4">
            <Button type="submit" disabled={create.isPending}>
              Add library
            </Button>
          </div>
        </form>

        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Picture</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Kind</th>
                <th className="px-4 py-3">Folder</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Missing</th>
                <th className="px-4 py-3">Unmatched</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {libraries.map((library) => (
                <tr key={library.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    {library.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={library.imageUrl}
                        alt=""
                        className="h-12 w-12 rounded-md object-cover border border-border"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-md border border-border bg-secondary text-[10px] text-muted-foreground">
                        No img
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div>{library.name}</div>
                    {library.provider === "smb" ? (
                      <div className="text-xs text-primary">Samba · {library.smbShare ?? library.rootLabel}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 capitalize">{library.kind}</td>
                  <td className="px-4 py-3">{library.rootLabel}</td>
                  <td className="px-4 py-3">{library.itemCount}</td>
                  <td className="px-4 py-3">{library.missingCount}</td>
                  <td className="px-4 py-3">{library.unmatchedCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(library)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setSelectedId(library.id)}>
                        Items
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => scan.mutate(library.id)} disabled={scan.isPending}>
                        {library.enabled ? "Rescan" : "Scan"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggle.mutate(library)}>
                        {library.enabled ? "Disable" : "Enable"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {editing ? (
          <section className="rounded-xl border border-border p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium">Edit library</h2>
                <p className="text-sm text-muted-foreground">
                  Update the display name and library picture.
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                Close
              </Button>
            </div>

            <form
              className="grid gap-4 md:grid-cols-[8rem_1fr]"
              onSubmit={(event) => {
                event.preventDefault();
                setError(null);
                updateLibrary.mutate();
              }}
            >
              <div className="space-y-2">
                <Label>Picture</Label>
                {editing.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={editing.imageUrl}
                    alt=""
                    className="aspect-square w-full rounded-lg border border-border object-cover"
                  />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-border bg-secondary text-xs text-muted-foreground">
                    No picture
                  </div>
                )}
              </div>

              <div className="grid gap-4">
                <div>
                  <Label htmlFor="edit-lib-name">Name</Label>
                  <Input
                    id="edit-lib-name"
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-lib-image">Picture URL (https)</Label>
                  <Input
                    id="edit-lib-image"
                    value={editImageUrl}
                    onChange={(event) => setEditImageUrl(event.target.value)}
                    placeholder="https://example.com/library.jpg"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Paste an https image URL, or upload a JPEG/PNG/WebP below.
                  </p>
                </div>
                <div>
                  <Label htmlFor="edit-lib-file">Or upload picture</Label>
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
          <section className="rounded-xl border border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-medium">
                Scan {activeScan.status}
                {activeScan.total > 0 ? ` · ${activeScan.processed}/${activeScan.total}` : ""}
              </h2>
              {activeScan.status === "running" || activeScan.status === "queued" ? (
                <Button size="sm" variant="outline" onClick={() => cancel.mutate(activeScan.id)}>
                  Cancel
                </Button>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              Matched {activeScan.matched} · Missing {activeScan.missing} · Duplicates {activeScan.duplicates} · Errors{" "}
              {activeScan.errors}
            </p>
            <ul className="mt-3 max-h-48 space-y-1 overflow-auto text-xs text-muted-foreground">
              {(logsQuery.data?.logs ?? []).map((log) => (
                <li key={log.id}>
                  <span className="uppercase">{log.level}</span> · {log.message}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {selectedId ? (
          <section className="overflow-hidden rounded-xl border border-border">
            <div className="border-b border-border px-4 py-3 text-sm font-medium">Library items</div>
            <table className="w-full text-left text-sm">
              <thead className="bg-secondary text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">File</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Match</th>
                  <th className="px-4 py-3">Resolution</th>
                  <th className="px-4 py-3">Codec</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: AdminLibraryItem) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="px-4 py-3">{item.fileName}</td>
                    <td className="px-4 py-3">{item.ignored ? "ignored" : item.status}</td>
                    <td className="px-4 py-3">{item.ignored ? "excluded" : (item.matchTitle ?? item.match)}</td>
                    <td className="px-4 py-3">{item.probe?.resolution ?? "—"}</td>
                    <td className="px-4 py-3">{item.probe?.videoCodec ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}
    </AdminPage>
  );
}
