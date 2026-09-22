"use client";

import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import styles from "./player-busy.module.css";

export function PlayerBusyMark({
  mode,
  freezeFrame,
}: {
  /** First load vs mid-playback stall — same language, different energy. */
  mode: "preparing" | "buffering";
  /** Last video frame so buffering does not flash a black screen. */
  freezeFrame?: string | null;
}) {
  const buffering = mode === "buffering";
  return (
    <div
      className={cn(styles.overlay, buffering ? styles.overlayBuffering : styles.overlayPreparing)}
      role="status"
      aria-live="polite"
      aria-label={buffering ? "Buffering" : "Loading"}
    >
      {buffering && freezeFrame ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={freezeFrame} alt="" className={styles.freeze} />
      ) : null}
      <div className={cn(styles.mark, buffering && styles.markBuffering)}>
        <span className={styles.glow} aria-hidden />
        <svg className={styles.rings} viewBox="0 0 80 80" aria-hidden>
          <circle className={styles.track} cx="40" cy="40" r="34" />
          <circle className={styles.arc} cx="40" cy="40" r="34" />
          <circle className={styles.arcInner} cx="40" cy="40" r="26" />
        </svg>
        <span className={styles.dots} aria-hidden>
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.dot} />
        </span>
        <span className={styles.core}>
          <Play className={styles.play} />
        </span>
      </div>
    </div>
  );
}
