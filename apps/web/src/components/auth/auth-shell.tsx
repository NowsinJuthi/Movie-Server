"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { AuthGraphic } from "./auth-graphic";
import { useBranding } from "@/components/branding/site-brand";
import { brandingAssetSrc } from "@/lib/settings-api";
import styles from "./auth-shell.module.css";

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const { siteName, logoUrl } = useBranding();
  const logoSrc = brandingAssetSrc(logoUrl);

  return (
    <main className={styles.page}>
      <svg className={`${styles.scribble} ${styles.scribbleTop}`} viewBox="0 0 160 70" fill="none" aria-hidden>
        <path d="M8 42 C28 8, 58 62, 88 22 S138 8, 152 36" stroke="var(--auth-accent)" strokeWidth="1.4" />
        <circle cx="24" cy="18" r="3" fill="var(--auth-accent)" />
        <circle cx="118" cy="12" r="2.2" fill="var(--auth-accent-soft)" />
      </svg>
      <svg className={`${styles.scribble} ${styles.scribbleBottom}`} viewBox="0 0 180 80" fill="none" aria-hidden>
        <path d="M10 48 C40 8, 70 72, 110 28 S160 18, 172 50" stroke="var(--auth-accent-deep)" strokeWidth="1.4" />
        <polygon points="150,18 158,32 142,32" stroke="var(--auth-accent)" fill="none" />
      </svg>

      <div className={styles.card}>
        <div className={styles.art} aria-hidden="true">
          <AuthGraphic className={styles.shield} />
        </div>
        <div className={styles.right}>
          <div className={styles.form}>
            <Link href="/" className={styles.brand}>
              {logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoSrc} alt={siteName} className={styles.brandLogo} />
              ) : (
                siteName
              )}
            </Link>
            <h1 className={styles.formTitle}>{title}</h1>
            <p className={styles.formSubtitle}>{description}</p>
            <div className={styles.panel}>{children}</div>
          </div>
        </div>
      </div>
    </main>
  );
}
