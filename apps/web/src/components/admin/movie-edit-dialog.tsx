"use client";

import {
  MEDIA_ASSET_STATUSES,
  MEDIA_KINDS,
  MOVIE_AVAILABILITIES,
  MOVIE_CERTIFICATIONS,
  MOVIE_GENRES,
  MATURITY_LEVELS,
  PROFILE_LANGUAGES,
  SUBTITLE_FORMATS,
  VIDEO_RESOLUTIONS,
  languageLabel,
} from "@movie-server/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { movieApi } from "@/lib/movie-api";
import { cn } from "@/lib/utils";
import styles from "./movie-edit-dialog.module.css";

export function MovieEditDialog({
  movieId,
  open,
  onClose,
}: {
  movieId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tmdbCode, setTmdbCode] = useState("");
  const [updateArtwork, setUpdateArtwork] = useState(true);
  const [formEpoch, setFormEpoch] = useState(0);
  const [media, setMedia] = useState({
    kind: "video",
    quality: "1080p",
    language: "en",
    label: "",
    codec: "",
    channels: "2",
    format: "srt",
    status: "ready",
  });

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
      setTmdbCode("");
      setUpdateArtwork(true);
      setFormEpoch(0);
    }
  }, [open, movieId]);

  const query = useQuery({
    queryKey: ["admin-movie", movieId],
    queryFn: () => movieApi.adminOne(movieId!),
    enabled: open && Boolean(movieId),
  });

  const update = useMutation({
    mutationFn: (input: Record<string, unknown>) => movieApi.update(movieId!, input),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-movie", movieId] });
      await queryClient.invalidateQueries({ queryKey: ["admin-movies"] });
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : "Save failed."),
  });

  const fromTmdb = useMutation({
    mutationFn: () => {
      const raw = tmdbCode.trim();
      const parsed = Number(raw.replace(/[^\d]/g, ""));
      if (!Number.isFinite(parsed) || parsed < 1) {
        throw new Error("Enter a valid TMDB movie id (numbers only).");
      }
      return movieApi.applyFromTmdb(movieId!, parsed, updateArtwork);
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-movie", movieId] });
      await queryClient.invalidateQueries({ queryKey: ["admin-movies"] });
      // Remount form after paint so React does not delete nodes mid-commit.
      requestAnimationFrame(() => setFormEpoch((value) => value + 1));
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "TMDB update failed."),
  });

  const uploadPoster = useMutation({
    mutationFn: (file: File) => movieApi.uploadArtwork(movieId!, "poster", file),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-movie", movieId] });
      await queryClient.invalidateQueries({ queryKey: ["admin-movies"] });
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : "Poster upload failed."),
  });

  const addMedia = useMutation({
    mutationFn: () =>
      movieApi.addMedia(movieId!, {
        kind: media.kind,
        quality: media.kind === "video" ? media.quality : undefined,
        language: media.language || null,
        label: media.label || null,
        codec: media.codec || null,
        channels: media.kind === "audio" ? Number(media.channels) || null : null,
        format: media.kind === "subtitle" ? media.format : null,
        status: media.status,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-movie", movieId] });
    },
  });

  const removeMedia = useMutation({
    mutationFn: (assetId: string) => movieApi.removeMedia(movieId!, assetId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-movie", movieId] });
    },
  });

  if (!mounted || !open || !movieId) return null;

  const movie = query.data?.movie;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-[2px] sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="movie-edit-title"
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[rgb(3,26,34)] shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-primary/15 via-transparent to-transparent px-5 py-4">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[#8aa3aa]">
              Edit movie
            </p>
            <h2 id="movie-edit-title" className="mt-1 truncate text-xl font-semibold">
              {movie?.title ?? "Loading..."}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Update metadata and media tracks without leaving collections.
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
            <p className="text-sm text-muted-foreground">Loading movie...</p>
          ) : (
            <>
              <section className={styles.posterPanel}>
                <div className={styles.posterFrame}>
                  {movie!.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={movie!.posterUrl}
                      alt={`${movie!.title} poster`}
                      className={styles.posterImage}
                    />
                  ) : (
                    <div className={styles.posterEmpty}>No poster</div>
                  )}
                </div>
                <div className={styles.posterMeta}>
                  <h3 className={styles.posterMetaTitle}>Movie poster</h3>
                  <p className={styles.posterMetaText}>
                    {movie!.posterUrl
                      ? "Current poster preview. Upload a new image or pull artwork from TMDB."
                      : "No poster yet. Upload one here or update from TMDB with artwork enabled."}
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
                    {movie!.posterUrl ? (
                      <a
                        href={movie!.posterUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.fileButton}
                      >
                        Open full size
                      </a>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className="space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
                <div>
                  <h3 className="text-lg font-medium">Update from TMDB</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Paste the TMDB movie id (example:{" "}
                    <span className="text-foreground/80">912649</span> from themoviedb.org/movie/912649).
                    This fills title, description, year, runtime, genres, cast, and ratings.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1 space-y-2">
                    <label htmlFor="tmdb-code" className={styles.label}>
                      TMDB movie code
                    </label>
                    <Input
                      id="tmdb-code"
                      inputMode="numeric"
                      placeholder="e.g. 912649"
                      value={tmdbCode}
                      onChange={(e) => setTmdbCode(e.target.value)}
                      className={styles.control}
                    />
                  </div>
                  <Button
                    type="button"
                    disabled={fromTmdb.isPending || !tmdbCode.trim()}
                    onClick={() => fromTmdb.mutate()}
                  >
                    {fromTmdb.isPending ? "Updating..." : "Update from TMDB"}
                  </Button>
                </div>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={updateArtwork}
                    onChange={(e) => setUpdateArtwork(e.target.checked)}
                  />
                  Also download poster & backdrop from TMDB
                </label>
              </section>

              <form
                key={`${movie!.id}-${formEpoch}`}
                className="grid gap-4 rounded-xl border border-white/10 bg-black/20 p-4 md:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  const trailerUrl = String(data.get("trailerUrl") || "");
                  update.mutate({
                    title: String(data.get("title")),
                    originalTitle: String(data.get("originalTitle") || "") || null,
                    description: String(data.get("description")),
                    releaseYear: Number(data.get("releaseYear")),
                    runtimeMinutes: Number(data.get("runtimeMinutes")),
                    ...(trailerUrl.startsWith("http") || trailerUrl === ""
                      ? { trailerUrl: trailerUrl || null }
                      : {}),
                    maturityRating: String(data.get("maturityRating")),
                    certification: String(data.get("certification") || "") || null,
                    availability: String(data.get("availability")),
                    published: Boolean(data.get("published")),
                    featured: Boolean(data.get("featured")),
                    trending: Boolean(data.get("trending")),
                    popular: Boolean(data.get("popular")),
                    genres: (() => {
                      const genre = String(data.get("genres") || "").trim();
                      return genre ? [genre] : [];
                    })(),
                    introStartSeconds: Number(data.get("introStartSeconds") || 0) || null,
                    introEndSeconds: Number(data.get("introEndSeconds") || 0) || null,
                    recapStartSeconds: Number(data.get("recapStartSeconds") || 0) || null,
                    recapEndSeconds: Number(data.get("recapEndSeconds") || 0) || null,
                    creditsStartSeconds: Number(data.get("creditsStartSeconds") || 0) || null,
                  });
                }}
              >
                <Field name="title" label="Title" defaultValue={movie!.title} />
                <Field name="originalTitle" label="Original title" defaultValue={movie!.originalTitle ?? ""} />
                <div className={cn(styles.field, "md:col-span-2")}>
                  <label htmlFor="description" className={styles.label}>
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    defaultValue={movie!.description}
                    className={styles.textarea}
                  />
                </div>
                <Field name="releaseYear" label="Year" type="number" defaultValue={String(movie!.releaseYear)} />
                <Field
                  name="runtimeMinutes"
                  label="Runtime"
                  type="number"
                  defaultValue={String(movie!.runtimeMinutes)}
                />
                <Field name="trailerUrl" label="Trailer URL (https)" defaultValue={movie!.trailerUrl ?? ""} />
                <SelectField
                  name="maturityRating"
                  label="Maturity"
                  options={[...MATURITY_LEVELS]}
                  defaultValue={movie!.maturityRating}
                />
                <SelectField
                  name="certification"
                  label="Certification"
                  options={["", ...MOVIE_CERTIFICATIONS]}
                  defaultValue={movie!.certification ?? ""}
                />
                <SelectField
                  name="availability"
                  label="Availability"
                  options={[...MOVIE_AVAILABILITIES]}
                  defaultValue={movie!.availability}
                />
                <SelectField
                  name="genres"
                  label="Genres"
                  options={[...MOVIE_GENRES]}
                  defaultValue={
                    movie!.genres.find((genre) => (MOVIE_GENRES as readonly string[]).includes(genre)) ??
                    MOVIE_GENRES[0] ??
                    "drama"
                  }
                />
                <Field
                  name="introStartSeconds"
                  label="Intro start (s)"
                  type="number"
                  defaultValue={String(movie!.markers?.introStartSeconds ?? "")}
                />
                <Field
                  name="introEndSeconds"
                  label="Intro end (s)"
                  type="number"
                  defaultValue={String(movie!.markers?.introEndSeconds ?? "")}
                />
                <Field
                  name="recapStartSeconds"
                  label="Recap start (s)"
                  type="number"
                  defaultValue={String(movie!.markers?.recapStartSeconds ?? "")}
                />
                <Field
                  name="recapEndSeconds"
                  label="Recap end (s)"
                  type="number"
                  defaultValue={String(movie!.markers?.recapEndSeconds ?? "")}
                />
                <Field
                  name="creditsStartSeconds"
                  label="Credits start (s)"
                  type="number"
                  defaultValue={String(movie!.markers?.creditsStartSeconds ?? "")}
                />
                <div className={cn(styles.checkRow, "md:col-span-2")}>
                  <label className={styles.check}>
                    <input type="checkbox" name="published" defaultChecked={movie!.published} /> Publish
                  </label>
                  <label className={styles.check}>
                    <input type="checkbox" name="featured" defaultChecked={movie!.featured} /> Featured
                  </label>
                  <label className={styles.check}>
                    <input type="checkbox" name="trending" defaultChecked={movie!.trending} /> Trending
                  </label>
                  <label className={styles.check}>
                    <input type="checkbox" name="popular" defaultChecked={movie!.popular} /> Popular
                  </label>
                </div>
                <Button className="md:col-span-2" type="submit" disabled={update.isPending}>
                  Save metadata
                </Button>
              </form>

              <section className="space-y-4 rounded-xl border border-white/10 bg-black/20 p-4">
                <h3 className="text-lg font-medium">Media versions</h3>
                <p className="text-sm text-muted-foreground">
                  Register video, audio, and subtitle tracks by opaque storage keys.
                </p>
                <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
                  <select
                    className={styles.select}
                    value={media.kind}
                    onChange={(e) => setMedia({ ...media, kind: e.target.value })}
                  >
                    {MEDIA_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {kind}
                      </option>
                    ))}
                  </select>
                  <select
                    className={styles.select}
                    value={media.quality}
                    onChange={(e) => setMedia({ ...media, quality: e.target.value })}
                    disabled={media.kind !== "video"}
                  >
                    {VIDEO_RESOLUTIONS.map((quality) => (
                      <option key={quality} value={quality}>
                        {quality}
                      </option>
                    ))}
                  </select>
                  <select
                    className={styles.select}
                    value={media.language}
                    onChange={(e) => setMedia({ ...media, language: e.target.value })}
                  >
                    {PROFILE_LANGUAGES.map((code) => (
                      <option key={code} value={code}>
                        {languageLabel(code)}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={media.label}
                    onChange={(e) => setMedia({ ...media, label: e.target.value })}
                    placeholder="Label"
                    className={styles.control}
                  />
                  <Input
                    value={media.codec}
                    onChange={(e) => setMedia({ ...media, codec: e.target.value })}
                    placeholder="Codec"
                    className={styles.control}
                  />
                  <Input
                    value={media.channels}
                    onChange={(e) => setMedia({ ...media, channels: e.target.value })}
                    placeholder="Channels"
                    disabled={media.kind !== "audio"}
                    className={styles.control}
                  />
                  <select
                    className={styles.select}
                    value={media.format}
                    onChange={(e) => setMedia({ ...media, format: e.target.value })}
                    disabled={media.kind !== "subtitle"}
                  >
                    {SUBTITLE_FORMATS.map((item) => (
                      <option key={item} value={item}>
                        {item.toUpperCase()}
                      </option>
                    ))}
                  </select>
                  <select
                    className={styles.select}
                    value={media.status}
                    onChange={(e) => setMedia({ ...media, status: e.target.value })}
                  >
                    {MEDIA_ASSET_STATUSES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                <Button onClick={() => addMedia.mutate()} disabled={addMedia.isPending}>
                  Add media track
                </Button>
                <ul className="space-y-2 text-sm">
                  {(query.data.assets ?? []).map((asset) => (
                    <li
                      key={asset.id}
                      className="flex items-center justify-between gap-3 rounded-md bg-secondary px-3 py-2"
                    >
                      <span className="min-w-0 truncate">
                        {asset.kind} · {asset.quality ?? languageLabel(asset.language) ?? asset.label} ·{" "}
                        {asset.codec ?? asset.format ?? asset.status}{" "}
                        {asset.channels ? `· ${asset.channels}ch ` : ""}· {asset.storageKey}
                      </span>
                      <Button size="sm" variant="ghost" onClick={() => removeMedia.mutate(asset.id)}>
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
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
  const id = `movie-edit-${name}`;
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
  const safeValue = options.includes(defaultValue) ? defaultValue : (options[0] ?? "");

  return (
    <div className={styles.field}>
      <label htmlFor={`movie-edit-${name}`} className={styles.label}>
        {label}
      </label>
      <select
        id={`movie-edit-${name}`}
        name={name}
        defaultValue={safeValue}
        className={styles.select}
      >
        {options.map((option) => (
          <option key={option || "none"} value={option}>
            {option || "None"}
          </option>
        ))}
      </select>
    </div>
  );
}
