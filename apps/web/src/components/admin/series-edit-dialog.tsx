"use client";

import {
  MATURITY_LEVELS,
  MOVIE_AVAILABILITIES,
  MOVIE_CERTIFICATIONS,
  MOVIE_GENRES,
  SERIES_STATUSES,
} from "@movie-server/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { seriesApi } from "@/lib/series-api";
import { cn } from "@/lib/utils";
import styles from "./movie-edit-dialog.module.css";

export function SeriesEditDialog({
  seriesId,
  open,
  onClose,
}: {
  seriesId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formEpoch, setFormEpoch] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setError(null);
      setFormEpoch(0);
    }
  }, [open, seriesId]);

  const query = useQuery({
    queryKey: ["admin-series-one", seriesId],
    queryFn: () => seriesApi.adminOne(seriesId!),
    enabled: open && Boolean(seriesId),
  });

  const update = useMutation({
    mutationFn: (input: Record<string, unknown>) => seriesApi.update(seriesId!, input),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-series-one", seriesId] });
      await queryClient.invalidateQueries({ queryKey: ["admin-series"] });
      requestAnimationFrame(() => setFormEpoch((value) => value + 1));
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : "Save failed."),
  });

  const uploadPoster = useMutation({
    mutationFn: (file: File) => seriesApi.uploadArtwork(seriesId!, "poster", file),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-series-one", seriesId] });
      await queryClient.invalidateQueries({ queryKey: ["admin-series"] });
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : "Poster upload failed."),
  });

  if (!mounted || !open || !seriesId) return null;

  const series = query.data?.series;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-[2px] sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="series-edit-title"
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[rgb(3,26,34)] shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-primary/15 via-transparent to-transparent px-5 py-4">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[#8aa3aa]">
              Edit series
            </p>
            <h2 id="series-edit-title" className="mt-1 truncate text-xl font-semibold">
              {series?.title ?? "Loading..."}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Update metadata and poster without leaving collections.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="brand-scrollbar space-y-6 overflow-y-auto px-5 py-5">
          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {!query.data ? (
            <p className="text-sm text-muted-foreground">Loading series...</p>
          ) : (
            <>
              <section className={styles.posterPanel}>
                <div className={styles.posterFrame}>
                  {series!.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={series!.posterUrl}
                      alt={`${series!.title} poster`}
                      className={styles.posterImage}
                    />
                  ) : (
                    <div className={styles.posterEmpty}>No poster</div>
                  )}
                </div>
                <div className={styles.posterMeta}>
                  <h3 className={styles.posterMetaTitle}>Series poster</h3>
                  <p className={styles.posterMetaText}>
                    {series!.posterUrl
                      ? "Current poster preview. Upload a new JPEG, PNG, or WebP."
                      : "No poster yet. Upload one here."}
                  </p>
                  <div className={styles.posterActions}>
                    <label className={styles.fileButton}>
                      {uploadPoster.isPending ? "Uploading..." : "Upload poster"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={uploadPoster.isPending}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (file) uploadPoster.mutate(file);
                        }}
                      />
                    </label>
                    {series!.posterUrl ? (
                      <a
                        href={series!.posterUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.fileButton}
                      >
                        Open full size
                      </a>
                    ) : null}
                    <Link href={`/admin/series/${series!.id}`} className={styles.fileButton}>
                      Seasons & episodes
                    </Link>
                  </div>
                </div>
              </section>

              <form
                key={`${series!.id}-${formEpoch}`}
                className="grid gap-4 rounded-xl border border-white/10 bg-black/20 p-4 md:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  update.mutate({
                    title: String(data.get("title")),
                    originalTitle: String(data.get("originalTitle") || "") || null,
                    description: String(data.get("description")),
                    firstAirYear: Number(data.get("firstAirYear")),
                    lastAirYear: Number(data.get("lastAirYear") || 0) || null,
                    maturityRating: String(data.get("maturityRating")),
                    certification: String(data.get("certification") || "") || null,
                    availability: String(data.get("availability")),
                    status: String(data.get("status")),
                    published: Boolean(data.get("published")),
                    featured: Boolean(data.get("featured")),
                    trending: Boolean(data.get("trending")),
                    popular: Boolean(data.get("popular")),
                    autoPlayNext: Boolean(data.get("autoPlayNext")),
                    genres: (() => {
                      const genre = String(data.get("genres") || "").trim();
                      return genre ? [genre] : [];
                    })(),
                  });
                }}
              >
                <Field name="title" label="Title" defaultValue={series!.title} />
                <Field
                  name="originalTitle"
                  label="Original title"
                  defaultValue={series!.originalTitle ?? ""}
                />
                <div className={cn(styles.field, "md:col-span-2")}>
                  <label htmlFor="series-description" className={styles.label}>
                    Description
                  </label>
                  <textarea
                    id="series-description"
                    name="description"
                    defaultValue={series!.description}
                    className={styles.textarea}
                  />
                </div>
                <Field
                  name="firstAirYear"
                  label="First air year"
                  type="number"
                  defaultValue={String(series!.firstAirYear)}
                />
                <Field
                  name="lastAirYear"
                  label="Last air year"
                  type="number"
                  defaultValue={series!.lastAirYear != null ? String(series!.lastAirYear) : ""}
                />
                <SelectField
                  name="maturityRating"
                  label="Maturity"
                  options={[...MATURITY_LEVELS]}
                  defaultValue={series!.maturityRating}
                />
                <SelectField
                  name="certification"
                  label="Certification"
                  options={["", ...MOVIE_CERTIFICATIONS]}
                  defaultValue={series!.certification ?? ""}
                />
                <SelectField
                  name="availability"
                  label="Availability"
                  options={[...MOVIE_AVAILABILITIES]}
                  defaultValue={series!.availability}
                />
                <SelectField
                  name="status"
                  label="Status"
                  options={[...SERIES_STATUSES]}
                  defaultValue={series!.status}
                />
                <SelectField
                  name="genres"
                  label="Genre"
                  options={["", ...MOVIE_GENRES]}
                  defaultValue={series!.genres[0] ?? ""}
                />
                <div className={cn(styles.field, "md:col-span-2")}>
                  <p className={styles.label}>Flags</p>
                  <div className="mt-2 flex flex-wrap gap-4">
                    <label className={styles.check}>
                      <input name="published" type="checkbox" defaultChecked={series!.published} />
                      Published
                    </label>
                    <label className={styles.check}>
                      <input name="featured" type="checkbox" defaultChecked={series!.featured} />
                      Featured
                    </label>
                    <label className={styles.check}>
                      <input name="trending" type="checkbox" defaultChecked={series!.trending} />
                      Trending
                    </label>
                    <label className={styles.check}>
                      <input name="popular" type="checkbox" defaultChecked={series!.popular} />
                      Popular
                    </label>
                    <label className={styles.check}>
                      <input
                        name="autoPlayNext"
                        type="checkbox"
                        defaultChecked={series!.autoPlayNext}
                      />
                      Auto-play next
                    </label>
                  </div>
                </div>
                <div className="md:col-span-2 flex justify-end gap-2">
                  <Button type="submit" disabled={update.isPending}>
                    {update.isPending ? "Saving..." : "Save changes"}
                  </Button>
                </div>
              </form>

              <p className="text-sm text-muted-foreground">
                {series!.seasonCount} seasons · {series!.episodeCount} episodes. Manage seasons on the{" "}
                <Link href={`/admin/series/${series!.id}`} className="text-primary underline-offset-2 hover:underline">
                  full series page
                </Link>
                .
              </p>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Field({
  name,
  label,
  defaultValue,
  type = "text",
}: {
  name: string;
  label: string;
  defaultValue: string;
  type?: string;
}) {
  const id = `series-edit-${name}`;
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <Input id={id} name={name} type={type} defaultValue={defaultValue} className={styles.control} />
    </div>
  );
}

function SelectField({
  name,
  label,
  options,
  defaultValue,
}: {
  name: string;
  label: string;
  options: readonly string[];
  defaultValue: string;
}) {
  const id = `series-edit-${name}`;
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <select id={id} name={name} defaultValue={defaultValue} className={styles.select}>
        {options.map((item) => (
          <option key={item || "empty"} value={item}>
            {item || "—"}
          </option>
        ))}
      </select>
    </div>
  );
}
