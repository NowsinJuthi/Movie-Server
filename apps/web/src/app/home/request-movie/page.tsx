"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  CheckCircle2,
  Clapperboard,
  Film,
  SendHorizonal,
  Sparkles,
  UserRound,
} from "lucide-react";
import { MovieUploadRequestStatus } from "@movie-server/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { movieUploadRequestApi } from "@/lib/movie-upload-request-api";
import { useProfileStore } from "@/stores/profile-store";
import styles from "./request-movie.module.css";

const STATUS_LABEL: Record<MovieUploadRequestStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  fulfilled: "Added",
  rejected: "Unavailable",
};

const STATUS_CLASS: Record<MovieUploadRequestStatus, string> = {
  pending: styles.statusPending!,
  in_progress: styles.statusProgress!,
  fulfilled: styles.statusFulfilled!,
  rejected: styles.statusRejected!,
};

const STEPS = [
  { title: "Submit title", body: "Tell us the movie name and optional release year." },
  { title: "Team review", body: "We queue your request and check library availability." },
  { title: "Go live", body: "When the file is ready, it appears in your catalog." },
] as const;

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
      setSuccess("Your request is in the queue. We'll update the status below when it's reviewed.");
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
    return (
      <div className={styles.page}>
        <div className={styles.loadingShell}>
          <div className={styles.spinner} aria-hidden />
          <p className={styles.loadingText}>Loading request studio…</p>
        </div>
      </div>
    );
  }

  if (!featuresQuery.data?.movieUploadRequestsEnabled) {
    return (
      <div className={styles.page}>
        <div className={styles.offShell}>
          <Clapperboard className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
          <h1 className={styles.offTitle}>Requests paused</h1>
          <p className={styles.offLead}>Movie upload requests are turned off for now. Please check back later.</p>
        </div>
      </div>
    );
  }

  const history = mineQuery.data ?? [];

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.gridBg} aria-hidden />
        <div className={styles.glow} aria-hidden />

        <header className={styles.hero}>
          <div className={styles.iconRing}>
            <Film className="h-6 w-6" aria-hidden />
          </div>
          <p className={styles.eyebrow}>
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Member requests
          </p>
          <h1 className={styles.title}>Request a movie</h1>
          <p className={styles.lead}>
            Missing a title from the library? Send a request and our team will add it when the media file is
            available.
          </p>
        </header>

        <div className={styles.steps}>
          {STEPS.map((step, index) => (
            <div key={step.title} className={styles.step}>
              <span className={styles.stepNum}>{index + 1}</span>
              <p className={styles.stepText}>
                <strong>{step.title}</strong>
                {step.body}
              </p>
            </div>
          ))}
        </div>

        {error ? (
          <div className={styles.feedback}>
            <p className={styles.feedbackError} role="alert">
              {error}
            </p>
          </div>
        ) : null}

        {success ? (
          <div className={styles.feedback}>
            <p className={styles.feedbackSuccess} role="status">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
              <span>{success}</span>
            </p>
          </div>
        ) : null}

        <div className={styles.formCard}>
          <p className={styles.formTitle}>
            <SendHorizonal className="h-4 w-4 text-primary" aria-hidden />
            New request
          </p>

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
                autoComplete="off"
              />
            </div>
            <div className={styles.field}>
              <Label htmlFor="req-year">Release year (optional)</Label>
              <Input
                id="req-year"
                inputMode="numeric"
                value={year}
                onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="2014"
              />
            </div>
            <div className={styles.field}>
              <Label htmlFor="req-note">Details (optional)</Label>
              <textarea
                id="req-note"
                className={styles.textarea}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Preferred language, quality, or a TMDB link…"
                maxLength={2000}
                rows={4}
              />
            </div>

            <div className={styles.submitRow}>
              <div>
                {activeProfile ? (
                  <span className={styles.profileChip}>
                    <UserRound className="h-3.5 w-3.5" aria-hidden />
                    Submitting as <strong>{activeProfile.name}</strong>
                  </span>
                ) : (
                  <p className={styles.hint}>Select a profile from the account menu if you share this account.</p>
                )}
              </div>
              <Button
                type="submit"
                className={styles.submitBtn}
                disabled={!title.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? "Sending…" : "Submit request"}
              </Button>
            </div>
          </form>
        </div>

        {history.length > 0 ? (
          <section className={styles.history} aria-labelledby="request-history-title">
            <div className={styles.historyHead}>
              <h2 id="request-history-title" className={styles.historyTitle}>
                Your requests
              </h2>
              <span className={styles.historyCount}>{history.length} total</span>
            </div>
            <ul className={styles.historyList}>
              {history.map((row, index) => (
                <li
                  key={row.id}
                  className={styles.historyItem}
                  style={{ animationDelay: `${0.08 * index}s` }}
                >
                  <div className="min-w-0">
                    <p className={styles.historyMovie}>
                      {row.title}
                      {row.year ? ` (${row.year})` : ""}
                    </p>
                    {row.note ? <p className={styles.note}>{row.note}</p> : null}
                  </div>
                  <span className={cn(styles.status, STATUS_CLASS[row.status])}>
                    {STATUS_LABEL[row.status]}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
