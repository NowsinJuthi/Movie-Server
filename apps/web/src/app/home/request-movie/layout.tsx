import type { ReactNode } from "react";
import styles from "./request-movie-layout.module.css";

export default function RequestMovieLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.root}>
      <div className={styles.ambient} aria-hidden>
        <span className={styles.beam} />
        <span className={styles.reel} />
        <span className={styles.reel2} />
      </div>
      <div className={styles.inner}>{children}</div>
    </div>
  );
}
