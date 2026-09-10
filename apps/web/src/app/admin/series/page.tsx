"use client";

import { MATURITY_LEVELS, MOVIE_GENRES } from "@movie-server/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { seriesApi } from "@/lib/series-api";

export default function AdminSeriesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("A new television series.");
  const [year, setYear] = useState(new Date().getFullYear());
  const [genre, setGenre] = useState("drama");
  const [maturity, setMaturity] = useState("mature");

  const query = useQuery({
    queryKey: ["admin-series"],
    queryFn: () => seriesApi.adminList({ limit: 50, sort: "newest" }),
  });

  const create = useMutation({
    mutationFn: () =>
      seriesApi.create({
        title,
        description,
        firstAirYear: Number(year),
        genres: [genre],
        maturityRating: maturity,
        published: false,
      }),
    onSuccess: async () => {
      setError(null);
      setTitle("");
      await queryClient.invalidateQueries({ queryKey: ["admin-series"] });
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : "Unable to create series."),
  });

  return (
    <AdminPage title="TV series" description="Create series, then open a title to manage seasons, episodes, and tracks." error={error}>
      <div className="space-y-8">
        <form
          className="grid gap-4 rounded-xl border border-border p-5 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          {error ? <p className="md:col-span-2 text-sm text-destructive">{error}</p> : null}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="year">First air year</Label>
            <Input id="year" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              className="min-h-24 w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <select
            className="h-10 rounded-md border border-input bg-background/60 px-3 text-sm"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
          >
            {MOVIE_GENRES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background/60 px-3 text-sm"
            value={maturity}
            onChange={(e) => setMaturity(e.target.value)}
          >
            {MATURITY_LEVELS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <Button className="md:col-span-2" type="submit" disabled={create.isPending}>
            Create series
          </Button>
        </form>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Year</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {(query.data?.items ?? []).map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-4 py-3">{item.title}</td>
                  <td className="px-4 py-3">{item.firstAirYear}</td>
                  <td className="px-4 py-3">{item.published ? "Published" : "Draft"}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => router.push(`/admin/series/${item.id}`)}>
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminPage>
  );
}
