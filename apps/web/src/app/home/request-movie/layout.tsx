import type { ReactNode } from "react";
import { Suspense } from "react";
import styles from "./request-movie-layout.module.css";
import stylesPage from "./request-movie.module.css";

export default function RequestMovieLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.root}>
      <div className={styles.ambient} aria-hidden>
        <span className={styles.beam} />
        <span className={styles.reel} />
        <span className={styles.reel2} />
      </div>
      <div className={styles.inner}>
        <Suspense
          fallback={
            <div className={stylesPage.page}>
              <div className={stylesPage.loadingShell}>
                <div className={stylesPage.spinner} aria-hidden />
                <p className={stylesPage.loadingText}>Loading request studio…</p>
              </div>
            </div>
          }
        >
          {children}
        </Suspense>
      </div>
    </div>
  );
}
