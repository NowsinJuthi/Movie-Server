"use client";

import { MOVIE_GENRES, MATURITY_LEVELS } from "@movie-server/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { movieApi } from "@/lib/movie-api";

const emptyForm = {
  title: "",
  originalTitle: "",
  description: "A new catalog title.",
  releaseYear: new Date().getFullYear(),
  runtimeMinutes: 120,
  genres: ["drama"] as string[],
  tags: "",
  directors: "",
  writers: "",
  maturityRating: "mature",
  published: false,
  featured: false,
  trending: false,
  popular: false,
};

export default function AdminMoviesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [pendingDelete, setPendingDelete] = useState(false);

  const query = useQuery({
    queryKey: ["admin-movies", q],
    queryFn: () => movieApi.adminList({ q: q || undefined, limit: 50, sort: "newest" }),
  });

  const create = useMutation({
    mutationFn: () =>
      movieApi.create({
        title: form.title,
        originalTitle: form.originalTitle || null,
        description: form.description,
        releaseYear: Number(form.releaseYear),
        runtimeMinutes: Number(form.runtimeMinutes),
        genres: form.genres,
        tags: form.tags
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        directors: form.directors
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        writers: form.writers
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        maturityRating: form.maturityRating,
        published: form.published,
        featured: form.featured,
        trending: form.trending,
        popular: form.popular,
      }),
    onSuccess: async () => {
      setError(null);
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ["admin-movies"] });
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : "Unable to create movie.");
    },
  });

  const bulk = useMutation({
    mutationFn: (action: "publish" | "unpublish" | "delete" | "feature" | "trending") => movieApi.bulk(selected, action),
    onSuccess: async () => {
      setSelected([]);
      setPendingDelete(false);
      await queryClient.invalidateQueries({ queryKey: ["admin-movies"] });
    },
  });

  const items = query.data?.items ?? [];
  const allSelected = items.length > 0 && items.every((item) => selected.includes(item.id));

  return (
    <AdminPage
      title="Movies"
      description="Catalog metadata is stored in MongoDB. Physical files stay behind opaque media keys."
      error={error ?? (bulk.error instanceof ApiError ? bulk.error.message : null)}
    >
      <div className="space-y-8">
        <form
          className="grid gap-4 rounded-xl border border-border p-5 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="originalTitle">Original title</Label>
            <Input
              id="originalTitle"
              value={form.originalTitle}
              onChange={(e) => setForm({ ...form, originalTitle: e.target.value })}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              className="min-h-24 w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="year">Year</Label>
            <Input
              id="year"
              type="number"
              value={form.releaseYear}
              onChange={(e) => setForm({ ...form, releaseYear: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="runtime">Runtime (minutes)</Label>
            <Input
              id="runtime"
              type="number"
              value={form.runtimeMinutes}
              onChange={(e) => setForm({ ...form, runtimeMinutes: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label>Genres</Label>
            <select
              multiple
              className="h-24 w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm"
              value={form.genres}
              onChange={(e) =>
                setForm({ ...form, genres: Array.from(e.target.selectedOptions).map((option) => option.value) })
              }
            >
              {MOVIE_GENRES.map((genre) => (
                <option key={genre} value={genre}>
                  {genre}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Maturity</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background/60 px-3 text-sm"
              value={form.maturityRating}
              onChange={(e) => setForm({ ...form, maturityRating: e.target.value })}
            >
              {MATURITY_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tags">Tags (comma separated)</Label>
            <Input id="tags" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="directors">Directors</Label>
            <Input id="directors" value={form.directors} onChange={(e) => setForm({ ...form, directors: e.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="writers">Writers</Label>
            <Input id="writers" value={form.writers} onChange={(e) => setForm({ ...form, writers: e.target.value })} />
          </div>
          <div className="flex flex-wrap gap-4 text-sm md:col-span-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => setForm({ ...form, published: e.target.checked })}
              />
              Publish
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => setForm({ ...form, featured: e.target.checked })}
              />
              Featured
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.trending}
                onChange={(e) => setForm({ ...form, trending: e.target.checked })}
              />
              Trending
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.popular}
                onChange={(e) => setForm({ ...form, popular: e.target.checked })}
              />
              Popular
            </label>
          </div>
          <Button className="md:col-span-2" type="submit" disabled={create.isPending}>
            Create movie
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter catalog..." className="max-w-sm" />
          <Button variant="outline" disabled={!selected.length} onClick={() => bulk.mutate("publish")}>
            Publish selected
          </Button>
          <Button variant="outline" disabled={!selected.length} onClick={() => bulk.mutate("feature")}>
            Feature
          </Button>
          <Button variant="outline" disabled={!selected.length} onClick={() => bulk.mutate("trending")}>
            Trending
          </Button>
          <Button variant="outline" disabled={!selected.length} onClick={() => bulk.mutate("unpublish")}>
            Unpublish
          </Button>
          <Button variant="destructive" disabled={!selected.length} onClick={() => setPendingDelete(true)}>
            Delete
          </Button>
        </div>

        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary text-muted-foreground">
              <tr>
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => setSelected(e.target.checked ? items.map((item) => item.id) : [])}
                  />
                </th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Year</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Availability</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(item.id)}
                      onChange={(e) =>
                        setSelected((current) =>
                          e.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id),
                        )
                      }
                    />
                  </td>
                  <td className="px-4 py-3">{item.title}</td>
                  <td className="px-4 py-3">{item.releaseYear}</td>
                  <td className="px-4 py-3">{item.published ? "Published" : "Draft"}</td>
                  <td className="px-4 py-3">{item.availability}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => router.push(`/admin/movies/${item.id}`)}>
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted-foreground">No movies yet.</p>
          ) : null}
        </div>
        <ConfirmDialog
          open={pendingDelete}
          title="Delete selected movies?"
          description="Published and draft titles will be removed. This cannot be undone from the admin UI."
          confirmLabel="Delete"
          pending={bulk.isPending}
          onClose={() => setPendingDelete(false)}
          onConfirm={() => bulk.mutate("delete")}
        />
      </div>
    </AdminPage>
  );
}
