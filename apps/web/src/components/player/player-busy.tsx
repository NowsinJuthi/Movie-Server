"use client";

import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import styles from "./player-busy.module.css";

export function PlayerBusyMark({
  mode,
}: {
  /** First load vs mid-playback stall — same language, different energy. */
  mode: "preparing" | "buffering";
}) {
  const buffering = mode === "buffering";
  return (
    <div
      className={cn(styles.overlay, buffering ? styles.overlayBuffering : styles.overlayPreparing)}
      role="status"
      aria-live="polite"
      aria-label={buffering ? "Buffering" : "Loading"}
    >
      <div className={cn(styles.mark, buffering && styles.markBuffering)}>
        {!buffering ? <span className={styles.glow} aria-hidden /> : null}
        <svg className={styles.rings} viewBox="0 0 80 80" aria-hidden>
          <circle className={styles.track} cx="40" cy="40" r="34" />
          <circle className={styles.arc} cx="40" cy="40" r="34" />
          <circle className={styles.arcInner} cx="40" cy="40" r="26" />
        </svg>
        {!buffering ? (
          <span className={styles.dots} aria-hidden>
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </span>
        ) : null}
        {!buffering ? (
          <span className={styles.core}>
            <Play className={styles.play} />
          </span>
        ) : null}
      </div>
    </div>
  );
}
