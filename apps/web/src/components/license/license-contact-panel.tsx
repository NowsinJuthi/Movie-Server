"use client";

import { LICENSE_VENDOR } from "@/lib/license-vendor";
import styles from "./license-contact-panel.module.css";

function Chevron() {
  return (
    <svg className={styles.chevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function LicenseContactPanel() {
  return (
    <aside className={styles.panel} aria-label="License support contacts">
      <span className={styles.badge}>Support</span>
      <h2 className={styles.title}>Contact administrator</h2>
      <p className={styles.subtitle}>
        Need a license key? Reach us on WhatsApp, Facebook or uniqbd.com.
      </p>

      <div className={styles.list}>
        <a
          className={styles.row}
          href={LICENSE_VENDOR.whatsappLink}
          target="_blank"
          rel="noreferrer"
        >
          <span className={styles.icon} aria-hidden>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.5 11.6c0 4.5-3.7 8.1-8.2 8.1a8.2 8.2 0 0 1-3.9-1l-4.3 1.1 1.2-4.1a8 8 0 0 1-1.2-4.1c0-4.5 3.7-8.1 8.2-8.1s8.2 3.6 8.2 8.1Zm-3.2 2.5c-.2-.1-1.1-.5-1.3-.6-.2-.1-.3-.1-.5.1-.1.2-.5.6-.6.7-.1.1-.2.1-.4 0a6.6 6.6 0 0 1-2-1.2 7.3 7.3 0 0 1-1.3-1.7c-.1-.2 0-.3.1-.4l.3-.4c.1-.1.1-.2.2-.4 0-.1 0-.3-.1-.4-.1-.1-.5-1.1-.6-1.5-.2-.4-.3-.3-.5-.3h-.4c-.1 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.3c.1.2 1.6 2.5 3.9 3.4 1.5.6 1.8.5 2.2.5.3 0 1.1-.4 1.2-.9.1-.4.1-.8.1-.9 0-.1-.2-.2-.4-.3Z" />
            </svg>
          </span>
          <span className={styles.copy}>
            <span className={styles.label}>WhatsApp</span>
            <span className={styles.value}>{LICENSE_VENDOR.whatsapp}</span>
          </span>
          <Chevron />
        </a>

        <a
          className={styles.row}
          href={LICENSE_VENDOR.facebookLink}
          target="_blank"
          rel="noreferrer"
        >
          <span className={styles.icon} aria-hidden>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M13.6 21v-7.2h2.4l.4-2.8h-2.8V9.2c0-.8.2-1.4 1.4-1.4H16.6V5.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 4v2.6H8v2.8h2.5V21h3.1Z" />
            </svg>
          </span>
          <span className={styles.copy}>
            <span className={styles.label}>Facebook</span>
            <span className={styles.value}>{LICENSE_VENDOR.facebook}</span>
          </span>
          <Chevron />
        </a>

        <a
          className={styles.row}
          href={LICENSE_VENDOR.websiteLink}
          target="_blank"
          rel="noreferrer"
        >
          <span className={styles.icon} aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <circle cx="12" cy="12" r="8.2" />
              <path
                strokeLinecap="round"
                d="M3.8 12h16.4M12 3.8c2.3 2.3 3.5 5.1 3.5 8.2S14.3 17.9 12 20.2M12 3.8C9.7 6.1 8.5 8.9 8.5 12s1.2 5.9 3.5 8.2"
              />
            </svg>
          </span>
          <span className={styles.copy}>
            <span className={styles.label}>Website</span>
            <span className={styles.value}>{LICENSE_VENDOR.website}</span>
          </span>
          <Chevron />
        </a>
      </div>
    </aside>
  );
}
