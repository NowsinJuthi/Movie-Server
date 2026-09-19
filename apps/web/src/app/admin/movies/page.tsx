"use client";

import { MOVIE_GENRES, MATURITY_LEVELS } from "@movie-server/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AdminPage } from "@/components/admin/admin-page";
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
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [createdTitle, setCreatedTitle] = useState<string | null>(null);

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
      setCreatedTitle(form.title);
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ["admin-movies"] });
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : "Unable to create movie.");
    },
  });

  return (
    <AdminPage
      title="Add Manually Movies"
      description="Manually add a movie to the catalog. Metadata is stored in MongoDB."
      error={error}
    >
      <form
        className="admin-card admin-grid-1-sm-2 gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        {createdTitle ? (
          <p className="text-sm text-muted-foreground md:col-span-2">
            Added “{createdTitle}”. You can add another below.
          </p>
        ) : null}

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
    </AdminPage>
  );
}
