"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { movieApi } from "@/lib/movie-api";

export default function AdminCollectionsPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin-collections"],
    queryFn: movieApi.adminCollections,
  });

  const create = useMutation({
    mutationFn: () => movieApi.createCollection({ name, description }),
    onSuccess: async () => {
      setError(null);
      setName("");
      setDescription("");
      await queryClient.invalidateQueries({ queryKey: ["admin-collections"] });
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : "Unable to create collection."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => movieApi.removeCollection(id),
    onSuccess: async () => {
      setPending(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-collections"] });
    },
  });

  return (
    <AdminPage title="Movie collections" description="Group titles for homepage rows and browse pages." error={error ?? (remove.error instanceof ApiError ? remove.error.message : null)}>
      <div className="space-y-8">
        <form
          className="space-y-4 rounded-xl border border-border p-5"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <Button type="submit" disabled={create.isPending}>
            Create collection
          </Button>
        </form>
        <ul className="space-y-3">
          {(query.data?.collections ?? []).map((collection) => (
            <li key={collection.id} className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
              <div>
                <p className="font-medium">{collection.name}</p>
                <p className="text-sm text-muted-foreground">
                  {collection.movieCount} titles · {collection.slug}
                </p>
              </div>
              <Button variant="ghost" onClick={() => setPending(collection.id)}>
                Delete
              </Button>
            </li>
          ))}
        </ul>
        <ConfirmDialog
          open={Boolean(pending)}
          title="Delete this collection?"
          description="Titles stay in the catalog. Only the collection grouping is removed."
          confirmLabel="Delete"
          pending={remove.isPending}
          onClose={() => setPending(null)}
          onConfirm={() => pending && remove.mutate(pending)}
        />
      </div>
    </AdminPage>
  );
}
