"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { MovieUploadRequestStatus } from "@movie-server/shared";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { movieUploadRequestApi } from "@/lib/movie-upload-request-api";
import { useProfileStore } from "@/stores/profile-store";
import styles from "./request-movie.module.css";

const STATUS_LABEL: Record<MovieUploadRequestStatus, string> = {
  pending: "Pending review",
  in_progress: "In progress",
  fulfilled: "Added",
  rejected: "Not available",
};

export default function RequestMoviePage() {
  const queryClient = useQueryClient();
  const activeProfile = useProfileStore((s) => s.activeProfile);
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const featuresQuery = useQuery({
    queryKey: ["site-features"],
    queryFn: movieUploadRequestApi.features,
    staleTime: 30_000,
  });

  const mineQuery = useQuery({
    queryKey: ["movie-upload-requests-mine"],
    queryFn: movieUploadRequestApi.mine,
    enabled: Boolean(featuresQuery.data?.movieUploadRequestsEnabled),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      movieUploadRequestApi.create({
        title: title.trim(),
        year: year.trim() ? Number(year) : undefined,
        note: note.trim() || undefined,
        profileId: activeProfile?.id,
      }),
    onSuccess: async () => {
      setError(null);
      setSuccess("Thanks — your request was sent to the team.");
      setTitle("");
      setYear("");
      setNote("");
      await queryClient.invalidateQueries({ queryKey: ["movie-upload-requests-mine"] });
    },
    onError: (err: unknown) => {
      setSuccess(null);
      setError(err instanceof ApiError ? err.message : "Could not submit request.");
    },
  });

  if (featuresQuery.isLoading) {
    return <p className={styles.muted}>Loading…</p>;
  }

  if (!featuresQuery.data?.movieUploadRequestsEnabled) {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.title}>Request a movie</h1>
        <p className={styles.muted}>Movie requests are turned off right now. Check back later.</p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <h1 className={styles.title}>Request a movie</h1>
        <p className={styles.lead}>
          Tell us which title you want on AmarPin. We review requests and add them when the file is available.
        </p>
      </header>

      {error ? <Alert>{error}</Alert> : null}
      {success ? (
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">{success}</div>
      ) : null}

      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          setSuccess(null);
          void createMutation.mutate();
        }}
      >
        <div className={styles.field}>
          <Label htmlFor="req-title">Movie title</Label>
          <Input
            id="req-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. John Wick"
            required
            maxLength={200}
          />
        </div>
        <div className={styles.field}>
          <Label htmlFor="req-year">Year (optional)</Label>
          <Input
            id="req-year"
            inputMode="numeric"
            value={year}
            onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="2014"
          />
        </div>
        <div className={styles.field}>
          <Label htmlFor="req-note">Note (optional)</Label>
          <textarea
            id="req-note"
            className={styles.textarea}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Language, quality preference, or link to TMDB…"
            maxLength={2000}
            rows={4}
          />
        </div>
        {activeProfile ? (
          <p className={styles.muted}>Submitting as profile: {activeProfile.name}</p>
        ) : null}
        <Button type="submit" disabled={!title.trim() || createMutation.isPending}>
          {createMutation.isPending ? "Sending…" : "Submit request"}
        </Button>
      </form>

      {(mineQuery.data?.length ?? 0) > 0 ? (
        <section className={styles.history}>
          <h2 className={styles.historyTitle}>Your recent requests</h2>
          <ul className={styles.historyList}>
            {mineQuery.data!.map((row) => (
              <li key={row.id} className={styles.historyItem}>
                <div>
                  <p className={styles.historyMovie}>
                    {row.title}
                    {row.year ? ` (${row.year})` : ""}
                  </p>
                  {row.note ? <p className={styles.muted}>{row.note}</p> : null}
                </div>
                <span className={styles.status}>{STATUS_LABEL[row.status]}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
